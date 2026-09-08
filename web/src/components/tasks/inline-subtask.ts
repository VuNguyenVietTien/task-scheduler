import type { Task } from '@/types/task';
import { buildCreateTaskInput, createTaskFormSchema } from './NewTaskForm';

export interface InlineSubtaskDraft {
  id: string;
  parentTaskId: string;
  title: string;
  description: string;
  assigneeKey: string;
  startDate: string;
  dueDate: string;
  progressCatalogItemId: string;
  categoryCatalogItemId: string;
  taskTypeCatalogItemId: string;
  status: 'TODO' | 'DOING' | 'DONE' | 'CLOSE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL';
  effort: string;
  progress: string;
  tags: string;
  error?: string;
}

export interface InlineAssigneeOption {
  key: string;
  userId: string | null;
  resourceMemberId: string | null;
}

export function newInlineSubtaskDraft(id: string, parentTaskId: string): InlineSubtaskDraft {
  return {
    id, parentTaskId, title: '', description: '', assigneeKey: '', startDate: '', dueDate: '',
    progressCatalogItemId: '', categoryCatalogItemId: '', taskTypeCatalogItemId: '',
    status: 'TODO', priority: 'MEDIUM', effort: '', progress: '', tags: '',
  };
}

export function nextSiblingPriorityOrder(tasks: readonly Task[], parentTaskId: string): number {
  let max = -1;
  const visit = (nodes: readonly Task[], nestedParent?: string) => nodes.forEach((task) => {
    const parentId = task.parent_task_id ?? nestedParent;
    if (parentId === parentTaskId && Number.isFinite(task.priority_order)) max = Math.max(max, task.priority_order);
    if (task.child_tasks?.length) visit(task.child_tasks, task.task_id);
  });
  visit(tasks);
  return max + 1;
}

/** Insert a canonical created row after its parent's complete flat subtree. */
export function upsertTaskTreeRow(tasks: readonly Task[], incoming: Task): Task[] {
  const existing = tasks.findIndex((task) => task.task_id === incoming.task_id);
  if (existing >= 0) return tasks.map((task, index) => index === existing ? { ...task, ...incoming } : task);
  if (!incoming.parent_task_id) return [...tasks, incoming];

  const parentIndex = tasks.findIndex((task) => task.task_id === incoming.parent_task_id);
  if (parentIndex < 0) return [...tasks, incoming];
  const byId = new Map(tasks.map((task) => [task.task_id, task]));
  const isDescendant = (task: Task) => {
    const seen = new Set<string>();
    let parentId = task.parent_task_id;
    while (parentId && !seen.has(parentId)) {
      if (parentId === incoming.parent_task_id) return true;
      seen.add(parentId);
      parentId = byId.get(parentId)?.parent_task_id;
    }
    return false;
  };
  let insertionIndex = parentIndex + 1;
  while (insertionIndex < tasks.length && isDescendant(tasks[insertionIndex])) insertionIndex += 1;
  return [...tasks.slice(0, insertionIndex), incoming, ...tasks.slice(insertionIndex)];
}

export function buildInlineSubtaskInput(
  draft: InlineSubtaskDraft,
  projectId: string,
  assignees: readonly InlineAssigneeOption[],
  priorityOrder = 0
) {
  const assignee = assignees.find((option) => option.key === draft.assigneeKey);
  const form = createTaskFormSchema.parse({
    title: draft.title,
    description: draft.description || undefined,
    assignee: assignee?.userId ?? undefined,
    assigneeResourceMemberId: assignee?.resourceMemberId ?? undefined,
    startDate: draft.startDate || undefined,
    dueDate: draft.dueDate || undefined,
    progressCatalogItemId: draft.progressCatalogItemId || undefined,
    categoryCatalogItemId: draft.categoryCatalogItemId || undefined,
    taskTypeCatalogItemId: draft.taskTypeCatalogItemId || undefined,
    status: draft.status,
    priority: draft.priority,
    effort: draft.effort === '' ? undefined : Number(draft.effort),
    tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
  });
  return {
    ...buildCreateTaskInput(form, projectId, draft.parentTaskId),
    priority_order: priorityOrder,
    progress: draft.progress === '' ? null : Number(draft.progress),
  };
}
