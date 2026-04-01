'use client';

import { ReportTask } from '@/redux/features/reportsSlice';

interface DelayedTasksTableProps {
  tasks: ReportTask[];
}

const statusBgColor: Record<string, string> = {
  todo: 'bg-slate-500',
  doing: 'bg-blue-500',
  review: 'bg-yellow-500',
  blocked: 'bg-red-500',
};

export function DelayedTasksTable({ tasks }: DelayedTasksTableProps) {
  const delayedTasks = tasks.filter(task => task.isDelayed);
  if (delayedTasks.length === 0) return null;

  return (
    <div className="card bg-base-100 shadow-md">
      <div className="card-body">
        <h2 className="card-title text-xl text-red-600">
          Công việc trễ hạn
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
              {delayedTasks.map(task => (
                <tr key={task.taskId}>
                  <td>{task.title}</td>
                  <td>{task.assignee?.username || 'Chưa giao'}</td>
                  <td>
                    {task.plannedEndDate
                      ? new Date(task.plannedEndDate).toLocaleDateString()
                      : 'Không có hạn'}
                  </td>
                  <td>
                    <span className={`px-2 py-1 rounded text-white ${statusBgColor[task.status] || 'bg-gray-500'}`}>
                      {task.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
