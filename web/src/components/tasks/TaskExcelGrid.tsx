'use client';

/**
 * TaskExcelGrid — requirement 7 "Excel mode" for the task list.
 *
 * Spreadsheet-like staged bulk editing:
 *  - drag cell selection (mouse anchor → drag range → mouseup),
 *  - type a value then Enter to fill the whole selection,
 *  - paste TSV (from Excel/Sheets/clipboard) anchored at the selection;
 *    out-of-range cells are clipped, invalid values are rejected per cell,
 *  - staged edits are highlighted and NOT saved until the explicit "Save"
 *    button; failed rows stay staged with their error message so nothing is
 *    lost.
 *
 * Saving delegates to the parent via `onSaveEdit` (existing task update
 * thunks/mutations — no new backend entities).
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { EDITABLE_TASK_STATUSES, Task } from '@/types/task';

export type ExcelField = 'title' | 'status' | 'priority' | 'effort' | 'due_date' | 'assignee';
export type ExcelCatalogField = 'progress' | 'category' | 'taskType';
export type ExcelEditableField = ExcelField | ExcelCatalogField;

export interface ExcelSelectOption {
  key: string;
  label: string;
}

export type ExcelAssigneeOption = ExcelSelectOption;

type ExcelColumn = {
  field?: ExcelField;
  catalogField?: ExcelCatalogField;
  label: string;
  width: string;
};

export interface StagedEdit {
  taskId: string;
  field: ExcelEditableField;
  value: string;
}

interface Props {
  tasks: Array<Task & { excelDepth?: number }>;
  /** Persist one staged edit. Throw to report failure (edit stays staged). */
  onSaveEdit: (edit: StagedEdit) => Promise<void>;
  /** Canonical resource label; supports members without linked accounts. */
  assigneeLabel?: (task: Task) => string;
  assigneeOptions?: ExcelAssigneeOption[];
  assigneeValue?: (task: Task) => string;
  /** Stable IDs are staged/saved while localized labels remain visible. */
  catalogLabel?: (task: Task, field: ExcelCatalogField) => string;
  catalogOptions?: Partial<Record<ExcelCatalogField, ExcelSelectOption[]>>;
  catalogValue?: (task: Task, field: ExcelCatalogField) => string;
  /** Restore the keyboard target whenever a retained grid becomes visible. */
  active?: boolean;
  onCloneTask?: (taskId: string) => void;
  onDeleteTask?: (task: Task) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

const COLUMNS: ExcelColumn[] = [
  { field: 'title', label: 'Title', width: '220px' },
  { field: 'status', label: 'Status', width: '110px' },
  { field: 'priority', label: 'Priority', width: '100px' },
  { field: 'effort', label: 'Effort (h)', width: '90px' },
  { field: 'due_date', label: 'Due date', width: '120px' },
  { field: 'assignee', label: 'Assignee', width: '140px' },
  { catalogField: 'progress', label: 'Progress type', width: '140px' },
  { catalogField: 'category', label: 'Category', width: '140px' },
  { catalogField: 'taskType', label: 'Task type', width: '140px' },
];

const VALID_STATUSES = [...EDITABLE_TASK_STATUSES];
const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL'];

export interface CellValidationError {
  row: number;
  col: number;
  message: string;
}

/** Validate + normalize a pasted/typed value for one column. */
export function validateCellValue(
  field: ExcelField,
  raw: string
): { ok: true; value: string } | { ok: false; message: string } {
  const value = raw.trim();
  switch (field) {
    case 'status': {
      const upper = value.toUpperCase();
      if (!VALID_STATUSES.includes(upper as typeof VALID_STATUSES[number])) {
        return { ok: false, message: `Invalid status "${raw}" (expected one of ${VALID_STATUSES.slice(0, 5).join('/')}…)` };
      }
      return { ok: true, value: upper };
    }
    case 'priority': {
      const upper = value.toUpperCase();
      if (!VALID_PRIORITIES.includes(upper)) {
        return { ok: false, message: `Invalid priority "${raw}" (LOW/MEDIUM/HIGH/URGENT/CRITICAL)` };
      }
      return { ok: true, value: upper };
    }
    case 'effort': {
      const cleaned = value.replace(/h$/i, '').trim();
      if (cleaned === '') return { ok: true, value: '' }; // backend contract: blank saves as 0
      const num = Number(cleaned);
      if (Number.isNaN(num) || num < 0 || num > 24 * 30) {
        return { ok: false, message: `Invalid effort "${raw}" (non-negative hours)` };
      }
      return { ok: true, value: String(num) };
    }
    case 'due_date': {
      if (value === '') return { ok: true, value: '' }; // empty = clear due date
      // STRICT calendar validation: JS Date normalizes impossible dates
      // (2026-02-31 → Mar 3), so verify the parsed components round-trip.
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      if (!m) return { ok: false, message: `Invalid date "${raw}" (expected YYYY-MM-DD)` };
      const [y, mo, d] = m.slice(1).map(Number);
      const dt = new Date(y, mo - 1, d);
      if (
        dt.getFullYear() !== y ||
        dt.getMonth() !== mo - 1 ||
        dt.getDate() !== d
      ) {
        return { ok: false, message: `Invalid calendar date "${raw}"` };
      }
      return { ok: true, value };
    }
    case 'assignee': {
      // Empty = clear assignment (handleExcelSave unassigns on '').
      return { ok: true, value };
    }
    default:
      if (value === '') return { ok: false, message: 'Empty value' };
      return { ok: true, value };
  }
}

/** Parse a TSV clipboard block into rows×cols strings. */
export function parseTsv(text: string): string[][] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line, idx, arr) => !(line === '' && idx === arr.length - 1))
    .map((line) => line.split('\t'));
}

export function TaskExcelGrid({ tasks, onSaveEdit, assigneeLabel, assigneeOptions = [], assigneeValue, catalogLabel, catalogOptions = {}, catalogValue, active = true, onCloneTask, onDeleteTask, onDirtyChange }: Props) {
  const [staged, setStaged] = useState<Map<string, StagedEdit>>(new Map());
  const [anchor, setAnchor] = useState<{ row: number; col: number } | null>(null);
  const [focusCell, setFocusCell] = useState<{ row: number; col: number } | null>(null);
  const [selectionEditor, setSelectionEditor] = useState<{ row: number; col: number } | null>(null);
  const [typing, setTyping] = useState<string>('');
  const typingInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const draggingRef = useRef(false);

  const keyFor = (taskId: string, field: ExcelEditableField) => `${taskId}:${field}`;
  const focusTypingInput = useCallback(() => typingInputRef.current?.focus({ preventScroll: true }), []);

  useEffect(() => {
    if (active) focusTypingInput();
  }, [active, focusTypingInput]);

  // The hidden keyboard target must never make the grid/page jump to its DOM
  // position. Restore the user's scroll after every staged rerender.
  useLayoutEffect(() => {
    if (gridRef.current) gridRef.current.scrollTop = scrollTopRef.current;
  }, [tasks, staged, focusCell, selectionEditor, errors]);

  const cellValue = useCallback(
    (task: Task, column: ExcelColumn): string => {
      if (column.catalogField) {
        const stagedEdit = staged.get(keyFor(task.task_id, column.catalogField));
        if (stagedEdit) return catalogOptions[column.catalogField]?.find((option) => option.key === stagedEdit.value)?.label ?? stagedEdit.value;
        const fallback = column.catalogField === 'progress' ? task.progress_type
          : column.catalogField === 'category' ? task.category
            : task.type;
        return catalogLabel?.(task, column.catalogField) ?? fallback ?? '';
      }
      if (!column.field) return '';
      const stagedEdit = staged.get(keyFor(task.task_id, column.field));
      if (stagedEdit) {
        return column.field === 'assignee'
          ? assigneeOptions.find((option) => option.key === stagedEdit.value)?.label ?? stagedEdit.value
          : stagedEdit.value;
      }
      switch (column.field) {
        case 'title':
          return task.title;
        case 'status':
          return task.status ?? '';
        case 'priority':
          return task.priority ?? '';
        case 'effort':
          return task.effort !== undefined && task.effort !== null ? String(task.effort) : '';
        case 'due_date':
          return task.due_date ? task.due_date.slice(0, 10) : '';
        case 'assignee':
          return assigneeLabel?.(task) ?? task.assignee?.username ?? '';
      }
    },
    [assigneeLabel, assigneeOptions, catalogLabel, catalogOptions, staged]
  );

  const inSelection = useCallback(
    (row: number, col: number): boolean => {
      if (!anchor) return false;
      const other = focusCell ?? anchor;
      const r1 = Math.min(anchor.row, other.row);
      const r2 = Math.max(anchor.row, other.row);
      const c1 = Math.min(anchor.col, other.col);
      const c2 = Math.max(anchor.col, other.col);
      return row >= r1 && row <= r2 && col >= c1 && col <= c2;
    },
    [anchor, focusCell]
  );

  const stageCell = useCallback(
    (row: number, col: number, raw: string): string | null => {
      const task = tasks[row];
      const column = COLUMNS[col];
      const field = column?.field ?? column?.catalogField;
      if (!task || !field) return null;
      let value: string;
      if (column.catalogField) {
        const rawValue = raw.trim();
        const matches = (catalogOptions[column.catalogField] ?? []).filter((option) => option.key === rawValue || option.label === rawValue);
        if (rawValue && matches.length !== 1) return `Unknown or ambiguous ${column.label.toLowerCase()} "${raw}"`;
        value = rawValue ? matches[0].key : '';
      } else {
        const validated = validateCellValue(column.field!, raw);
        if (!validated.ok) return validated.message;
        value = validated.value;
      }
      setStaged((prev) => {
        const next = new Map(prev);
        next.set(keyFor(task.task_id, field), {
          taskId: task.task_id,
          field,
          value,
        });
        return next;
      });
      return null;
    },
    [catalogOptions, tasks]
  );

  const handleMouseDown = (row: number, col: number) => {
    draggingRef.current = true;
    setAnchor({ row, col });
    setFocusCell({ row, col });
    setSelectionEditor(null);
    setTyping('');
    setErrors([]);
    focusTypingInput();
  };

  const handleMouseOver = (row: number, col: number) => {
    if (draggingRef.current && anchor) {
      setFocusCell({ row, col });
    }
  };

  const handleMouseUp = () => {
    draggingRef.current = false;
  };

  const stageSelection = useCallback((value: string) => {
    if (!anchor) return;
    const other = focusCell ?? anchor;
    const r1 = Math.min(anchor.row, other.row);
    const r2 = Math.max(anchor.row, other.row);
    const c1 = Math.min(anchor.col, other.col);
    const c2 = Math.max(anchor.col, other.col);
    const cellErrors: string[] = [];
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const err = stageCell(r, c, value);
        if (err) cellErrors.push(`Row ${r + 1} ${COLUMNS[c].label}: ${err}`);
      }
    }
    setErrors(cellErrors);
  }, [anchor, focusCell, stageCell]);

  const moveFocus = useCallback((backward: boolean) => {
    const current = focusCell ?? anchor;
    if (!current || !tasks.length) return;
    let { row, col } = current;
    for (let attempt = 0; attempt < tasks.length * COLUMNS.length; attempt++) {
      col += backward ? -1 : 1;
      if (col < 0) {
        col = COLUMNS.length - 1;
        row = row === 0 ? tasks.length - 1 : row - 1;
      } else if (col === COLUMNS.length) {
        col = 0;
        row = row === tasks.length - 1 ? 0 : row + 1;
      }
      if (COLUMNS[col].field || COLUMNS[col].catalogField) {
        setAnchor({ row, col });
        setFocusCell({ row, col });
        return;
      }
    }
  }, [anchor, focusCell, tasks.length]);

  const navigateFromEditor = useCallback((row: number, col: number, key: string) => {
    const next = {
      row: Math.max(0, Math.min(tasks.length - 1, row + (key === 'ArrowUp' ? -1 : key === 'ArrowDown' || key === 'Enter' ? 1 : 0))),
      col: Math.max(0, Math.min(COLUMNS.length - 1, col + (key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0))),
    };
    setAnchor(next);
    setFocusCell(next);
    const column = COLUMNS[next.col];
    setSelectionEditor(column.field === 'effort' || column.field === 'due_date' ? next : null);
    if (column.field !== 'effort' && column.field !== 'due_date') focusTypingInput();
  }, [focusTypingInput, tasks.length]);

  /** Enter commits the typed value; Tab commits then moves to the next editable cell. */
  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setTyping('');
      setErrors([]);
      return;
    }
    if (!anchor) return;
    if (e.key === 'Enter' && typing.trim() !== '') {
      e.preventDefault();
      stageSelection(typing);
      setTyping('');
    } else if (e.key === 'Delete') {
      e.preventDefault();
      stageSelection('');
      setTyping('');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (typing !== '') stageSelection(typing);
      setTyping('');
      setErrors([]);
      moveFocus(e.shiftKey);
    }
  };

  /** TSV paste anchored at the selection anchor cell. */
  const handlePaste = (e: React.ClipboardEvent) => {
    if (!anchor) return;
    const text = e.clipboardData.getData('text');
    if (!text) return;
    e.preventDefault();
    const rows = parseTsv(text);
    const cellErrors: string[] = [];
    let applied = 0;
    rows.forEach((cells, dr) => {
      cells.forEach((cellText, dc) => {
        const r = anchor.row + dr;
        const c = anchor.col + dc;
        if (r >= tasks.length || c >= COLUMNS.length) return; // clipped
        const err = stageCell(r, c, cellText);
        if (err) {
          cellErrors.push(`Row ${r + 1} ${COLUMNS[c].label}: ${err}`);
        } else {
          applied += 1;
        }
      });
    });
    setErrors(cellErrors.length ? cellErrors : []);
    if (applied > 0 && cellErrors.length === 0) {
      setFocusCell({
        row: Math.min(tasks.length - 1, anchor.row + rows.length - 1),
        col: Math.min(COLUMNS.length - 1, anchor.col + (rows[0]?.length ?? 1) - 1),
      });
    }
  };

  const handleCopy = (e: React.ClipboardEvent) => {
    if (!anchor) return;
    const other = focusCell ?? anchor;
    const r1 = Math.min(anchor.row, other.row);
    const r2 = Math.max(anchor.row, other.row);
    const c1 = Math.min(anchor.col, other.col);
    const c2 = Math.max(anchor.col, other.col);
    const text = tasks.slice(r1, r2 + 1)
      .map((task) => COLUMNS.slice(c1, c2 + 1).map((column) => cellValue(task, column)).join('\t'))
      .join('\r\n');
    e.preventDefault();
    e.clipboardData.setData('text/plain', text);
    e.clipboardData.setData('text', text);
  };

  /** Explicit Save: persist staged edits one by one; failures stay staged.
   * Revision-aware (manager review #5): a key is removed only when its
   * CURRENT staged value still equals the value that was saved — a newer
   * edit typed while the request was in flight is never discarded. */
  const handleSave = async () => {
    setSaving(true);
    const failed: string[] = [];
    const snapshot = new Map(staged); // key → value at save time
    const succeeded: { key: string; saved: StagedEdit }[] = [];
    for (const [key, edit] of Array.from(snapshot.entries())) {
      try {
        await onSaveEdit(edit);
        succeeded.push({ key, saved: edit });
      } catch (err) {
        failed.push(`Task ${edit.taskId} ${edit.field}: ${(err as Error).message}`);
      }
    }
    setStaged((prev) => {
      const next = new Map(prev);
      for (const { key, saved } of succeeded) {
        const current = next.get(key);
        // Delete only if unchanged since the save began (same field+value);
        // otherwise the user re-edited mid-flight — keep the NEWER value.
        if (!current || (current.value === saved.value && current.field === saved.field)) {
          next.delete(key);
        }
      }
      return next;
    });
    setErrors(failed);
    setSaving(false);
    focusTypingInput(); // keyboard flow continues after toolbar without scrolling
  };

  const dirtyCount = staged.size;

  useEffect(() => {
    onDirtyChange?.(dirtyCount > 0);
    return () => onDirtyChange?.(false);
  }, [dirtyCount, onDirtyChange]);

  useEffect(() => {
    if (!dirtyCount) return;
    const confirmLeave = () => window.confirm('Discard unsaved Excel edits?');
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const link = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || confirmLeave()) return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onDocumentClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onDocumentClick, true);
    };
  }, [dirtyCount]);

  const selectionSummary = useMemo(() => {
    if (!anchor) return '';
    const other = focusCell ?? anchor;
    const rows = Math.abs(other.row - anchor.row) + 1;
    const cols = Math.abs(other.col - anchor.col) + 1;
    return rows * cols > 1 ? `${rows}×${cols} selected` : '';
  }, [anchor, focusCell]);

  return (
    <div
      ref={gridRef}
      className="border border-slate-200 rounded-lg bg-white overflow-auto"
      data-testid="task-excel-grid"
      onScroll={(event) => { scrollTopRef.current = event.currentTarget.scrollTop; }}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onCopy={handleCopy}
      tabIndex={0}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-slate-50 text-xs">
        <span className="font-medium">Excel mode</span>
        <span className="text-slate-500">drag to select · type + Enter to fill · paste TSV · edits stage until Save</span>
        {selectionSummary && <span className="px-1.5 py-0.5 bg-blue-100 rounded" data-testid="excel-selection-summary">{selectionSummary}</span>}
        <span className="flex-1" />
        {dirtyCount > 0 && (
          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded" data-testid="excel-dirty-count">
            {dirtyCount} unsaved
          </span>
        )}
        <button
          className="px-3 py-1 bg-emerald-600 text-white rounded disabled:opacity-40"
          onClick={handleSave}
          disabled={saving || dirtyCount === 0}
          data-testid="excel-save-btn"
        >
          {saving ? 'Saving…' : `Save (${dirtyCount})`}
        </button>
        <button
          className="px-3 py-1 border rounded"
          onClick={() => {
            setStaged(new Map());
            setErrors([]);
            focusTypingInput(); // keyboard flow continues without scrolling
          }}
          disabled={dirtyCount === 0}
          data-testid="excel-discard-btn"
        >
          Discard
        </button>
      </div>

      <table className="min-w-full text-xs border-collapse select-none" style={{ tableLayout: 'fixed', width: '100%' }}>
        <colgroup>
          <col style={{ width: '32px' }} />
          {COLUMNS.map((column) => <col key={column.field ?? column.catalogField} style={{ width: column.width }} />)}
          {(onCloneTask || onDeleteTask) && <col style={{ width: '112px' }} />}
        </colgroup>
        <thead>
          <tr className="bg-slate-50 text-left text-slate-500">
            <th className="w-8 border border-slate-200 px-2 py-1">#</th>
            {COLUMNS.map((c) => (
              <th key={c.field ?? c.catalogField} className="border border-slate-200 px-2 py-1" style={{ width: c.width }}>
                {c.label}
              </th>
            ))}
            {(onCloneTask || onDeleteTask) && <th className="border border-slate-200 px-2 py-1">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task, row) => (
            <tr key={task.task_id}>
              <td className="border border-slate-200 px-2 py-1 text-slate-400">{row + 1}</td>
              {COLUMNS.map((col, c) => {
                const selected = inSelection(row, c);
                const editableField = col.field ?? col.catalogField;
                const isStaged = Boolean(editableField && staged.has(keyFor(task.task_id, editableField)));
                const isTypingCell = selected && typing !== '';
                const isSelectionEditor = selectionEditor?.row === row && selectionEditor.col === c;
                const value = cellValue(task, col);
                return (
                  <td
                    key={col.field ?? col.catalogField}
                    className={`border px-2 py-1 ${editableField ? 'cursor-cell' : 'cursor-default text-slate-600'} ${
                      selected ? 'bg-blue-100 border-blue-400' : 'border-slate-200'
                    } ${isStaged ? 'bg-amber-100' : ''}`}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      e.preventDefault();
                      handleMouseDown(row, c);
                    }}
                    onMouseOver={() => handleMouseOver(row, c)}
                    onClick={() => {
                      if (col.field === 'assignee' || col.field === 'effort' || col.field === 'due_date' || col.catalogField) {
                        setSelectionEditor({ row, col: c });
                      }
                    }}
                    onDoubleClick={focusTypingInput}
                    data-testid={`excel-cell-${row}-${c}`}
                    data-task-id={task.task_id}
                    data-field={col.field ?? col.catalogField}
                  >
                    {isSelectionEditor && (col.field === 'effort' || col.field === 'due_date') ? (
                      <input
                        type={col.field === 'effort' ? 'number' : 'date'}
                        aria-label={col.field === 'effort' ? 'Excel effort' : 'Excel due date'}
                        autoFocus
                        min={col.field === 'effort' ? 0 : undefined}
                        step={col.field === 'effort' ? 0.5 : undefined}
                        value={value}
                        onMouseDown={(event) => event.stopPropagation()}
                        onPaste={handlePaste}
                        onChange={(event) => {
                          const error = stageCell(row, c, event.target.value);
                          setErrors(error ? [`Row ${row + 1} ${col.label}: ${error}`] : []);
                        }}
                        onKeyDown={(event) => {
                          if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(event.key)) return;
                          event.preventDefault();
                          const error = stageCell(row, c, event.currentTarget.value);
                          setErrors(error ? [`Row ${row + 1} ${col.label}: ${error}`] : []);
                          if (!error) navigateFromEditor(row, c, event.key);
                        }}
                        onBlur={() => {
                          setSelectionEditor(null);
                          focusTypingInput();
                        }}
                        className="w-full bg-transparent px-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    ) : isSelectionEditor && editableField ? (
                      <select
                        aria-label={col.field === 'assignee' ? 'Excel assignee' : `Excel ${col.label}`}
                        autoFocus
                        value={staged.get(keyFor(task.task_id, editableField))?.value ?? (col.catalogField ? catalogValue?.(task, col.catalogField) : assigneeValue?.(task)) ?? ''}
                        onMouseDown={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const error = stageCell(row, c, e.target.value);
                          setErrors(error ? [`Row ${row + 1} ${col.label}: ${error}`] : []);
                          setSelectionEditor(null);
                          focusTypingInput();
                        }}
                      >
                        <option value="">{col.field === 'assignee' ? 'Not assigned' : 'Not set'}</option>
                        {(col.catalogField ? catalogOptions[col.catalogField] ?? [] : assigneeOptions).map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                      </select>
                    ) : isTypingCell ? typing : col.field === 'title' ? (
                      <span style={{ paddingLeft: `${(task.excelDepth ?? 0) * 16}px` }}>
                        {(task.excelDepth ?? 0) > 0 ? '↳ ' : ''}{value}
                      </span>
                    ) : value}
                  </td>
                );
              })}
              {(onCloneTask || onDeleteTask) && (
                <td className="border border-slate-200 px-2 py-1 text-center whitespace-nowrap">
                  {onCloneTask && (
                    <button
                      className="px-2 py-0.5 border rounded hover:bg-slate-100"
                      onClick={() => onCloneTask(task.task_id)}
                      aria-label={`Clone ${task.title}`}
                      data-testid={`excel-clone-${task.task_id}`}
                    >
                      ⧉
                    </button>
                  )}
                  {onDeleteTask && (
                    <button
                      className="ml-1 px-2 py-0.5 border border-red-200 text-red-600 rounded hover:bg-red-50"
                      onClick={() => onDeleteTask(task)}
                      aria-label={`Delete ${task.title}`}
                      data-testid={`excel-delete-${task.task_id}`}
                    >
                      Delete
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
          {tasks.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length + 2} className="px-4 py-6 text-center text-slate-400">
                No tasks
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Typed input for fill + paste target */}
      <input
        ref={typingInputRef}
        className="sr-only"
        aria-label="Excel cell input"
        value={typing}
        onChange={(e) => setTyping(e.target.value)}
        onKeyDown={handleGridKeyDown}
        onPaste={handlePaste}
        data-testid="excel-typing-input"
        autoFocus
      />

      {errors.length > 0 && (
        <ul className="px-3 py-2 text-xs text-red-600 border-t" data-testid="excel-errors">
          {errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
