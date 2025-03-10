'use client';

import { Task, TaskStatus } from '@/types/task';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableTaskItem } from './SortableTaskItem';

interface DroppableColumnProps {
  id: TaskStatus;
  title: string;
  tasks: Task[];
  isLastDroppable?: boolean;
}

const getColumnColor = (status: TaskStatus, isOver: boolean) => {
  const baseColors = {
    todo: 'bg-gradient-to-b from-slate-50 to-slate-100',
    doing: 'bg-gradient-to-b from-blue-50 to-blue-100',
    pending: 'bg-gradient-to-b from-orange-50 to-orange-100',
    review: 'bg-gradient-to-b from-purple-50 to-purple-100',
    blocked: 'bg-gradient-to-b from-red-50 to-red-100',
    done: 'bg-gradient-to-b from-green-50 to-green-100',
    close: 'bg-gradient-to-b from-slate-100 to-slate-200',
    rejected: 'bg-gradient-to-b from-slate-100 to-slate-200', 
    archived: 'bg-gradient-to-b from-slate-100 to-slate-200'
  };

  const highlightColors = {
    todo: 'ring-slate-400 bg-gradient-to-b from-slate-100 to-slate-200',
    doing: 'ring-blue-400 bg-gradient-to-b from-blue-100 to-blue-200',
    pending: 'ring-orange-400 bg-gradient-to-b from-orange-100 to-orange-200',
    review: 'ring-purple-400 bg-gradient-to-b from-purple-100 to-purple-200',
    blocked: 'ring-red-400 bg-gradient-to-b from-red-100 to-red-200',
    done: 'ring-green-400 bg-gradient-to-b from-green-100 to-green-200',
    close: 'ring-slate-400 bg-gradient-to-b from-slate-200 to-slate-300',
    rejected: 'ring-slate-400 bg-gradient-to-b from-slate-200 to-slate-300',
    archived: 'ring-slate-400 bg-gradient-to-b from-slate-200 to-slate-300'
  };

  return isOver ? `${highlightColors[status]} ring-2` : baseColors[status];
};

export function DroppableColumn({ 
  id, 
  title, 
  tasks,
  isLastDroppable = false 
}: DroppableColumnProps) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: id,
  });

  const isDraggingOver = Boolean(isOver && active);
  const sortedTasks = [...tasks].sort((a, b) => a.priority_order - b.priority_order);

  return (
    <div
      className={`
        flex-1 min-w-[300px] rounded-lg overflow-hidden
        ${getColumnColor(id, isDraggingOver || isLastDroppable)}
        transition-all duration-300 ease-in-out transform-gpu
        ${isDraggingOver || isLastDroppable ? 'scale-[1.02] shadow-lg' : 'shadow hover:shadow-md hover:scale-[1.01]'}
      `}
    >
      <div className="p-3 font-medium text-slate-700 border-b bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <span>{title}</span>
          <span className="px-2 py-0.5 text-xs bg-white/80 rounded-full">
            {tasks.length}
          </span>
        </div>
      </div>

      <SortableContext 
        items={sortedTasks.map(task => task.task_id)}
        strategy={verticalListSortingStrategy}
      >
        <div 
          ref={setNodeRef}
          className={`
            p-2 space-y-2 min-h-[200px] group
            transition-all duration-300 ease-in-out
            ${(isDraggingOver || isLastDroppable) ? 'bg-blue-100/30 ring-2 ring-inset ring-blue-400/50' : ''}
            ${tasks.length === 0 ? 'flex items-center justify-center' : ''}
            rounded-b-lg
          `}
        >
          {tasks.length === 0 && !isDraggingOver && !isLastDroppable && (
            <div className="text-sm text-slate-400 text-center p-4">
              Drop tasks here
            </div>
          )}

          {(isDraggingOver || (isLastDroppable && tasks.length === 0)) && (
            <div className="text-sm text-blue-500 text-center p-4 animate-pulse">
              Release to drop here
            </div>
          )}

          {sortedTasks.map((task, index) => (
            <div
              key={task.task_id}
              className={`
                transform transition-all duration-200 ease-in-out
                ${isDraggingOver ? '-translate-y-1 opacity-50' : ''}
                hover:z-10
              `}
              style={{
                transitionDelay: `${index * 20}ms`
              }}
            >
              <SortableTaskItem task={task} />
            </div>
          ))}
        </div>
      </SortableContext>
    </div>
  );
}