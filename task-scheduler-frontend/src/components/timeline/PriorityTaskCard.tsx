import { Task, TaskStatus, Priority } from '@/types/task';
import { Draggable } from 'react-beautiful-dnd';

interface PriorityTaskCardProps {
  task: Task;
  index: number;
}

export function PriorityTaskCard({ task, index }: PriorityTaskCardProps) {
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
        return 'text-green-600';
      case TaskStatus.IN_PROGRESS:
        return 'text-blue-600';
      case TaskStatus.IN_REVIEW:
        return 'text-purple-600';
      case TaskStatus.PLANNED:
        return 'text-amber-600';
      case TaskStatus.BACKLOG:
        return 'text-slate-600';
      default:
        return 'text-slate-600';
    }
  };

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`
            p-4 mb-2 bg-white rounded-lg select-none
            ${getPriorityColor(task.priority)}
            ${snapshot.isDragging 
              ? 'shadow-lg ring-2 ring-blue-500 rotate-1 scale-105 z-50'
              : 'shadow-sm hover:shadow-md'
            }
            transform transition-all duration-200 
            cursor-grab active:cursor-grabbing
            hover:-translate-y-0.5
          `}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-slate-900">{task.title}</h3>
              <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(task.status)}`}>
                {task.status.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <span className="text-xs">
                  {task.startDate && new Date(task.startDate).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit'
                  })}
                </span>
                <span className="text-slate-300">→</span>
                <span className="text-xs">
                  {task.deadline && new Date(task.deadline).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit'
                  })}
                </span>
              </div>
              <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">
                {task.effortHours}h
              </span>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
