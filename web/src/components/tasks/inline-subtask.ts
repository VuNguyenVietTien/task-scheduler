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

export function buildInlineSubtaskInput(
  draft: InlineSubtaskDraft,
  projectId: string,
  assignees: readonly InlineAssigneeOption[]
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
    progress: draft.progress === '' ? null : Number(draft.progress),
  };
}
