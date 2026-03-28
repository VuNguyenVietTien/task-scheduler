'use client';

import { useState, useMemo } from 'react';
import { useAppSelector } from '@/redux/hooks';
import { ReportType } from '@/redux/features/reportsSlice';
import { ReportMetricsCard } from './report-metrics-card';

interface PeriodReportViewProps {
  projectId: string;
  reportType: ReportType;
  planId?: string;
}

/** Get default date range based on report type */
function getDefaultRange(type: ReportType): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  switch (type) {
    case 'weekly':
      start.setDate(end.getDate() - 7);
      break;
    case 'monthly':
      start.setDate(end.getDate() - 30);
      break;
    case 'quarterly':
      start.setDate(end.getDate() - 90);
      break;
    default:
      start.setDate(end.getDate() - 7);
  }
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

export function PeriodReportView({ projectId, reportType, planId }: PeriodReportViewProps) {
  const defaults = getDefaultRange(reportType);
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [generated, setGenerated] = useState(false);

  const { tasks } = useAppSelector(state => state.tasks);
  const { members } = useAppSelector(state => state.members);
  const { plans, activePlan } = useAppSelector(state => state.plans);

  // Get plan data for comparison
  const selectedPlan = useMemo(() => {
    if (!planId) return null;
    return plans.find(p => p.id === planId) || null;
  }, [planId, plans]);

  const planTasks = useMemo(() => {
    return selectedPlan?.planData?.tasks || [];
  }, [selectedPlan]);

  // Compute report data
  const reportData = useMemo(() => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Tasks relevant to this period: started, ended, or due within range
    const periodTasks = tasks.filter(task => {
      const actualStart = task.actual_start_date ? new Date(task.actual_start_date) : null;
      const actualEnd = task.actual_end_date ? new Date(task.actual_end_date) : null;
      const dueDate = task.due_date ? new Date(task.due_date) : null;

      return (
        (actualStart && actualStart >= start && actualStart <= end) ||
        (actualEnd && actualEnd >= start && actualEnd <= end) ||
        (dueDate && dueDate >= start && dueDate <= end)
      );
    });

    // Completed in period
    const completedInPeriod = periodTasks.filter(task => {
      if (!task.actual_end_date) return false;
      const endD = new Date(task.actual_end_date);
      return endD >= start && endD <= end &&
        (task.status === 'DONE' || task.status === 'CLOSE');
    });

    // Delayed: due in period but not done
    const delayedInPeriod = periodTasks.filter(task => {
      if (!task.due_date) return false;
      const dueD = new Date(task.due_date);
      return dueD >= start && dueD <= end &&
        task.status !== 'DONE' && task.status !== 'CLOSE' &&
        dueD < new Date();
    });

    // On-schedule vs plan comparison
    let onScheduleCount = 0;
    let lateCount = 0;
    const taskAnalysis: Array<{
      taskId: string;
      title: string;
      assignee: string;
      plannedStart: string | null;
      plannedEnd: string | null;
      actualStart: string | null;
      actualEnd: string | null;
      status: string;
      variance: string;
    }> = [];

    periodTasks.forEach(task => {
      const planTask = planTasks.find(
        (pt: any) => (pt.task_id || pt.taskId) === task.task_id
      );

      const plannedEnd = planTask?.end_date || task.due_date;
      const actualEnd = task.actual_end_date;
      let variance = 'N/A';

      if (plannedEnd && actualEnd) {
        const diff = Math.ceil(
          (new Date(actualEnd).getTime() - new Date(plannedEnd).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diff <= 0) {
          onScheduleCount++;
          variance = diff === 0 ? 'Đúng hạn' : `Sớm ${Math.abs(diff)} ngày`;
        } else {
          lateCount++;
          variance = `Trễ ${diff} ngày`;
        }
      } else if (plannedEnd && !actualEnd) {
        const dueD = new Date(plannedEnd);
        if (dueD < new Date() && task.status !== 'DONE' && task.status !== 'CLOSE') {
          lateCount++;
          const diff = Math.ceil((new Date().getTime() - dueD.getTime()) / (1000 * 60 * 60 * 24));
          variance = `Trễ ${diff} ngày (đang làm)`;
        } else {
          onScheduleCount++;
          variance = 'Đang thực hiện';
        }
      }

      taskAnalysis.push({
        taskId: task.task_id,
        title: task.title,
        assignee: task.assignee?.username || 'Chưa giao',
        plannedStart: planTask?.start_date || task.start_date || null,
        plannedEnd: planTask?.end_date || task.due_date || null,
        actualStart: task.actual_start_date || null,
        actualEnd: task.actual_end_date || null,
        status: task.status,
        variance,
      });
    });

    // Rejected tasks in period
    const rejectedCount = periodTasks.filter(t => t.status === 'REJECTED').length;

    // Bug count: tasks with type='Bug' in period
    const bugCount = periodTasks.filter(
      t => t.type?.toLowerCase() === 'bug'
    ).length;

    const total = periodTasks.length;
    const onSchedulePct = total > 0 ? Math.round((onScheduleCount / total) * 100) : 0;
    const delayPct = total > 0 ? Math.round((lateCount / total) * 100) : 0;

    return {
      total,
      completed: completedInPeriod.length,
      delayed: delayedInPeriod.length,
      onScheduleCount,
      lateCount,
      rejectedCount,
      bugCount,
      onSchedulePct,
      delayPct,
      taskAnalysis,
    };
  }, [tasks, startDate, endDate, planTasks]);

  // Date range validation
  const rangeValid = useMemo(() => {
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diffDays = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 365;
  }, [startDate, endDate]);

  const typeLabel = reportType === 'weekly' ? 'tuần' : reportType === 'monthly' ? 'tháng' : 'quý';

  return (
    <div className="space-y-6">
      {/* Date range picker */}
      <div className="card bg-base-100 shadow-md">
        <div className="card-body">
          <h2 className="card-title text-xl">Báo cáo {typeLabel}</h2>
          <div className="flex flex-wrap items-end gap-4 mt-2">
            <div>
              <label className="label"><span className="label-text">Từ ngày</span></label>
              <input
                type="date"
                className="input input-bordered"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label"><span className="label-text">Đến ngày</span></label>
              <input
                type="date"
                className="input input-bordered"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            {/* Preset buttons */}
            <div className="flex gap-2">
              <button
                className="btn btn-sm btn-outline"
                onClick={() => {
                  const e = new Date();
                  const s = new Date();
                  s.setDate(e.getDate() - 7);
                  setStartDate(s.toISOString().split('T')[0]);
                  setEndDate(e.toISOString().split('T')[0]);
                }}
              >7 ngày</button>
              <button
                className="btn btn-sm btn-outline"
                onClick={() => {
                  const e = new Date();
                  const s = new Date();
                  s.setDate(e.getDate() - 30);
                  setStartDate(s.toISOString().split('T')[0]);
                  setEndDate(e.toISOString().split('T')[0]);
                }}
              >30 ngày</button>
              <button
                className="btn btn-sm btn-outline"
                onClick={() => {
                  const e = new Date();
                  const s = new Date();
                  s.setDate(e.getDate() - 90);
                  setStartDate(s.toISOString().split('T')[0]);
                  setEndDate(e.toISOString().split('T')[0]);
                }}
              >90 ngày</button>
            </div>
            <button
              className="btn btn-primary btn-sm"
              disabled={!rangeValid}
              onClick={() => setGenerated(true)}
            >
              Tạo báo cáo
            </button>
          </div>
          {!rangeValid && (
            <p className="text-red-500 text-sm mt-1">Khoảng thời gian không hợp lệ (tối đa 365 ngày)</p>
          )}
        </div>
      </div>

      {generated && (
        <>
          {/* Performance summary */}
          <div className="card bg-base-100 shadow-md">
            <div className="card-body">
              <h2 className="card-title text-xl">Tổng quan hiệu suất</h2>
              <div className="mt-4">
                <ReportMetricsCard metrics={[
                  { label: 'Tổng công việc', value: reportData.total, bgColor: 'bg-blue-50' },
                  { label: 'Hoàn thành', value: reportData.completed, total: reportData.total, bgColor: 'bg-green-50' },
                  { label: 'Trễ hạn', value: reportData.delayed, total: reportData.total, bgColor: 'bg-red-50' },
                  { label: 'Đúng tiến độ', value: reportData.onScheduleCount, total: reportData.total, bgColor: 'bg-yellow-50' },
                ]} />
              </div>

              {/* Progress bars */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Đúng tiến độ</span>
                    <span className="text-green-600 font-medium">{reportData.onSchedulePct}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="bg-green-500 h-3 rounded-full" style={{ width: `${reportData.onSchedulePct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Trễ tiến độ</span>
                    <span className="text-red-600 font-medium">{reportData.delayPct}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="bg-red-500 h-3 rounded-full" style={{ width: `${reportData.delayPct}%` }} />
                  </div>
                </div>
              </div>

              {/* Extra metrics */}
              <div className="flex gap-6 mt-4 text-sm">
                <div>Bị từ chối: <span className="font-medium">{reportData.rejectedCount}</span></div>
                <div>Bugs: <span className="font-medium text-orange-600">{reportData.bugCount}</span></div>
              </div>
            </div>
          </div>

          {/* Task analysis table */}
          {reportData.taskAnalysis.length > 0 && (
            <div className="card bg-base-100 shadow-md">
              <div className="card-body">
                <h2 className="card-title text-xl">Chi tiết công việc</h2>
                <div className="overflow-x-auto">
                  <table className="table table-sm w-full">
                    <thead>
                      <tr>
                        <th>Tên công việc</th>
                        <th>Người thực hiện</th>
                        <th>Kế hoạch bắt đầu</th>
                        <th>Kế hoạch kết thúc</th>
                        <th>Thực tế bắt đầu</th>
                        <th>Thực tế kết thúc</th>
                        <th>Trạng thái</th>
                        <th>Chênh lệch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.taskAnalysis.map(row => (
                        <tr key={row.taskId}>
                          <td className="max-w-[200px] truncate">{row.title}</td>
                          <td>{row.assignee}</td>
                          <td>{row.plannedStart ? new Date(row.plannedStart).toLocaleDateString('vi-VN') : '-'}</td>
                          <td>{row.plannedEnd ? new Date(row.plannedEnd).toLocaleDateString('vi-VN') : '-'}</td>
                          <td>{row.actualStart ? new Date(row.actualStart).toLocaleDateString('vi-VN') : '-'}</td>
                          <td>{row.actualEnd ? new Date(row.actualEnd).toLocaleDateString('vi-VN') : '-'}</td>
                          <td>
                            <span className={`px-2 py-0.5 rounded text-xs text-white ${
                              row.status === 'DONE' || row.status === 'CLOSE' ? 'bg-green-500' :
                              row.status === 'DOING' || row.status === 'REVIEW' ? 'bg-blue-500' :
                              row.status === 'BLOCKED' ? 'bg-red-500' :
                              row.status === 'REJECTED' ? 'bg-gray-500' :
                              'bg-slate-400'
                            }`}>
                              {row.status}
                            </span>
                          </td>
                          <td className={
                            row.variance.includes('Trễ') ? 'text-red-600 font-medium' :
                            row.variance.includes('Sớm') || row.variance === 'Đúng hạn' ? 'text-green-600' :
                            'text-gray-500'
                          }>
                            {row.variance}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Summary row */}
                <div className="flex gap-6 mt-2 text-sm font-medium border-t pt-2">
                  <span>Tổng: {reportData.taskAnalysis.length}</span>
                  <span className="text-green-600">Đúng hạn: {reportData.onScheduleCount}</span>
                  <span className="text-red-600">Trễ: {reportData.lateCount}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
