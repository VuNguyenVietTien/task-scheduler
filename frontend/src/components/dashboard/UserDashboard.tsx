import React from 'react';
import { Task, TaskStatus, TaskStatuses } from '@/types/task';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import clsx from 'clsx';

interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  urgentTasks: number;
  upcomingDeadlines: number;
  averageCompletionTime: number;
  tasksByStatus: Record<TaskStatus, number>;
}

interface UserDashboardProps {
  tasks: Task[];
  stats: DashboardStats;
  onTaskClick: (taskId: string) => void;
  onFilter: (filter: { status?: TaskStatus }) => void;
}

type ChartData = {
  name: string;
  value: number;
  status: TaskStatus;
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  'todo': '#9ca3af',
  'pending': '#6366f1',
  'doing': '#eab308',
  'review': '#8b5cf6',
  'done': '#22c55e',
  'close': '#6b7280',
  'blocked': '#ff0000',
  'rejected': '#ff6b00',
  'archived': '#cccccc'
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  'todo': 'To Do',
  'pending': 'Pending',
  'doing': 'In Progress',
  'review': 'In Review',
  'done': 'Done',
  'close': 'Closed',
  'blocked': 'Blocked',
  'rejected': 'Rejected',
  'archived': 'Archived'
};

export const UserDashboard: React.FC<UserDashboardProps> = ({
  tasks,
  stats,
  onTaskClick,
  onFilter,
}) => {
  const completionPercentage = Math.round((stats.completedTasks / stats.totalTasks) * 100) || 0;

  const chartData: ChartData[] = Object.entries(stats.tasksByStatus).map(([status, count]) => ({
    name: STATUS_LABELS[status as TaskStatus] || status,
    value: count,
    status: status as TaskStatus,
  }));

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'No date';
    return new Date(dateString).toLocaleDateString();
  };

  const renderTaskList = (tasks: Task[]) => {
    if (tasks.length === 0) {
      return <p className="text-gray-500 text-center py-4">No tasks</p>;
    }

    return (
      <div className="space-y-2">
        {tasks.map(task => (
          <div
            key={task.task_id}
            className={clsx(
              'p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md',
              task.status === TaskStatuses.DONE
                ? 'border-green-200 bg-green-50'
                : 'border-gray-200 bg-white'
            )}
            onClick={() => onTaskClick(task.task_id)}
          >
            <h4 className="font-medium text-sm">{task.title}</h4>
            <p className="text-xs text-gray-500 mt-1">
              Due: {formatDate(task.deadline)}
            </p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Tasks</h3>
          <p className="mt-2 text-3xl font-semibold">{stats.totalTasks}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Completed</h3>
          <p className="mt-2 text-3xl font-semibold text-green-600">
            {stats.completedTasks}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Urgent</h3>
          <p className="mt-2 text-3xl font-semibold text-red-600">
            {stats.urgentTasks}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Upcoming Deadlines</h3>
          <p className="mt-2 text-3xl font-semibold text-yellow-600">
            {stats.upcomingDeadlines}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-4">Task Distribution</h3>
          <div className="h-64" data-testid="status-chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={STATUS_COLORS[entry.status]}
                    />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-4">Progress Overview</h3>
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Completion Rate</span>
              <span>{completionPercentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                role="progressbar"
                aria-valuenow={completionPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
          <div className="text-sm text-gray-600">
            Average Completion Time: {stats.averageCompletionTime} days
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-4">Recent Tasks</h3>
          {renderTaskList(tasks)}
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-4">Upcoming Deadlines</h3>
          <div data-testid="deadlines-list">
            {renderTaskList(
              tasks
                .filter(task => task.status !== TaskStatuses.DONE)
                .sort((a, b) => {
                  const dateA = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
                  const dateB = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
                  return dateA - dateB;
                })
                .slice(0, 5)
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4">Quick Filters</h3>
        <div className="flex gap-2 flex-wrap">
          {Object.values(TaskStatuses).map(status => (
            <button
              key={status}
              onClick={() => onFilter({ status })}
              className={clsx(
                'px-4 py-2 text-sm font-medium rounded-full transition-colors',
                'border border-gray-300 hover:bg-gray-50'
              )}
            >
              {STATUS_LABELS[status as TaskStatus]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
