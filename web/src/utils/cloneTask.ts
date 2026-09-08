export interface CloneTreeNode {
  task_id: string;
  project_id?: string;
  parent_task_id?: string | null;
  title: string;
  is_deleted?: boolean;
}

export interface CloneTreeItem {
  node: CloneTreeNode;
  depth: number;
}

export interface CloneTree {
  sourceTaskId: string;
  items: CloneTreeItem[];
}

export interface CloneTaskSelectionInput {
  source_task_id: string;
  selected_descendant_ids: string[];
  quantity: number;
  destination_parent_task_id?: string;
  clone_without_parent?: boolean;
}

export interface ClonePreview {
  parentCount: number;
  childCount: number;
  totalCount: number;
}

/** Projects one active, cycle-safe subtree. Duplicate IDs appear once; orphans are never promoted. */
export function buildCloneTree(nodes: readonly CloneTreeNode[], sourceTaskId: string): CloneTree {
  const byId = new Map<string, CloneTreeNode>();
  for (const node of nodes) {
    if (!node.is_deleted && !byId.has(node.task_id)) byId.set(node.task_id, node);
  }

  const source = byId.get(sourceTaskId);
  if (!source) return { sourceTaskId, items: [] };

  const children = new Map<string, CloneTreeNode[]>();
  byId.forEach((node) => {
    const parentId = node.parent_task_id;
    if (parentId && byId.has(parentId)) {
      const siblings = children.get(parentId) ?? [];
      siblings.push(node);
      children.set(parentId, siblings);
    }
  });

  const items: CloneTreeItem[] = [];
  const seen = new Set<string>();
  const stack: CloneTreeItem[] = [{ node: source, depth: 0 }];
  while (stack.length) {
    const item = stack.pop()!;
    if (seen.has(item.node.task_id)) continue;
    seen.add(item.node.task_id);
    items.push(item);
    const descendants = children.get(item.node.task_id) ?? [];
    for (let index = descendants.length - 1; index >= 0; index -= 1) {
      stack.push({ node: descendants[index], depth: item.depth + 1 });
    }
  }

  return { sourceTaskId, items };
}

export function defaultCloneSelection(tree: CloneTree): Set<string> {
  return new Set(tree.items.map(({ node }) => node.task_id));
}

/** Applies checkbox-tree closure: branches toggle descendants and checked nodes include ancestors. */
export function updateCloneSelection(
  tree: CloneTree,
  selected: ReadonlySet<string>,
  taskId: string,
  checked: boolean
): Set<string> {
  const next = new Set(selected);
  const index = tree.items.findIndex(({ node }) => node.task_id === taskId);
  if (index < 0) return next;
  if (taskId === tree.sourceTaskId) {
    if (checked) next.add(taskId);
    else next.delete(taskId);
    return next;
  }

  const depth = tree.items[index].depth;
  const branchIds = [taskId];
  for (let cursor = index + 1; cursor < tree.items.length && tree.items[cursor].depth > depth; cursor += 1) {
    branchIds.push(tree.items[cursor].node.task_id);
  }

  if (checked) {
    branchIds.forEach((id) => next.add(id));
    const inTree = new Set(tree.items.map(({ node }) => node.task_id));
    let parentId = tree.items[index].node.parent_task_id;
    while (parentId && inTree.has(parentId)) {
      if (parentId === tree.sourceTaskId && !selected.has(tree.sourceTaskId)) break;
      if (next.has(parentId)) break;
      next.add(parentId);
      parentId = tree.items.find(({ node }) => node.task_id === parentId)?.node.parent_task_id;
    }
  } else {
    branchIds.forEach((id) => next.delete(id));
  }

  return next;
}

export function getCloneCheckboxState(
  tree: CloneTree,
  selected: ReadonlySet<string>,
  taskId: string
): { checked: boolean; indeterminate: boolean } {
  const index = tree.items.findIndex(({ node }) => node.task_id === taskId);
  if (index < 0) return { checked: false, indeterminate: false };
  const depth = tree.items[index].depth;
  const descendantIds: string[] = [];
  for (let cursor = index + 1; cursor < tree.items.length && tree.items[cursor].depth > depth; cursor += 1) {
    descendantIds.push(tree.items[cursor].node.task_id);
  }
  const selectedDescendants = descendantIds.filter((id) => selected.has(id)).length;
  return {
    checked: selected.has(taskId),
    indeterminate: selectedDescendants > 0
      && (!selected.has(taskId) || selectedDescendants < descendantIds.length),
  };
}

export function parseCloneQuantity(value: string): number | null {
  const quantity = Number(value);
  return Number.isSafeInteger(quantity) && quantity > 0 ? quantity : null;
}

export function getSelectedCloneRootIds(tree: CloneTree, selected: ReadonlySet<string>): string[] {
  return tree.items
    .map(({ node }) => node)
    .filter((node) => selected.has(node.task_id) && (!node.parent_task_id || !selected.has(node.parent_task_id)))
    .map((node) => node.task_id);
}

export function getClonePreview(selectedCount: number, quantity: number, selectedRootCount = 1): ClonePreview {
  const parentCount = selectedRootCount * quantity;
  const childCount = Math.max(0, selectedCount - selectedRootCount) * quantity;
  return { parentCount, childCount, totalCount: parentCount + childCount };
}

export function createCloneSelectionInput(
  tree: CloneTree,
  selected: ReadonlySet<string>,
  quantity: number,
  destination?: { parentTaskId: string } | { withoutParent: true }
): CloneTaskSelectionInput {
  return {
    source_task_id: tree.sourceTaskId,
    selected_descendant_ids: tree.items
      .map(({ node }) => node.task_id)
      .filter((id) => id !== tree.sourceTaskId && selected.has(id)),
    quantity,
    ...(destination && 'parentTaskId' in destination
      ? { destination_parent_task_id: destination.parentTaskId }
      : destination ? { clone_without_parent: true } : {}),
  };
}
