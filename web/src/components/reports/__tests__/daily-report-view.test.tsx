import { renderHook } from '@testing-library/react';
import { useAppSelector } from '@/redux/hooks';
import { useDailyReportData } from '../daily-report-view';
import { countTasksByStatus, distinctTaskPopulation } from '../task-population';

jest.mock('@/redux/hooks', () => ({ useAppSelector: jest.fn() }));

const task = (task_id: string, status: string, extra: Record<string, unknown> = {}) => ({
  task_id,
  title: task_id,
  status,
  priority: 'MEDIUM',
  project_id: 'project-1',
  priority_order: 0,
  created_by: 'user-1',
  ...extra,
});

describe('useDailyReportData task population', () => {
  it('counts nested tasks once and applies daily filters to descendants', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const child = task('child', 'DONE', { actual_end_date: today.toISOString(), due_date: yesterday.toISOString() });
    const grandchild = task('grandchild', 'BLOCKED', { due_date: yesterday.toISOString(), type: 'Bug' });
    const roots = [
      task('root', 'TODO', { due_date: tomorrow.toISOString(), child_tasks: [{ ...child, child_tasks: [grandchild] }] }),
      child,
    ];
    const state = {
      tasks: { tasks: roots },
      members: { members: [] },
      plans: { activePlan: null },
    };
    (useAppSelector as jest.Mock).mockImplementation(selector => selector(state));

    const { result } = renderHook(() => useDailyReportData('project-1'));

    expect(result.current.report).toMatchObject({
      totalTasks: 3,
      completedTasks: 1,
      delayedTasks: 1,
      onScheduleTasks: 1,
      totalBugs: 1,
    });
    expect(result.current.report.tasks?.map(task => task.taskId)).toEqual(['root', 'child', 'grandchild']);
    expect(countTasksByStatus(distinctTaskPopulation<any>(roots))).toEqual({ TODO: 1, DONE: 1, BLOCKED: 1 });
  });

  it('returns an empty aggregate for an empty forest', () => {
    const state = {
      tasks: { tasks: [] },
      members: { members: [] },
      plans: { activePlan: null },
    };
    (useAppSelector as jest.Mock).mockImplementation(selector => selector(state));

    const { result } = renderHook(() => useDailyReportData('project-1'));

    expect(result.current.report.totalTasks).toBe(0);
    expect(result.current.report.tasks).toEqual([]);
  });
});
