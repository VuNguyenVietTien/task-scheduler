import { Task } from '@/types/task';
import { format } from 'date-fns';

interface TaskDetailsProps {
  task: Task;
}

// Helper function to format dates consistently
const formatDateTime = (dateString: string | undefined) => {
  if (!dateString) return 'Not set';
  return format(new Date(dateString), 'dd/MM/yyyy HH:mm');
};

export function TaskDetails({ task }: TaskDetailsProps) {
  // Helper to calculate days remaining
  const calculateDaysRemaining = () => {
    if (!task.due_date) return null;
    
    const now = new Date();
    const dueDate = new Date(task.due_date);
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return `${Math.abs(diffDays)} days overdue`;
    }
    if (diffDays === 0) {
      return 'Due today';
    }
    return `${diffDays} days remaining`;
  };

  // Calculate status color
  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'DONE':
        return 'bg-green-100 text-green-800';
      case 'DOING':
        return 'bg-blue-100 text-blue-800';
      case 'BLOCKED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Format effort
  const formatEffort = (hours?: number) => {
    if (!hours) return 'Not estimated';
    const days = Math.floor(hours / 8);
    const remainingHours = hours % 8;
    
    if (days === 0) return `${hours}h`;
    if (remainingHours === 0) return `${days}d`;
    return `${days}d ${remainingHours}h`;
  };

  // Calculate progress
  const calculateProgress = () => {
    if (task.progress === undefined) return 'Not started';
    return `${task.progress}%`;
  };

  return (
    <div className="bg-white shadow-sm rounded-lg">
      {/* Header */}
      <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900">
          Task Details
        </h3>
      </div>

      {/* Content */}
      <div className="px-4 py-5 sm:p-6">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
          {/* Title */}
          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-gray-500">Title</dt>
            <dd className="mt-1 text-sm text-gray-900">{task.title}</dd>
          </div>

          {/* Description */}
          {task.description && (
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-gray-500">Description</dt>
              <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                {task.description}
              </dd>
            </div>
          )}

          {/* Status */}
          <div>
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                {task.status}
              </span>
            </dd>
          </div>

          {/* Priority */}
          <div>
            <dt className="text-sm font-medium text-gray-500">Priority</dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">
              {task.priority}
            </dd>
          </div>

          {/* Start Date */}
          <div>
            <dt className="text-sm font-medium text-gray-500">Start Date</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {formatDateTime(task.start_date)}
            </dd>
          </div>

          {/* Due Date */}
          <div>
            <dt className="text-sm font-medium text-gray-500">Due Date</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {formatDateTime(task.due_date)}
              {task.due_date && (
                <span className="ml-2 text-xs text-gray-500">
                  ({calculateDaysRemaining()})
                </span>
              )}
            </dd>
          </div>

          {/* Effort */}
          <div>
            <dt className="text-sm font-medium text-gray-500">Effort</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {formatEffort(task.effort)}
            </dd>
          </div>

          {/* Progress */}
          <div>
            <dt className="text-sm font-medium text-gray-500">Progress</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {calculateProgress()}
            </dd>
          </div>

          {/* Assignee */}
          <div>
            <dt className="text-sm font-medium text-gray-500">Assignee</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {task.assignee ? task.assignee.username : 'Unassigned'}
            </dd>
          </div>

          {/* Created By */}
          <div>
            <dt className="text-sm font-medium text-gray-500">Created By</dt>
            <dd className="mt-1 text-sm text-gray-900">{task.created_by}</dd>
          </div>

          {/* Created At */}
          <div>
            <dt className="text-sm font-medium text-gray-500">Created At</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {formatDateTime(task.created_at)}
            </dd>
          </div>

          {/* Last Updated */}
          <div>
            <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {formatDateTime(task.updated_at)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
