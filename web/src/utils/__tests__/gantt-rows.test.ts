/**
 * Gantt row-builder edge tests (herdr-260906 residual gap R1):
 * deep trees, orphans (missing/filtered parent), parent_id CYCLES, and
 * DUPLICATE entries must yield a finite, deduplicated row list.
 */
import {
  buildGanttTaskRows,
  reorderGanttSiblingTaskIds,
  sortGanttSiblingTaskIds,
} from '@/utils/ganttRows';

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

  it('moves a root subtree as a block while filtered sibling slots preserve hidden siblings', () => {
    const tasks = [
      t('hidden-root'), t('a'), t('a-child', 'a'), t('hidden-middle'), t('b'), t('b-child', 'b'),
    ];
    expect(reorderGanttSiblingTaskIds(tasks, 'b', 'a', new Set(['a', 'b'])))
      .toEqual(['hidden-root', 'b', 'b-child', 'hidden-middle', 'a', 'a-child']);
  });

  it('rejects foreign-parent, context-only, missing, and orphan drops', () => {
    const tasks = [t('root'), t('a', 'root'), t('b', 'root'), t('other'), t('child', 'other'), t('orphan', 'gone')];
    const expected = tasks.map((task) => task.task_id);
    const draggable = new Set(['a', 'b', 'child', 'orphan']);
    expect(reorderGanttSiblingTaskIds(tasks, 'a', 'child', draggable)).toEqual(expected);
    expect(reorderGanttSiblingTaskIds(tasks, 'root', 'a', draggable)).toEqual(expected);
    expect(reorderGanttSiblingTaskIds(tasks, 'missing', 'a', draggable)).toEqual(expected);
    expect(reorderGanttSiblingTaskIds(tasks, 'orphan', 'a', draggable)).toEqual(expected);
  });

  it('auto-sorts independently per sibling set with stable persisted ties and completed-last', () => {
    const tasks = [
      { ...t('root'), priority: 'LOW', status: 'TODO' },
      { ...t('a', 'root'), priority: 'MEDIUM', status: 'TODO' },
      { ...t('b', 'root'), priority: 'CRITICAL', status: 'TODO' },
      { ...t('c', 'root'), priority: 'CRITICAL', status: 'TODO' },
      { ...t('done', 'root'), priority: 'CRITICAL', status: 'DONE' },
      { ...t('child-low', 'a'), priority: 'LOW', status: 'TODO' },
      { ...t('child-high', 'a'), priority: 'HIGH', status: 'TODO' },
    ];
    expect(sortGanttSiblingTaskIds(tasks)).toEqual([
      'root', 'b', 'c', 'a', 'child-high', 'child-low', 'done',
    ]);
  });
});
