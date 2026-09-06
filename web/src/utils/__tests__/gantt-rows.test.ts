/**
 * Gantt row-builder edge tests (herdr-260906 residual gap R1):
 * deep trees, orphans (missing/filtered parent), parent_id CYCLES, and
 * DUPLICATE entries must yield a finite, deduplicated row list.
 */
import { buildGanttTaskRows } from '@/utils/ganttRows';

const t = (task_id: string, parent_task_id?: string) => ({ task_id, parent_task_id: parent_task_id ?? null });

describe('buildGanttTaskRows', () => {
  it('parent/child rows with depth indent', () => {
    const rows = buildGanttTaskRows([t('a'), t('b', 'a'), t('c', 'b')]);
    expect(rows.map((r) => [r.task.task_id, r.depth])).toEqual([
      ['a', 0], ['b', 1], ['c', 2],
    ]);
  });

  it('DEEP tree (6+ levels) renders fully', () => {
    const tasks = [t('l0')];
    for (let i = 1; i <= 6; i++) tasks.push(t(`l${i}`, `l${i - 1}`));
    const rows = buildGanttTaskRows(tasks);
    expect(rows).toHaveLength(7);
    expect(rows[6].depth).toBe(6);
  });

  it('ORPHAN (parent missing/filtered) is emitted at depth 0, not dropped', () => {
    const rows = buildGanttTaskRows([t('a'), t('ghost-child', 'nope')]);
    const ids = rows.map((r) => r.task.task_id);
    expect(ids).toContain('ghost-child');
    expect(rows.find((r) => r.task.task_id === 'ghost-child')!.depth).toBe(0);
    expect(rows.find((r) => r.task.task_id === 'a')!.depth).toBe(0);
  });

  it('CYCLE (a→b→a) terminates and emits each task exactly once', () => {
    const rows = buildGanttTaskRows([t('a', 'b'), t('b', 'a'), t('root')]);
    const ids = rows.map((r) => r.task.task_id).sort();
    expect(ids).toEqual(['a', 'b', 'root']);
    expect(rows).toHaveLength(3);
  });

  it('longer cycle + tail descendant terminates with everything present', () => {
    const rows = buildGanttTaskRows([
      t('x', 'z'), t('y', 'x'), t('z', 'y'), t('tail', 'z'),
    ]);
    const ids = rows.map((r) => r.task.task_id).sort();
    expect(ids).toEqual(['tail', 'x', 'y', 'z']);
  });

  it('DUPLICATE entries emit exactly one row per task_id (first wins)', () => {
    const rows = buildGanttTaskRows([t('a'), t('a'), t('b', 'a'), t('b', 'a')]);
    expect(rows.map((r) => r.task.task_id)).toEqual(['a', 'b']);
  });
});
