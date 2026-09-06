'use client';

/**
 * Timesheet / logwork screen for the CURRENT user (requirement 8).
 *
 * Reachable at /projects/[id]/timesheet. Week grid of project tasks × days:
 *  - loads existing entries via `my_timesheet_entries` (server enforces that
 *    the caller is a project member and only ever returns their own rows),
 *  - grid copy (native text selection) + TSV paste anchored at the focused
 *    cell (Excel-compatible),
 *  - per-cell validation (0 < h ≤ 24) with visible errors,
 *  - explicit "Batch Save" via `save_timesheet_batch` — the backend upserts
 *    on (user_id, task_id, work_date) so re-saving a day CANNOT duplicate
 *    entries; failures are reported per row and stay in the grid.
 */
import { Suspense, useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { GET_PROJECT_TASKS } from '@/graphql/queries/tasks';
import {
  TIMESHEET_ENTRIES_QUERY,
  SAVE_TIMESHEET_BATCH,
} from '@/graphql/scheduling';
import { toast } from 'sonner';

function key(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface EntryRow {
  id: string;
  project_id: string;
  user_id: string;
  task_id: string;
  work_date: string;
  hours: number;
  note: string | null;
}

interface TaskRow {
  task_id: string;
  title: string;
  status?: string;
}

/** Validate one pasted/typed cell. Returns error message or null. */
export function validateHoursCell(raw: string): { hours: number } | { error: string } {
  const value = raw.trim().replace(/h$/i, '');
  if (value === '') return { hours: 0 };
  const num = Number(value);
  if (Number.isNaN(num) || num < 0 || num > 24) {
    return { error: `Invalid hours "${raw}" (0–24)` };
  }
  return { hours: num };
}

/** Parse a TSV clipboard block into rows×cols strings. */
export function parseTimesheetTsv(text: string): string[][] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line, idx, arr) => !(line === '' && idx === arr.length - 1))
    .map((line) => line.split('\t'));
}

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

function TimesheetContent({ projectId }: { projectId: string }) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [weekStart]
  );
  const from = key(days[0]);
  const to = key(days[6]);

  // staged: `${taskId}|${dateKey}` -> hours (only non-zero staged cells save)
  const [staged, setStaged] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [anchorCell, setAnchorCell] = useState<{ row: number; col: number }>({ row: 0, col: 0 });

  const tasksQ = useQuery(GET_PROJECT_TASKS, {
    variables: { projectId },
    fetchPolicy: 'cache-and-network',
  });
  const entriesQ = useQuery(TIMESHEET_ENTRIES_QUERY, {
    variables: { project_id: projectId, from, to },
    fetchPolicy: 'cache-and-network',
  });
  const [saveBatch] = useMutation(SAVE_TIMESHEET_BATCH);

  const tasks: TaskRow[] = tasksQ.data?.tasks ?? [];
  const entries: EntryRow[] = entriesQ.data?.my_timesheet_entries ?? [];
  const savedHours = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) map[`${e.task_id}|${e.work_date}`] = e.hours;
    return map;
  }, [entries]);

  const cellKey = (taskId: string, dateKey: string) => `${taskId}|${dateKey}`;
  const cellValue = (taskId: string, dateKey: string): string => {
    const k = cellKey(taskId, dateKey);
    if (k in staged) return staged[k] === 0 ? '' : String(staged[k]);
    return savedHours[k] !== undefined ? String(savedHours[k]) : '';
  };

  const setCell = useCallback((taskId: string, dateKey: string, raw: string) => {
    const result = validateHoursCell(raw);
    if ('error' in result) {
      setErrors((prev) => [...prev, `${taskId} ${dateKey}: ${result.error}`]);
      return;
    }
    setStaged((prev) => ({ ...prev, [cellKey(taskId, dateKey)]: result.hours }));
  }, []);

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (!text || tasks.length === 0) return;
    e.preventDefault();
    const rows = parseTimesheetTsv(text);
    const newErrors: string[] = [];
    rows.forEach((cells, dr) => {
      cells.forEach((cellText, dc) => {
        const r = anchorCell.row + dr;
        const c = anchorCell.col + dc;
        if (r >= tasks.length || c >= 7) return; // clipped to grid
        const result = validateHoursCell(cellText);
        if ('error' in result) {
          newErrors.push(`Row ${r + 1} ${key(days[c])}: ${result.error}`);
        } else {
          setStaged((prev) => ({
            ...prev,
            [cellKey(tasks[r].task_id, key(days[c]))]: result.hours,
          }));
        }
      });
    });
    setErrors(newErrors);
  };

  const stagedNonZero = useMemo(
    () => Object.entries(staged).filter(([, h]) => h > 0),
    [staged]
  );

  const handleBatchSave = async () => {
    if (stagedNonZero.length === 0) return;
    setSaving(true);
    setErrors([]);
    try {
      const res = await saveBatch({
        variables: {
          input: {
            project_id: projectId,
            entries: stagedNonZero.map(([k, hours]) => {
              const [task_id, work_date] = k.split('|');
              return { task_id, work_date, hours };
            }),
          },
        },
      });
      const result = res.data?.save_timesheet_batch;
      if (result?.errors?.length) {
        setErrors(result.errors.map((er: { row: number; message: string }) => `Row ${er.row + 1}: ${er.message}`));
      }
      toast.success(`Saved ${result?.saved ?? 0} timesheet entries`);
      setStaged({});
      entriesQ.refetch();
    } catch (e) {
      setErrors([(e as Error).message]);
    } finally {
      setSaving(false);
    }
  };

  const shiftWeek = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(mondayOf(d));
    setStaged({});
    setErrors([]);
  };

  return (
    <div className="p-4 space-y-4" data-testid="timesheet-screen">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">My timesheet</h1>
        <button className="px-3 py-1 border rounded" onClick={() => shiftWeek(-1)} aria-label="Previous week">‹ Prev</button>
        <span className="text-sm">
          {from} → {to}
        </span>
        <button className="px-3 py-1 border rounded" onClick={() => shiftWeek(1)} aria-label="Next week">Next ›</button>
        <span className="flex-1" />
        {stagedNonZero.length > 0 && (
          <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs" data-testid="timesheet-dirty-count">
            {stagedNonZero.length} unsaved
          </span>
        )}
        <button
          className="px-4 py-1.5 bg-emerald-600 text-white rounded text-sm disabled:opacity-40"
          onClick={handleBatchSave}
          disabled={saving || stagedNonZero.length === 0}
          data-testid="timesheet-save-btn"
        >
          {saving ? 'Saving…' : 'Batch Save'}
        </button>
      </div>

      <div className="text-xs text-slate-500">
        Click a cell to anchor, then paste TSV from Excel/Sheets. Values 0–24h. Saving updates your existing entries (no duplicates).
      </div>

      <div className="overflow-auto border rounded-lg bg-white" onPaste={handlePaste} data-testid="timesheet-grid">
        <table className="min-w-full text-xs border-collapse">
          <thead className="bg-slate-50">
            <tr>
              <th className="border border-slate-200 px-2 py-1 text-left min-w-[200px]">Task</th>
              {days.map((d) => (
                <th key={key(d)} className="border border-slate-200 px-2 py-1 w-16">
                  {d.toLocaleDateString(undefined, { weekday: 'short' })}
                  <div className="text-slate-400">{key(d).slice(5)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.map((task, row) => (
              <tr key={task.task_id}>
                <td className="border border-slate-200 px-2 py-1">
                  {task.title}
                  <span className="text-slate-400 ml-1">{task.status}</span>
                </td>
                {days.map((d, col) => {
                  const k = cellKey(task.task_id, key(d));
                  const isStaged = k in staged && staged[k] > 0;
                  const isCleared = k in staged && staged[k] === 0 && savedHours[k] !== undefined;
                  return (
                    <td
                      key={key(d)}
                      className={`border border-slate-200 p-0 ${isStaged || isCleared ? 'bg-amber-100' : ''}`}
                      onClick={() => setAnchorCell({ row, col })}
                    >
                      <input
                        className="w-full h-8 px-1 text-center focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent"
                        aria-label={`${task.title} ${key(d)} hours`}
                        value={cellValue(task.task_id, key(d))}
                        onChange={(e) => setCell(task.task_id, key(d), e.target.value)}
                        onFocus={() => setAnchorCell({ row, col })}
                        data-testid={`ts-cell-${task.task_id}-${key(d)}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  {tasksQ.loading ? 'Loading tasks…' : 'No tasks in this project'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {errors.length > 0 && (
        <ul className="text-xs text-red-600 border rounded p-2 bg-red-50" data-testid="timesheet-errors">
          {errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TimesheetPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="p-6">Loading…</div>}>
        <TimesheetRoute />
      </Suspense>
    </ProtectedRoute>
  );
}

function TimesheetRoute() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id;
  if (!projectId) return <div className="p-6">Missing project id</div>;
  return <TimesheetContent projectId={projectId} />;
}
