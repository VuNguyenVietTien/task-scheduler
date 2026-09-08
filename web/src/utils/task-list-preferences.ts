import { Priorities, TaskStatuses, type TaskFilter } from '@/types/task';

export const TASK_LIST_COLUMN_IDS = [
  'title', 'status', 'priority', 'assignee', 'effort', 'progress', 'progressType',
  'category', 'taskType', 'plannedStart', 'plannedEnd', 'actualStart', 'actualEnd',
  'tags', 'createdAt', 'updatedAt', 'creator',
] as const;

export type TaskListColumnId = typeof TASK_LIST_COLUMN_IDS[number];

export const TASK_LIST_COLUMN_LABELS: Record<TaskListColumnId, string> = {
  title: 'Title', status: 'Status', priority: 'Priority', assignee: 'Assignee',
  effort: 'Effort', progress: 'Progress', progressType: 'Progress type', category: 'Category',
  taskType: 'Task type', plannedStart: 'Start date', plannedEnd: 'Planned end',
  actualStart: 'Actual start', actualEnd: 'Actual end', tags: 'Tags', createdAt: 'Created',
  updatedAt: 'Updated', creator: 'Creator',
};

export const DEFAULT_TASK_LIST_COLUMNS: TaskListColumnId[] = [
  'title', 'status', 'priority', 'progressType', 'category', 'taskType', 'assignee', 'plannedStart', 'plannedEnd', 'effort',
];

export interface TaskListPreferences {
  filters: TaskFilter;
  columns: TaskListColumnId[];
}

export function taskListPreferenceKey(projectId?: string, userId?: string): string {
  return `task-list-preferences:${projectId || 'all'}:${userId || 'anonymous'}`;
}

const FILTER_KEYS = ['searchQuery', 'status', 'priority', 'assigneeId', 'projectId', 'startDate', 'endDate', 'phaseId'] as const;

function validFilters(value: unknown): TaskFilter {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const filters: TaskFilter = {};
  for (const key of FILTER_KEYS) {
    const item = source[key];
    if (typeof item !== 'string') continue;
    if (key === 'status' && !Object.values(TaskStatuses).includes(item as never)) continue;
    if (key === 'priority' && !Object.values(Priorities).includes(item as never)) continue;
    filters[key] = item as never;
  }
  return filters;
}

export function loadTaskListPreferences(key: string): TaskListPreferences {
  const fallback = { filters: {}, columns: [...DEFAULT_TASK_LIST_COLUMNS] };
  if (typeof window === 'undefined') return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || 'null') as Partial<TaskListPreferences> | null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.columns)) return fallback;
    const columns = parsed.columns.filter((value): value is TaskListColumnId =>
      typeof value === 'string' && TASK_LIST_COLUMN_IDS.includes(value as TaskListColumnId));
    return { filters: validFilters(parsed.filters), columns: columns.length ? columns : fallback.columns };
  } catch {
    return fallback;
  }
}

export function saveTaskListPreferences(key: string, preferences: TaskListPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(preferences));
  } catch {
    // Storage can be unavailable (private mode, denied access, full quota).
  }
}
