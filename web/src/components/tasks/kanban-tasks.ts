import { Task, TaskStatus, TaskStatuses } from '@/types/task';

export interface KanbanTaskRow {
  task: Task;
  depth: number;
  parent?: Task;
}

export const KANBAN_COLUMNS: ReadonlyArray<{ id: TaskStatus; title: string }> = [
  { id: TaskStatuses.TODO, title: 'Todo' },
  { id: TaskStatuses.DOING, title: 'In Progress' },
  { id: TaskStatuses.PENDING, title: 'Pending' },
  { id: TaskStatuses.REVIEW, title: 'Review' },
  { id: TaskStatuses.BLOCKED, title: 'Blocked' },
  { id: TaskStatuses.DONE, title: 'Done' },
  { id: TaskStatuses.CLOSE, title: 'Closed' },
  { id: TaskStatuses.REJECTED, title: 'Rejected' },
  { id: TaskStatuses.ARCHIVED, title: 'Archived' },
];

const KANBAN_STATUSES = new Set<TaskStatus>(KANBAN_COLUMNS.map(({ id }) => id));

export function getKanbanStatus(status?: string): TaskStatus {
  return KANBAN_STATUSES.has(status as TaskStatus) ? status as TaskStatus : TaskStatuses.TODO;
}

/** Flatten a task forest in parent-first order, emitting each identity once. */
export function flattenKanbanTasks(tasks: readonly Task[]): KanbanTaskRow[] {
  const rows: KanbanTaskRow[] = [];
  const seen = new Set<string>();
  const visit = (task: Task, depth: number, parent?: Task) => {
    if (!task.task_id || seen.has(task.task_id)) return;
    seen.add(task.task_id);
    rows.push({ task, depth, parent });
    task.child_tasks?.forEach((child) => visit(child, depth + 1, task));
  };
  tasks.forEach((task) => visit(task, 0));
  return rows;
}

/** Patch one task without flattening or replacing descendants omitted by an update response. */
export function updateKanbanTaskInTree(
  tasks: Task[],
  taskId: string,
  updates: Partial<Task>
): Task[] {
  let changed = false;
  const update = (nodes: Task[]): Task[] => nodes.map((task) => {
    if (task.task_id === taskId || task.id === taskId) {
      changed = true;
      return {
        ...task,
        ...updates,
        child_tasks: updates.child_tasks === undefined ? task.child_tasks : updates.child_tasks,
      };
    }
    if (!task.child_tasks?.length) return task;
    const childTasks = update(task.child_tasks);
    return childTasks === task.child_tasks ? task : { ...task, child_tasks: childTasks };
  });
  const next = update(tasks);
  return changed ? next : tasks;
}
