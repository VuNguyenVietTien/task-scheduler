import type { Task } from '@/types/task';
import { buildProjectBurndown, readBurndownPlan, type BurndownPlanTask } from '../project-burndown';

function task(taskId: string, values: Partial<Task> = {}): Task {
  return {
    task_id: taskId,
    project_id: 'project-1',
    title: taskId,
    priority_order: 1,
    status: 'TODO',
    priority: 'MEDIUM',
    created_by: 'user-1',
    ...values,
  };
}

function planTask(taskId: string, endDate: string, values: Partial<BurndownPlanTask> = {}): BurndownPlanTask {
  return { taskId, startDate: '2026-06-01', endDate, ...values };
}

describe('project task-count burndown', () => {
  it('uses saved membership and dates when daily hours are invalid', () => {
    const baseline = readBurndownPlan({
      version: 2,
      meta: { savedAt: '2026-06-01T00:00:00Z' },
      tasks: [
        {
          taskId: 'task-1', startDate: '2026-06-01', endDate: '2026-06-10', priorityOrder: 1,
          hoursPerDay: { '2026-05-31': 8 },
        },
        {
          taskId: 'task-2', startDate: '2026-06-01', endDate: '2026-06-20', priorityOrder: 2,
          hoursPerDay: { '2026-06-02': 'invalid' },
        },
      ],
    });
    const result = buildProjectBurndown(
      baseline.tasks,
      [
        task('task-1', { status: 'DONE', actual_end_date: '2026-06-08', updated_at: '2026-06-09' }),
        task('task-2', { status: 'DONE', updated_at: '2026-06-09' }),
      ],
      '2026-06-12',
      baseline.contextTasks
    );

    expect(baseline.tasks.map(({ taskId, endDate }) => ({ taskId, endDate }))).toEqual([
      { taskId: 'task-1', endDate: '2026-06-10' },
      { taskId: 'task-2', endDate: '2026-06-20' },
    ]);
    expect(result.totalTasks).toBe(2);
    expect(result.points.find((point) => point.date === '2026-06-12')).toMatchObject({
      plannedRemaining: 1,
      actualRemaining: 1,
    });
    expect(result.completedWithoutActualEndCount).toBe(1);
  });

  it('counts valid saved ends regardless of empty hours and never substitutes a legacy start', () => {
    const dated = readBurndownPlan({
      version: 2,
      meta: { savedAt: '' },
      tasks: [{ taskId: 'dated', startDate: '2026-06-01', endDate: '2026-06-10', hoursPerDay: {}, priorityOrder: 1 }],
    });
    const missingEnd = readBurndownPlan({
      version: 1,
      tasks: [{ task_id: 'missing-end', start_date: '2026-06-01', priority_order: 1 }],
    });
    const result = buildProjectBurndown(
      [...dated.tasks, ...missingEnd.tasks],
      [task('dated'), task('missing-end')],
      '2026-06-05'
    );

    expect(missingEnd.tasks[0].endDate).toBeUndefined();
    expect(result.totalTasks).toBe(1);
    expect(result.unscheduledCount).toBe(1);
    expect(result.scheduledRange).toEqual({ start: '2026-06-10', end: '2026-06-10' });
  });

  it('uses each saved revision end date against the same canonical actual end', () => {
    const current = [task('task-1', { status: 'DONE', actual_end_date: '2026-06-15T23:00:00Z' })];
    const earlyBaseline = buildProjectBurndown([planTask('task-1', '2026-06-10')], current, '2026-06-16');
    const lateBaseline = buildProjectBurndown([planTask('task-1', '2026-06-20')], current, '2026-06-16');

    expect(earlyBaseline.completedLateCount).toBe(1);
    expect(earlyBaseline.completedEarlyCount).toBe(0);
    expect(lateBaseline.completedEarlyCount).toBe(1);
    expect(lateBaseline.completedLateCount).toBe(0);
    expect(earlyBaseline.points.find((point) => point.date === '2026-06-12')).toMatchObject({ plannedRemaining: 0, actualRemaining: 1 });
    expect(lateBaseline.points.find((point) => point.date === '2026-06-16')).toMatchObject({ plannedRemaining: 1, actualRemaining: 0 });
    expect(lateBaseline.indicator).toBe('ahead');
    expect(lateBaseline.delta).toBe(-1);
  });

  it('keeps a completed-status task unfinished when actual end is missing', () => {
    const result = buildProjectBurndown(
      [planTask('task-1', '2026-06-10')],
      [task('task-1', { status: 'CLOSE' })],
      '2026-06-12'
    );

    expect(result.actualRemaining).toBe(1);
    expect(result.completedWithoutActualEndCount).toBe(1);
    expect(result.points.at(-1)?.actualRemaining).toBe(1);
    expect(result.indicator).toBe('behind');
  });

  it('counts only selected-plan leaves, including through snapshot context ancestors', () => {
    const result = buildProjectBurndown(
      [
        planTask('summary', '2026-06-20'),
        planTask('leaf', '2026-06-10', { parentTaskId: 'context-parent' }),
      ],
      [task('summary'), task('leaf', { parent_task_id: 'context-parent' })],
      '2026-06-05',
      [{ taskId: 'context-parent', parentTaskId: 'summary' }]
    );

    expect(result.totalTasks).toBe(1);
    expect(result.summaryCount).toBe(1);
    expect(result.plannedRemaining).toBe(1);
  });

  it('surfaces unscheduled, excluded, zero-effort, missing, and unplanned scope', () => {
    const result = buildProjectBurndown(
      [
        planTask('scheduled', '2026-06-10'),
        planTask('unscheduled', '2026-06-10', { unscheduled: true }),
        planTask('archived', '2026-06-10'),
        planTask('missing', '2026-06-10'),
      ],
      [
        task('scheduled', { effort: 0 }),
        task('archived', { status: 'ARCHIVED' }),
        task('unplanned'),
        task('unplanned-summary'),
        task('unplanned-child', { parent_task_id: 'unplanned-summary' }),
      ],
      '2026-06-05'
    );

    expect(result.totalTasks).toBe(2);
    expect(result.unscheduledCount).toBe(1);
    expect(result.excludedCount).toBe(1);
    expect(result.missingCurrentTaskCount).toBe(1);
    expect(result.zeroEffortCount).toBe(1);
    expect(result.unplannedTaskCount).toBe(2);
    expect(result.indicator).toBe('unavailable');
  });

  it('treats a missing or invalid plan end as unavailable instead of inventing a date', () => {
    const result = buildProjectBurndown(
      [{ taskId: 'task-1', startDate: '2026-06-01' }],
      [task('task-1', { actual_end_date: '2026-06-04' })],
      '2026-06-05'
    );

    expect(result.points).toEqual([]);
    expect(result.unscheduledCount).toBe(1);
    expect(result.indicator).toBe('unavailable');
  });
});
