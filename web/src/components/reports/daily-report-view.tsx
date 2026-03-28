'use client';

import { useMemo } from 'react';
import { useAppSelector } from '@/redux/hooks';
import { Report, ReportTask } from '@/redux/features/reportsSlice';
import { ReportMetricsCard } from './report-metrics-card';
import { DelayedTasksTable } from './delayed-tasks-table';
import { ActiveTasksTable } from './active-tasks-table';
import { CompletedTasksTable } from './completed-tasks-table';

interface DailyReportViewProps {
  projectId: string;
  onSummaryChange?: (summary: string) => void;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

interface OverduePlanTask {
  taskId: string;
  title: string;
  assignee: string;
  planStartDate: string;
  status: string;
  daysBehind: number;
}

/** Build daily report from Redux tasks + members + plan data */
export function useDailyReportData(projectId: string) {
  const { tasks } = useAppSelector(state => state.tasks);
  const { members } = useAppSelector(state => state.members);
  const { activePlan } = useAppSelector(state => state.plans);

  return useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    // Plan task lookup: task_id -> plan task data
    const planTasks = activePlan?.planData?.tasks || [];
    const planTaskMap = new Map<string, any>();
    planTasks.forEach((pt: any) => {
      const id = pt.task_id || pt.taskId;
      if (id) planTaskMap.set(id, pt);
    });

    // completedTasks = tasks completed TODAY
    const completedTasks = tasks.filter(task => {
      if (!task.actual_end_date) return false;
      return isSameDay(new Date(task.actual_end_date), today);
    });

    // delayedTasks = tasks with due_date < today AND status not done/close
    const delayedTasks = tasks.filter(task => {
      if (!task.due_date) return false;
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today && task.status !== 'DONE' && task.status !== 'CLOSE';
    });

    // onScheduleTasks = active tasks with due_date >= today
    const onScheduleTasks = tasks.filter(task => {
      if (!task.due_date) return false;
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate >= today &&
        task.status !== 'DONE' && task.status !== 'CLOSE' && task.status !== 'BLOCKED';
    });

    // FIX: scheduledToStartToday = tasks with plan start_date = today
    const scheduledToStartToday = tasks.filter(task => {
      const planTask = planTaskMap.get(task.task_id);
      const planStart = planTask?.start_date;
      if (!planStart) return false;
      return isSameDay(new Date(planStart), today);
    });

    // actuallyStartedToday = tasks where actual_start_date = today
    const actuallyStartedToday = tasks.filter(task => {
      if (!task.actual_start_date) return false;
      return isSameDay(new Date(task.actual_start_date), today);
    });

    // FIX: overdue from plan = today > plan.start_date but status is still todo/pending/blocked
    const overduePlanTasks: OverduePlanTask[] = [];
    tasks.forEach(task => {
      const planTask = planTaskMap.get(task.task_id);
      if (!planTask?.start_date) return;
      const planStart = new Date(planTask.start_date);
      planStart.setHours(0, 0, 0, 0);
      // Past plan start date but not yet actively being worked on
      if (planStart < today && ['TODO', 'PENDING', 'BLOCKED'].includes(task.status)) {
        const daysBehind = Math.ceil((today.getTime() - planStart.getTime()) / (1000 * 60 * 60 * 24));
        overduePlanTasks.push({
          taskId: task.task_id,
          title: task.title,
          assignee: task.assignee?.username || 'Chưa giao',
          planStartDate: planTask.start_date,
          status: task.status,
          daysBehind,
        });
      }
    });

    // Unassigned members
    const assignedUserIds = new Set(
      tasks
        .filter(task => task.assignee && task.status !== 'DONE' && task.status !== 'CLOSE')
        .map(task => task.assignee?.userId)
        .filter(Boolean)
    );
    const unassignedUsers = members
      .filter(member => !assignedUserIds.has(member.user?.userId ?? member.userId))
      .map(member => member.user?.username ?? 'Unknown');

    // Bug count
    const bugTasks = tasks.filter(
      task => task.type?.toLowerCase() === 'bug' && task.status !== 'DONE' && task.status !== 'CLOSE'
    );

    const reportTasks: ReportTask[] = tasks.map(task => ({
      taskId: task.task_id,
      title: task.title,
      assignee: task.assignee,
      plannedStartDate: task.start_date,
      plannedEndDate: task.due_date,
      actualStartDate: task.actual_start_date,
      actualEndDate: task.actual_end_date,
      status: task.status,
      isDelayed: (() => {
        if (!task.due_date) return false;
        const dd = new Date(task.due_date);
        dd.setHours(0, 0, 0, 0);
        return dd < today && task.status !== 'DONE' && task.status !== 'CLOSE';
      })(),
      delayReason: undefined,
    }));

    const report: Omit<Report, 'id' | 'createdAt' | 'updatedAt'> = {
      reportType: 'daily',
      reportDate: today.toISOString().split('T')[0],
      periodStartDate: yesterday.toISOString().split('T')[0],
      periodEndDate: today.toISOString().split('T')[0],
      totalTasks: tasks.length,
      completedTasks: completedTasks.length,
      delayedTasks: delayedTasks.length,
      onScheduleTasks: onScheduleTasks.length,
      newStartedTasks: scheduledToStartToday.length,
      unassignedResources: unassignedUsers,
      totalBugs: bugTasks.length,
      criticalBugs: 0,
      majorBugs: 0,
      minorBugs: 0,
      resolvedBugs: 0,
      summary: `Báo cáo ngày ${today.toLocaleDateString('vi-VN')}`,
      tasks: reportTasks,
    };

    return {
      report,
      scheduledToStartToday,
      actuallyStartedToday,
      overduePlanTasks,
      unassignedUsers,
      bugTasks,
    };
  }, [tasks, members, activePlan]);
}

export function DailyReportView({ projectId, onSummaryChange }: DailyReportViewProps) {
  const {
    report, scheduledToStartToday, actuallyStartedToday,
    overduePlanTasks, unassignedUsers, bugTasks,
  } = useDailyReportData(projectId);

  const metrics = [
    { label: 'Tổng số công việc', value: report.totalTasks, bgColor: 'bg-blue-50' },
    { label: 'Đã hoàn thành hôm nay', value: report.completedTasks, total: report.totalTasks, bgColor: 'bg-green-50' },
    { label: 'Bị trễ', value: report.delayedTasks, total: report.totalTasks, bgColor: 'bg-red-50' },
    { label: 'Đúng tiến độ', value: report.onScheduleTasks, total: report.totalTasks, bgColor: 'bg-yellow-50' },
  ];

  const reportTasks = report.tasks || [];

  return (
    <div className="space-y-6">
      {/* Overview metrics */}
      <div className="card bg-base-100 shadow-md">
        <div className="card-body">
          <h2 className="card-title text-xl">
            Thông tin tổng quan - {new Date(report.reportDate).toLocaleDateString('vi-VN')}
          </h2>
          <div className="mt-4">
            <ReportMetricsCard metrics={metrics} />
          </div>
          <div className="mt-4 space-y-1">
            <div className="font-medium">
              Theo kế hoạch bắt đầu hôm nay: {scheduledToStartToday.length}
            </div>
            <div className="font-medium">
              Thực tế bắt đầu hôm nay: {actuallyStartedToday.length}
            </div>
            {unassignedUsers.length > 0 && (
              <div className="font-medium">
                Thành viên chưa được giao việc: {unassignedUsers.join(', ')}
              </div>
            )}
            {bugTasks.length > 0 && (
              <div className="font-medium text-orange-600">
                Bugs chưa xử lý: {bugTasks.length}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overdue from plan - tasks that should have started but haven't */}
      {overduePlanTasks.length > 0 && (
        <div className="card bg-base-100 shadow-md border-l-4 border-orange-500">
          <div className="card-body">
            <h2 className="card-title text-xl text-orange-600">
              Công việc chưa bắt đầu theo kế hoạch ({overduePlanTasks.length})
            </h2>
            <p className="text-sm text-gray-500 mb-2">
              Các công việc đã qua ngày bắt đầu theo kế hoạch nhưng chưa được thực hiện
            </p>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Tên công việc</th>
                    <th>Người thực hiện</th>
                    <th>Ngày bắt đầu (KH)</th>
                    <th>Trạng thái</th>
                    <th>Trễ (ngày)</th>
                  </tr>
                </thead>
                <tbody>
                  {overduePlanTasks.map(task => (
                    <tr key={task.taskId} className="hover">
                      <td>{task.title}</td>
                      <td>{task.assignee}</td>
                      <td>{new Date(task.planStartDate).toLocaleDateString('vi-VN')}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded text-xs text-white ${
                          task.status === 'BLOCKED' ? 'bg-red-500' :
                          task.status === 'PENDING' ? 'bg-yellow-500' : 'bg-slate-400'
                        }`}>{task.status}</span>
                      </td>
                      <td className="text-red-600 font-medium">{task.daysBehind}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Scheduled to start today */}
      {scheduledToStartToday.length > 0 && (
        <div className="card bg-base-100 shadow-md">
          <div className="card-body">
            <h2 className="card-title text-xl text-purple-600">
              Công việc dự kiến bắt đầu hôm nay ({scheduledToStartToday.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Tên công việc</th>
                    <th>Người thực hiện</th>
                    <th>Hạn hoàn thành</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduledToStartToday.map(task => (
                    <tr key={task.task_id}>
                      <td>{task.title}</td>
                      <td>{task.assignee?.username || 'Chưa giao'}</td>
                      <td>
                        {task.due_date
                          ? new Date(task.due_date).toLocaleDateString('vi-VN')
                          : 'Không có hạn'}
                      </td>
                      <td>
                        <span className={`px-2 py-0.5 rounded text-xs text-white ${
                          task.status === 'DOING' ? 'bg-blue-500' :
                          task.status === 'TODO' ? 'bg-slate-400' : 'bg-gray-500'
                        }`}>{task.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Task tables */}
      <DelayedTasksTable tasks={reportTasks} />
      <ActiveTasksTable tasks={reportTasks} />
      <CompletedTasksTable tasks={reportTasks} />

      {/* Summary */}
      <div className="card bg-base-100 shadow-md">
        <div className="card-body">
          <h2 className="card-title text-xl">Ghi chú tổng kết</h2>
          <textarea
            className="textarea textarea-bordered w-full h-32"
            placeholder="Nhập ghi chú cho báo cáo này..."
            defaultValue={report.summary || ''}
            onChange={(e) => onSummaryChange?.(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
