'use client';

import { Task, TaskStatus } from '@/types/task';
import { useDroppable, UniqueIdentifier } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableTaskItem } from './SortableTaskItem';
import { useMemo } from 'react';

interface DroppableColumnProps {
  id: TaskStatus;
  title: string;
  tasks: Task[];
  activeId: UniqueIdentifier | null;
  overId: UniqueIdentifier | null;
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

  return isOver ? `${highlightColors[status]} ring-2 ring-opacity-100` : baseColors[status];
};

export function DroppableColumn({ 
  id, 
  title, 
  tasks,
  activeId,
  overId,
}: DroppableColumnProps) {
  const { setNodeRef, isOver, active } = useDroppable({
    id,
    data: {
      type: 'Column',
      accepts: ['Task'],
      status: id,
    }
  });

  const isDraggingOver = Boolean(isOver && active);
  const isColumnTarget = overId === id;
  
  // Visual feedback when a task is being dragged
  const isColumnActive = useMemo(() => {
    if (!activeId) return false;
    return tasks.some(task => task.task_id === activeId);
  }, [activeId, tasks]);
  
  const sortedTasks = useMemo(() => 
    [...tasks].sort((a, b) => a.priority_order - b.priority_order),
    [tasks]
  );

  const taskIds = useMemo(() => 
    sortedTasks.map(task => task.task_id),
    [sortedTasks]
  );

  // Helper để xác định nếu một task đang được kéo
  const isTaskActive = (taskId: string) => activeId === taskId;
  
  // Helper để xác định nếu đang kéo qua một task cụ thể
  const isTaskTarget = (taskId: string) => overId === taskId;
  
  // Helper để tìm vị trí task trong mảng đã sắp xếp
  const getTaskIndex = (taskId: string) => sortedTasks.findIndex(t => t.task_id === taskId);
  
  // Helper để xác định vị trí tương đối so với mục đang kéo
  const getTaskPosition = (taskId: string) => {
    if (!activeId || activeId === taskId) return 'self';
    
    const activeIndex = getTaskIndex(String(activeId));
    const currentIndex = getTaskIndex(taskId);
    
    if (activeIndex === -1 || currentIndex === -1) return 'none';
    
    return currentIndex < activeIndex ? 'before' : 'after';
  };

  return (
    <div
      className={`
        flex-1 min-w-[300px] rounded-lg overflow-hidden flex flex-col
        ${getColumnColor(id, isDraggingOver || isColumnTarget)}
        transition-all duration-300 ease-in-out transform-gpu
        ${isDraggingOver 
          ? 'ring-2 ring-blue-400 shadow-lg scale-[1.02]' 
          : isColumnTarget
            ? 'ring-2 ring-blue-300 shadow-md scale-[1.01]'
            : isColumnActive
              ? 'ring-1 ring-blue-200 shadow-sm'
              : 'shadow hover:shadow-sm'
        }
        will-change-transform
      `}
      data-column-id={id}
      data-status={id}
      data-is-column-target={isColumnTarget ? 'true' : 'false'}
      data-has-active-task={isColumnActive ? 'true' : 'false'}
      aria-label={`Column ${title} - ${tasks.length} tasks`}
    >
      {/* Column Header */}
      <div className={`
        p-3 font-medium text-slate-700 border-b sticky top-0 z-10
        ${isDraggingOver || isColumnTarget ? 'bg-white/70' : 'bg-white/50'} 
        backdrop-blur-sm transition-colors duration-200
      `}>
        <div className="flex items-center justify-between">
          <span>{title}</span>
          <span className={`
            px-2 py-0.5 text-xs rounded-full transition-all duration-200
            ${isDraggingOver 
              ? 'bg-blue-100 text-blue-800' 
              : isColumnTarget
                ? 'bg-blue-50 text-blue-700'
                : 'bg-white/80 text-slate-600'
            }
          `}>
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Column Content */}
      <div 
        ref={setNodeRef}
        className={`
          flex-1 p-2 min-h-[200px] relative
          ${tasks.length === 0 ? 'flex items-center justify-center' : ''}
          ${isDraggingOver 
            ? 'bg-blue-50/70 drop-spotlight' 
            : isColumnTarget
              ? 'bg-blue-50/30'
              : ''
          }
          transition-all duration-200 ease-in-out
        `}
      >
        {tasks.length === 0 ? (
          // Empty Column State
          <div 
            className={`
              w-full h-full rounded-lg border-2 border-dashed
              flex items-center justify-center
              transition-all duration-300 ease-in-out transform-gpu
              ${isDraggingOver 
                ? 'border-blue-400 bg-blue-100/40 text-blue-600 scale-105' 
                : isColumnTarget
                  ? 'border-blue-300 bg-blue-50/30 text-blue-500 scale-[1.02]'
                  : 'border-slate-200 text-slate-400'
              }
            `}
            aria-label="Empty column"
          >
            {isDraggingOver 
              ? 'Drop here'
              : isColumnTarget
                ? 'Release to drop'
                : 'No tasks'
            }
          </div>
        ) : (
          // Task List
          <SortableContext 
            items={taskIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="relative">
              {/* Drop Zone Indicator */}
              {(isDraggingOver || isColumnTarget) && (
                <div 
                  className={`
                    absolute inset-0 -m-2 rounded-lg pointer-events-none
                    ${isDraggingOver 
                      ? 'bg-blue-100/40 ring-2 ring-inset ring-blue-400/50' 
                      : 'bg-blue-50/30 ring-1 ring-inset ring-blue-300/40'
                    }
                    transition-all duration-300 ease-in-out transform-gpu
                    ${active ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
                  `}
                  aria-hidden="true"
                />
              )}

              {/* Tasks Container */}
              <div 
                className="relative z-10 space-y-2"
                data-status={id}
              >
                {sortedTasks.map((task, index) => {
                  const taskPosition = getTaskPosition(task.task_id);
                  const isActive = isTaskActive(task.task_id);
                  const isTarget = isTaskTarget(task.task_id);
                  
                  return (
                    <div
                      key={task.task_id}
                      data-task-id={task.task_id}
                      data-index={index}
                      data-position={taskPosition}
                      className={`
                        transform-gpu transition-all duration-200 ease-out
                        ${isActive 
                          ? 'opacity-50 translate-y-1 z-0' 
                          : isTarget
                            ? 'z-20 -translate-y-1 shadow-lg scale-[1.02]'
                            : taskPosition === 'before' && activeId && overId === id
                              ? '-translate-y-2 z-10'
                              : taskPosition === 'after' && activeId && overId === id
                                ? 'translate-y-2 z-10'
                                : 'translate-y-0 z-10'
                        }
                        will-change-transform
                      `}
                    >
                      <SortableTaskItem 
                        task={task}
                        isOver={isTarget}
                        dragPosition={taskPosition}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  );
}