import type { Task } from '@/types/task';

export interface ListAssigneeFilterOption {
  key: string;
  label: string;
  userId?: string | null;
  resourceMemberId: string | null;
}

export function buildListFilterAssignees(options: readonly ListAssigneeFilterOption[]) {
  return options.map(({ key, label, userId }) => ({ key, label, userId: userId ?? undefined }));
}

export function matchesListAssignee(
  task: Task,
  filterId: string,
  options: readonly ListAssigneeFilterOption[]
): boolean {
  const option = options.find((candidate) => candidate.key === filterId || candidate.userId === filterId);
  if (!option) return false;
  return task.assignee_resource_member_id
    ? task.assignee_resource_member_id === option.resourceMemberId
    : Boolean(option.userId && task.assignee?.userId === option.userId);
}
