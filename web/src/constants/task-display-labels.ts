/**
 * Shared display labels for task enums.
 * Used across all views (Gantt, Kanban, TaskList, TaskDetail) for consistent labels.
 *
 * Translation-aware: getStatusLabel / getPriorityLabel / getTypeLabel use the i18n instance
 * so they return the correct language at runtime without requiring a React hook.
 */

// English fallback labels (used when i18n is not yet initialised)
export const STATUS_LABELS: Record<string, string> = {
  TODO: 'To do',
  DOING: 'In progress',
  DONE: 'Done',
  CLOSE: 'Closed',
  PENDING: 'Pending',
  REVIEW: 'In review',
  BLOCKED: 'Blocked',
  REJECTED: 'Rejected',
  ARCHIVED: 'Archived',
};

// Priority labels (English fallback)
export const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
  CRITICAL: 'Critical',
};

// Task type labels (English fallback)
export const TYPE_LABELS: Record<string, string> = {
  Feature: 'Feature',
  Bug: 'Bug',
  Enhancement: 'Enhancement',
  Documentation: 'Documentation',
};

// Task category labels (English fallback)
export const CATEGORY_LABELS: Record<string, string> = {
  Frontend: 'Frontend',
  Backend: 'Backend',
  Design: 'Design',
  Testing: 'Testing',
  DevOps: 'DevOps',
};

// Progress type labels (English fallback)
export const PROGRESS_TYPE_LABELS: Record<string, string> = {
  study: 'Study',
  investigate: 'Investigate',
  code: 'Code',
  test: 'Test',
  review_code: 'Review code',
  review_test_report: 'Review test report',
  release: 'Release',
};

/**
 * Get label for any enum value with i18n support.
 * Uses the i18n instance when available; falls back to the static map or raw value.
 */
export function getLabel(map: Record<string, string>, value: string | null | undefined, placeholder = '-'): string {
  if (!value) return placeholder;
  return map[value] || map[value.toLowerCase()] || value;
}

// ---------------------------------------------------------------------------
// Translation-aware helpers — use these instead of direct map lookups so that
// the displayed text respects the user's language setting at runtime.
// ---------------------------------------------------------------------------

function tryT(key: string, fallback: string): string {
  try {
    // Lazy-import to avoid circular deps; i18n may not be ready server-side
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const i18n = require('@/i18n/i18n-config').default;
    const result = i18n.t(key);
    // i18next returns the key itself when no translation found
    return result && result !== key ? result : fallback;
  } catch {
    return fallback;
  }
}

export function getStatusLabel(status: string | null | undefined): string {
  if (!status) return '-';
  return tryT(`tasks.statusLabels.${status.toUpperCase()}`, STATUS_LABELS[status.toUpperCase()] || status);
}

export function getPriorityLabel(priority: string | null | undefined): string {
  if (!priority) return '-';
  return tryT(`tasks.priorityLabels.${priority.toUpperCase()}`, PRIORITY_LABELS[priority.toUpperCase()] || priority);
}

export function getTypeLabel(type: string | null | undefined): string {
  if (!type) return '-';
  return tryT(`tasks.typeLabels.${type}`, TYPE_LABELS[type] || type);
}
