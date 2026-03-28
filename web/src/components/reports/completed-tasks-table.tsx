'use client';

import { ReportTask } from '@/redux/features/reportsSlice';

interface CompletedTasksTableProps {
  tasks: ReportTask[];
}

export function CompletedTasksTable({ tasks }: CompletedTasksTableProps) {
  const completedTasks = tasks.filter(
    task => task.status === 'DONE' || task.status === 'CLOSE'
  );
  if (completedTasks.length === 0) return null;

  return (
    <div className="card bg-base-100 shadow-md">
      <div className="card-body">
        <h2 className="card-title text-xl text-green-600">
          Công việc đã hoàn thành
        </h2>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Tên công việc</th>
                <th>Người thực hiện</th>
                <th>Ngày hoàn thành</th>
              </tr>
            </thead>
            <tbody>
              {completedTasks.map(task => (
                <tr key={task.taskId}>
                  <td>{task.title}</td>
                  <td>{task.assignee?.username || 'Không xác định'}</td>
                  <td>
                    {task.actualEndDate
                      ? new Date(task.actualEndDate).toLocaleDateString('vi-VN')
                      : 'Không có dữ liệu'}
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
