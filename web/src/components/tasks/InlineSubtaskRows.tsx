import React from 'react';
import type { ExcelCatalogField, ExcelSelectOption } from './TaskExcelGrid';
import type { InlineSubtaskDraft } from './inline-subtask';

interface AssigneeOption extends ExcelSelectOption {
  userId: string | null;
  resourceMemberId: string | null;
}

interface Props {
  drafts: InlineSubtaskDraft[];
  colSpan: number;
  depth: number;
  assignees: AssigneeOption[];
  catalogs: Partial<Record<ExcelCatalogField, ExcelSelectOption[]>>;
  submitting: boolean;
  onChange: (id: string, updates: Partial<InlineSubtaskDraft>) => void;
  onAdd: (parentTaskId: string) => void;
  onRemove: (id: string) => void;
  onCreateAll: () => void;
}

export function InlineSubtaskRows({ drafts, colSpan, depth, assignees, catalogs, submitting, onChange, onAdd, onRemove, onCreateAll }: Props) {
  if (!drafts.length) return null;
  return <>
    {drafts.map((draft) => (
      <tr key={draft.id} className="bg-blue-50" data-testid={`inline-subtask-${draft.id}`}>
        <td colSpan={colSpan} className="border-y border-blue-100 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2" style={{ paddingLeft: `${depth * 16}px` }}>
            <span aria-hidden>↳</span>
            <input
              autoFocus
              aria-label={`Subtask title for ${draft.parentTaskId}`}
              className="min-w-48 grow rounded border-slate-300 text-sm"
              placeholder="Subtask title *"
              value={draft.title}
              onChange={(event) => onChange(draft.id, { title: event.target.value, error: undefined })}
            />
            <select aria-label="Subtask assignee" value={draft.assigneeKey} onChange={(event) => onChange(draft.id, { assigneeKey: event.target.value })}>
              <option value="">Not assigned</option>
              {assignees.map((option) => <option key={option.key} value={option.key}>{option.label}{option.userId ? '' : ' (unlinked)'}</option>)}
            </select>
            <input type="date" aria-label="Subtask start date" value={draft.startDate} onChange={(event) => onChange(draft.id, { startDate: event.target.value })} />
            {(['progressType', 'category', 'taskType'] as const).map((field) => (
              <select key={field} aria-label={`Subtask ${field}`} value={field === 'progressType' ? draft.progressCatalogItemId : field === 'category' ? draft.categoryCatalogItemId : draft.taskTypeCatalogItemId} onChange={(event) => onChange(draft.id, { [field === 'progressType' ? 'progressCatalogItemId' : field === 'category' ? 'categoryCatalogItemId' : 'taskTypeCatalogItemId']: event.target.value })}>
                <option value="">{field === 'progressType' ? 'Progress type' : field === 'category' ? 'Category' : 'Task type'}: not set</option>
                {(catalogs[field] ?? []).map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
            ))}
            <details>
              <summary className="cursor-pointer text-xs text-slate-600">More</summary>
              <div className="mt-2 flex flex-wrap gap-2">
                <input aria-label="Subtask description" placeholder="Description" value={draft.description} onChange={(event) => onChange(draft.id, { description: event.target.value })} />
                <select aria-label="Subtask status" value={draft.status} onChange={(event) => onChange(draft.id, { status: event.target.value as InlineSubtaskDraft['status'] })}>
                  {['TODO', 'DOING', 'DONE', 'CLOSE'].map((value) => <option key={value}>{value}</option>)}
                </select>
                <select aria-label="Subtask priority" value={draft.priority} onChange={(event) => onChange(draft.id, { priority: event.target.value as InlineSubtaskDraft['priority'] })}>
                  {['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL'].map((value) => <option key={value}>{value}</option>)}
                </select>
                <input type="number" min="0" aria-label="Subtask effort" placeholder="Effort" value={draft.effort} onChange={(event) => onChange(draft.id, { effort: event.target.value })} />
                <input type="number" min="0" max="100" aria-label="Subtask progress" placeholder="Progress %" value={draft.progress} onChange={(event) => onChange(draft.id, { progress: event.target.value })} />
                <input type="date" aria-label="Subtask due date" value={draft.dueDate} onChange={(event) => onChange(draft.id, { dueDate: event.target.value })} />
                <input aria-label="Subtask tags" placeholder="Tags, comma separated" value={draft.tags} onChange={(event) => onChange(draft.id, { tags: event.target.value })} />
              </div>
            </details>
            <button type="button" className="text-sm text-blue-700" onClick={() => onAdd(draft.parentTaskId)}>Add another row</button>
            <button type="button" className="text-sm text-red-600" onClick={() => onRemove(draft.id)}>Remove</button>
            <button type="button" className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50" disabled={submitting} onClick={onCreateAll}>{submitting ? 'Creating…' : 'OK / Create all'}</button>
            {draft.error && <span role="alert" className="text-sm text-red-700">{draft.error}</span>}
          </div>
        </td>
      </tr>
    ))}
  </>;
}
