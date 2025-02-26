/**
 * PriorityTaskCard Component
 * 
 * This component is a draggable element enabling task reordering.
 * Each card represents a task with:
 * - Priority color indicator
 * - Task title and status
 * - Start and end dates
 * - Effort hours
 */

import { Task, TaskStatus, Priority } from '@/types/task';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PriorityTaskCardProps {
  task: Task;
}

export function PriorityTaskCard({ task }: PriorityTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case Priority.URGENT:
        return 'border-l-4 border-l-red-600';
      case Priority.HIGH:
        return 'border-l-4 border-l-orange-600';
      case Priority.MEDIUM:
        return 'border-l-4 border-l-amber-600';
      case Priority.LOW:
        return 'border-l-4 border-l-green-600';
      default:
        return 'border-l-4 border-l-slate-600';
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.DONE:
        return 'text-green-600 bg-green-50';
      case TaskStatus.IN_PROGRESS:
        return 'text-blue-600 bg-blue-50';
      case TaskStatus.IN_REVIEW:
        return 'text-purple-600 bg-purple-50';
      case TaskStatus.PLANNED:
        return 'text-amber-600 bg-amber-50';
      case TaskStatus.BACKLOG:
        return 'text-slate-600 bg-slate-50';
      default:
        return 'text-slate-600 bg-slate-50';
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit'
    });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        group bg-white rounded-lg select-none relative
        ${getPriorityColor(task.priority)}
        ${isDragging 
          ? 'shadow-lg ring-2 ring-blue-500 scale-[1.02] z-50'
          : 'shadow-sm hover:shadow-md'
        }
        transition-all duration-100 ease-in-out
        touch-manipulation
      `}
    >
      {/* Drag Handle */}
      <div 
        className={`
          absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-0
          group-hover:opacity-50 rounded-l
          transition-opacity duration-150
          ${isDragging ? 'opacity-100' : ''}
        `}
      />

      <div className="p-3 space-y-2">
        {/* Task Header */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium text-slate-900 truncate">{task.title}</h3>
          <span 
            className={`
              shrink-0 px-2 py-0.5 rounded-full text-xs font-medium
              ${getStatusColor(task.status)}
            `}
          >
            {task.status.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Task Details */}
        <div className="flex items-center justify-between gap-2 text-sm text-slate-500">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1 shrink-0">
              {task.startDate ? (
                <>
                  <span className="text-xs font-medium">{formatDate(task.startDate)}</span>
                  <span className="text-slate-300">→</span>
                </>
              ) : (
                <span className="text-xs text-slate-400 italic">Not scheduled</span>
              )}
            </div>
            <span className="text-xs truncate">
              {task.deadline ? formatDate(task.deadline) : 'No deadline'}
            </span>
          </div>
          <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-medium shrink-0">
            {task.effortHours}h
          </span>
        </div>
      </div>
    </div>
  );
}
