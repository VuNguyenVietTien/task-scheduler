/**
 * Recursive task-subtree clone (requirement 7, manager review #4).
 *
 * Contract:
 * - Clones `rootId` and EVERY descendant (grandchildren included) via DFS.
 * - Cycle guard: `parent_task_id` cycles in the source list cannot cause
 *   infinite recursion (visited set); each source node is cloned at most once.
 * - Parent remap: each clone's `parent_task_id` points at its cloned parent;
 *   the ROOT clone keeps the SOURCE root's own parent (cloning a child keeps
 *   it under the same parent), or null when the source was a root task.
 * - newId validation: children are only written after the parent's create
 *   call returns a usable id; a missing/invalid id fails that branch
 *   WITHOUT orphaning further writes.
 * - Partial errors: per-node failures are collected and reported; success is
 *   claimed ONLY when every node was created.
 */

export interface CloneSourceTask {
  task_id: string;
  parent_task_id?: string | null;
  title: string;
  [k: string]: unknown; // remaining fields are copied verbatim per node
}

export interface CloneCreateInput {
  project_id: string;
  title: string;
  parent_task_id?: string | null;
  source: CloneSourceTask;
}

export interface CloneApi {
  /** Must return the new task id; throwing records a per-node failure. */
  createTask(input: CloneCreateInput): Promise<string>;
}

export interface CloneNodeFailure {
  sourceId: string;
  title: string;
  error: string;
}

export interface CloneResult {
  ok: boolean;
  rootCloneId?: string | { id?: string; err?: string };
  created: string[]; // new ids in creation order
  failures: CloneNodeFailure[];
}

export async function cloneTaskSubtree(
  api: CloneApi,
  tasks: CloneSourceTask[],
  rootId: string,
  opts: { titleSuffix?: string } = {}
): Promise<CloneResult> {
  const suffix = opts.titleSuffix ?? ' (copy)';
  const byId = new Map(tasks.map((t) => [t.task_id, t]));
  const childrenOf = new Map<string, CloneSourceTask[]>();
  for (const t of tasks) {
    const p = t.parent_task_id ?? null;
    if (p) {
      (childrenOf.get(p) ?? childrenOf.set(p, []).get(p)!).push(t);
    }
  }
  // Pre-compute descendants with a visited set (cycle-safe).
  const descendants: CloneSourceTask[] = [];
  const seen = new Set<string>([rootId]);
  const stack = [...(childrenOf.get(rootId) ?? [])];
  while (stack.length) {
    const node = stack.pop()!;
    if (seen.has(node.task_id)) continue; // cycle or duplicate edge
    seen.add(node.task_id);
    descendants.push(node);
    for (const c of childrenOf.get(node.task_id) ?? []) stack.push(c);
  }

  const created: string[] = [];
  const failures: CloneNodeFailure[] = [];
  const idMap = new Map<string, string>(); // source id → clone id
  const project = (byId.get(rootId)?.project_id as string) ?? '';

  const root = byId.get(rootId);
  if (!root) {
    return { ok: false, created, failures: [{ sourceId: rootId, title: '', error: 'source task not found' }] };
  }

  // Root clone keeps the SOURCE root's parent (cloning a child preserves its
  // place in the tree); children remap onto their cloned ancestors.
  const rootCloneId = await cloneOne(api, root, root.parent_task_id ?? null, project, suffix);
  if (!rootCloneId.id) {
    return {
      ok: false,
      created,
      failures: [{ sourceId: rootId, title: root.title, error: rootCloneId.err ?? 'root create_task failed' }],
    };
  }
  idMap.set(rootId, rootCloneId.id);
  created.push(rootCloneId.id);

  // DFS children in stable order so parents always exist before their kids.
  const order: CloneSourceTask[] = [];
  const walk = (id: string) => {
    for (const child of (childrenOf.get(id) ?? []).slice().sort((a, b) => a.task_id.localeCompare(b.task_id))) {
      if (child.task_id === rootId) continue; // never re-clone the root (cycle edge)
      if (!seen.has(child.task_id)) continue;
      if (order.some((o) => o.task_id === child.task_id)) continue;
      order.push(child);
      walk(child.task_id);
    }
  };
  walk(rootId);

  for (const node of order) {
    const parentClone = idMap.get(node.parent_task_id ?? '');
    // If the parent failed earlier, remap to the nearest cloned ancestor is
    // NOT done silently — record the orphan instead of guessing placement.
    if (node.parent_task_id && !parentClone) {
      failures.push({
        sourceId: node.task_id,
        title: node.title,
        error: `parent ${node.parent_task_id} was not cloned; skipping subtree to avoid misplacement`,
      });
      continue;
    }
    const r = await cloneOne(api, node, parentClone ?? null, project, suffix);
    if (!r.id) {
      failures.push({ sourceId: node.task_id, title: node.title, error: r.err ?? 'create_task returned no id' });
      continue;
    }
    idMap.set(node.task_id, r.id);
    created.push(r.id);
  }

  return { ok: failures.length === 0, rootCloneId, created, failures };
}

async function cloneOne(
  api: CloneApi,
  node: CloneSourceTask,
  parentTaskId: string | null,
  projectId: string,
  suffix: string
): Promise<{ id?: string; err?: string }> {
  try {
    const id = await api.createTask({
      project_id: projectId,
      title: node.title + suffix,
      parent_task_id: parentTaskId,
      source: node,
    });
    // Empty/invalid id is a FAILURE (never write children against it).
    if (typeof id === 'string' && id) return { id };
    return { err: 'create_task returned no id' };
  } catch (e) {
    return { err: (e as Error).message || 'create_task threw' };
  }
}