'use client';

import { ReportTask } from '@/redux/features/reportsSlice';

interface ActiveTasksTableProps {
  tasks: ReportTask[];
}

export function ActiveTasksTable({ tasks }: ActiveTasksTableProps) {
  const activeTasks = tasks.filter(
    task => task.status === 'doing' || task.status === 'review'
  );
  if (activeTasks.length === 0) return null;

  return (
    <div className="card bg-base-100 shadow-md">
      <div className="card-body">
        <h2 className="card-title text-xl text-blue-600">
          Công việc đang thực hiện
        </h2>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Tên công việc</th>
                <th>Người thực hiện</th>
                <th>Hạn hoàn thành</th>
                <th>Tiến độ</th>
              </tr>
            </thead>
            <tbody>
              {activeTasks.map(task => (
                <tr key={task.taskId}>
                  <td>{task.title}</td>
                  <td>{task.assignee?.username || 'Chưa giao'}</td>
                  <td>
                    {task.plannedEndDate
                      ? new Date(task.plannedEndDate).toLocaleDateString('vi-VN')
                      : 'Không có hạn'}
                  </td>
                  <td>
                    <div className="relative pt-1">
                      <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                        <div
                          style={{ width: `${task.status === 'review' ? 90 : 50}%` }}
                          className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                            task.isDelayed ? 'bg-red-500' : 'bg-green-500'
                          }`}
                        />
                      </div>
                    </div>
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
