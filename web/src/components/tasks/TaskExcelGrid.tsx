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
import React, { useMemo, useRef, useState, useCallback } from 'react';
import { Task, TaskStatus, Priority } from '@/types/task';

export type ExcelField = 'title' | 'status' | 'priority' | 'effort' | 'due_date' | 'assignee';

export interface StagedEdit {
  taskId: string;
  field: ExcelField;
  value: string;
}

interface Props {
  tasks: Array<Task & { excelDepth?: number }>;
  /** Persist one staged edit. Throw to report failure (edit stays staged). */
  onSaveEdit: (edit: StagedEdit) => Promise<void>;
  /** Canonical resource label; supports members without linked accounts. */
  assigneeLabel?: (task: Task) => string;
  onCloneTask?: (taskId: string) => void;
}

const COLUMNS: { field: ExcelField; label: string; width: string }[] = [
  { field: 'title', label: 'Title', width: '220px' },
  { field: 'status', label: 'Status', width: '110px' },
  { field: 'priority', label: 'Priority', width: '100px' },
  { field: 'effort', label: 'Effort (h)', width: '90px' },
  { field: 'due_date', label: 'Due date', width: '120px' },
  { field: 'assignee', label: 'Assignee', width: '140px' },
];

const VALID_STATUSES = ['TODO', 'DOING', 'DONE', 'CLOSE', 'PENDING', 'REVIEW', 'BLOCKED', 'REJECTED', 'ARCHIVED', 'CANCELLED'];
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
      if (!VALID_STATUSES.includes(upper)) {
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
      const num = Number(cleaned);
      if (cleaned === '' || Number.isNaN(num) || num < 0 || num > 24 * 30) {
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

export function TaskExcelGrid({ tasks, onSaveEdit, assigneeLabel, onCloneTask }: Props) {
  const [staged, setStaged] = useState<Map<string, StagedEdit>>(new Map());
  const [anchor, setAnchor] = useState<{ row: number; col: number } | null>(null);
  const [focusCell, setFocusCell] = useState<{ row: number; col: number } | null>(null);
  const [typing, setTyping] = useState<string>('');
  const typingInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const draggingRef = useRef(false);

  const keyFor = (taskId: string, field: ExcelField) => `${taskId}:${field}`;

  const cellValue = useCallback(
    (task: Task, field: ExcelField): string => {
      const stagedEdit = staged.get(keyFor(task.task_id, field));
      if (stagedEdit) return stagedEdit.value;
      switch (field) {
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
        default:
          return '';
      }
    },
    [assigneeLabel, staged]
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
      const field = COLUMNS[col].field;
      if (!task) return null;
      const validated = validateCellValue(field, raw);
      if (!validated.ok) return validated.message;
      setStaged((prev) => {
        const next = new Map(prev);
        next.set(keyFor(task.task_id, field), {
          taskId: task.task_id,
          field,
          value: validated.value,
        });
        return next;
      });
      return null;
    },
    [tasks]
  );

  const handleMouseDown = (row: number, col: number) => {
    draggingRef.current = true;
    setAnchor({ row, col });
    setFocusCell({ row, col });
    setTyping('');
    setErrors([]);
  };

  const handleMouseOver = (row: number, col: number) => {
    if (draggingRef.current && anchor) {
      setFocusCell({ row, col });
    }
  };

  const handleMouseUp = () => {
    draggingRef.current = false;
  };

  /** Enter commits the typed value to every selected cell (fill-down/across). */
  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    const clearsSelection = e.key === 'Delete';
    if (anchor && ((e.key === 'Enter' && typing.trim() !== '') || clearsSelection)) {
      e.preventDefault();
      const value = clearsSelection ? '' : typing;
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
      setTyping('');
    } else if (e.key === 'Escape') {
      setTyping('');
      setErrors([]);
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
      setFocusCell({ row: anchor.row + rows.length - 1, col: anchor.col + (rows[0]?.length ?? 1) - 1 });
    }
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
    typingInputRef.current?.focus(); // keyboard flow continues after toolbar (review #7)
  };

  const dirtyCount = staged.size;

  const selectionSummary = useMemo(() => {
    if (!anchor) return '';
    const other = focusCell ?? anchor;
    const rows = Math.abs(other.row - anchor.row) + 1;
    const cols = Math.abs(other.col - anchor.col) + 1;
    return rows * cols > 1 ? `${rows}×${cols} selected` : '';
  }, [anchor, focusCell]);

  return (
    <div
      className="border border-slate-200 rounded-lg bg-white overflow-auto"
      data-testid="task-excel-grid"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
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
            typingInputRef.current?.focus(); // keyboard flow continues (review #7)
          }}
          disabled={dirtyCount === 0}
          data-testid="excel-discard-btn"
        >
          Discard
        </button>
      </div>

      <table className="min-w-full text-xs border-collapse select-none">
        <thead>
          <tr className="bg-slate-50 text-left text-slate-500">
            <th className="w-8 border border-slate-200 px-2 py-1">#</th>
            {COLUMNS.map((c) => (
              <th key={c.field} className="border border-slate-200 px-2 py-1" style={{ minWidth: c.width }}>
                {c.label}
              </th>
            ))}
            {onCloneTask && <th className="border border-slate-200 px-2 py-1 w-16">Clone</th>}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task, row) => (
            <tr key={task.task_id}>
              <td className="border border-slate-200 px-2 py-1 text-slate-400">{row + 1}</td>
              {COLUMNS.map((col, c) => {
                const selected = inSelection(row, c);
                const isStaged = staged.has(keyFor(task.task_id, col.field));
                const isTypingCell = selected && typing !== '';
                return (
                  <td
                    key={col.field}
                    className={`border px-2 py-1 cursor-cell ${
                      selected ? 'bg-blue-100 border-blue-400' : 'border-slate-200'
                    } ${isStaged ? 'bg-amber-100' : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleMouseDown(row, c);
                    }}
                    onMouseOver={() => handleMouseOver(row, c)}
                    data-testid={`excel-cell-${row}-${c}`}
                    data-task-id={task.task_id}
                    data-field={col.field}
                  >
                    {isTypingCell ? typing : col.field === 'title' ? (
                      <span style={{ paddingLeft: `${(task.excelDepth ?? 0) * 16}px` }}>
                        {(task.excelDepth ?? 0) > 0 ? '↳ ' : ''}{cellValue(task, col.field)}
                      </span>
                    ) : cellValue(task, col.field)}
                  </td>
                );
              })}
              {onCloneTask && (
                <td className="border border-slate-200 px-2 py-1 text-center">
                  <button
                    className="px-2 py-0.5 border rounded hover:bg-slate-100"
                    onClick={() => onCloneTask(task.task_id)}
                    aria-label={`Clone ${task.title}`}
                    data-testid={`excel-clone-${task.task_id}`}
                  >
                    ⧉
                  </button>
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
