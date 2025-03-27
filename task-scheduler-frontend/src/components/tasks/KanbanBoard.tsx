'use client';

import { Task, TaskStatus, TaskStatuses } from '@/types/task';
import { useEffect, useState, useMemo } from 'react';
import { useTaskStatusUpdate } from '@/hooks/useTaskStatusUpdate';
import {
  DragDropProvider,
  Droppable,
  Draggable,
  type DroppableProvided,
  type DraggableProvided,
  type DraggableStateSnapshot,
  type DropResult
} from '@/components/dnd/DragDropProvider';
import { useAppDispatch } from '@/redux/hooks';
import { updateTaskStatus } from '@/redux/features/tasksSlice';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux/store';

interface KanbanBoardProps {
  tasks: Task[];
  onTasksReorder?: (tasks: Task[]) => void;
  projectId: string;
}

interface Column {
  id: TaskStatus;
  title: string;
}

export function KanbanBoard({ tasks, onTasksReorder, projectId }: KanbanBoardProps) {
  const [clonedTasks, setClonedTasks] = useState<Task[]>(tasks);
  const updateTaskStatusMutation = useTaskStatusUpdate();
  const dispatch = useAppDispatch();

  // Đăng ký theo dõi thay đổi từ Redux store
  const tasksState = useSelector((state: RootState) => state.tasks);
  
  useEffect(() => {
    // Reset clonedTasks khi tasks thay đổi
    setClonedTasks(tasks);
  }, [tasks]);
  
  useEffect(() => {
    // Cập nhật clonedTasks từ Redux store khi có thay đổi
    if (tasksState.tasks.length > 0) {
      // Lọc tasks theo projectId hiện tại
      const projectTasks = tasksState.tasks.filter(task => task.project_id === projectId);
      if (projectTasks.length > 0) {
        setClonedTasks(projectTasks);
      }
    }
  }, [tasksState, projectId]);

  // Lắng nghe sự kiện khi task status được cập nhật từ nơi khác
  useEffect(() => {
    const handleTaskStatusUpdate = (event: CustomEvent) => {
      const { taskId, newStatus } = event.detail;
      
      console.log('Task status updated externally:', { taskId, newStatus });
      
      setClonedTasks(prevTasks => {
        return prevTasks.map(task => 
          task.task_id === taskId 
            ? { ...task, status: newStatus } 
            : task
        );
      });
    };

    // Add event listener
    window.addEventListener('task-status-updated', handleTaskStatusUpdate as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('task-status-updated', handleTaskStatusUpdate as EventListener);
    };
  }, []);

  const columns: Column[] = [
    { id: TaskStatuses.TODO, title: 'Todo' },
    { id: TaskStatuses.DOING, title: 'In Progress' },
    { id: TaskStatuses.PENDING, title: 'Pending' },
    { id: TaskStatuses.REVIEW, title: 'Review' },
    { id: TaskStatuses.BLOCKED, title: 'Blocked' },
    { id: TaskStatuses.DONE, title: 'Done' },
  ];

  const getTasksByStatus = (status: TaskStatus) => {
    return clonedTasks.filter(task => task.status === status);
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatuses.DONE:
        return 'border-green-500';
      case TaskStatuses.DOING:
        return 'border-blue-500';
      case TaskStatuses.REVIEW:
        return 'border-purple-500';
      case TaskStatuses.PENDING:
        return 'border-amber-500';
      case TaskStatuses.BLOCKED:
        return 'border-red-500';
      default:
        return 'border-slate-500';
    }
  };

  const getColumnGradient = (status: TaskStatus) => {
    switch (status) {
      case TaskStatuses.TODO:
        return 'bg-gradient-to-b from-slate-50 to-slate-100';
      case TaskStatuses.DOING:
        return 'bg-gradient-to-b from-blue-50 to-blue-100/60';
      case TaskStatuses.REVIEW:
        return 'bg-gradient-to-b from-purple-50 to-purple-100/60';
      case TaskStatuses.PENDING:
        return 'bg-gradient-to-b from-amber-50 to-amber-100/60';
      case TaskStatuses.BLOCKED:
        return 'bg-gradient-to-b from-red-50 to-red-100/60';
      case TaskStatuses.DONE:
        return 'bg-gradient-to-b from-green-50 to-green-100/60';
      default:
        return 'bg-gradient-to-b from-slate-50 to-slate-100';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgent':
      case 'critical':
        return 'text-red-600 bg-red-50';
      case 'high':
        return 'text-orange-600 bg-orange-50';
      case 'medium':
        return 'text-amber-600 bg-amber-50';
      case 'low':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-slate-600 bg-slate-50';
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId as TaskStatus;
    const previousStatus = result.source.droppableId as TaskStatus;

    // Không làm gì nếu kéo thả vào cùng cột
    if (newStatus === previousStatus) return;

    console.log(`Dragging task ${taskId} from ${previousStatus} to ${newStatus}`);

    // Optimistically update UI
    setClonedTasks(prevTasks => 
      prevTasks.map(task => 
        task.task_id === taskId 
          ? { ...task, status: newStatus } 
          : task
      )
    );

    // Sử dụng Redux dispatch thay vì gọi mutation trực tiếp
    // Điều này đảm bảo thống nhất với cách xử lý trong TaskListView
    dispatch(updateTaskStatus({
      taskId,
      status: newStatus
    }))
    .unwrap()
    .then(() => {
      console.log('Task status updated successfully via Redux');
      
      // Call onTasksReorder callback if provided
      if (onTasksReorder) {
        onTasksReorder(clonedTasks);
      }
      
      // Dispatch một event thông báo cập nhật thành công
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'success',
          message: 'Đã cập nhật trạng thái công việc'
        }
      });
      window.dispatchEvent(event);
    })
    .catch(error => {
      console.error('Failed to update task status:', error);
      
      // Revert UI changes on error
      setClonedTasks(prevTasks => 
        prevTasks.map(task => 
          task.task_id === taskId 
            ? { ...task, status: previousStatus } 
            : task
        )
      );
      
      // Show error notification
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'error',
          message: 'Cập nhật trạng thái thất bại. Vui lòng thử lại.'
        }
      });
      window.dispatchEvent(event);
    });
  };

  return (
    <DragDropProvider onDragEnd={handleDragEnd}>
      <div className="flex gap-4 h-full overflow-x-auto p-4 pb-8">
        {columns.map(column => (
          <div key={column.id} className="flex-1 min-w-[280px] max-w-[280px]">
            <div className={`rounded-lg p-4 h-full ${getColumnGradient(column.id)} shadow-sm`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-slate-900">{column.title}</h3>
                <span className="text-sm text-slate-600">
                  {getTasksByStatus(column.id).length}
                </span>
              </div>

              <Droppable droppableId={column.id}>
                {(provided: DroppableProvided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[200px] rounded-lg transition-colors duration-200
                      ${snapshot.isDraggingOver 
                        ? 'outline outline-2 outline-blue-400 outline-dashed bg-blue-50/70' 
                        : 'bg-transparent'
                      }`}
                  >
                    <div className="space-y-3 p-2">
                      {getTasksByStatus(column.id).map((task, index) => (
                        <Draggable
                          key={task.task_id}
                          draggableId={task.task_id}
                          index={index}
                          isDragDisabled={updateTaskStatusMutation.isLoading}
                        >
                          {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`p-3 rounded-lg border-l-4 bg-white
                                ${getStatusColor(task.status)}
                                ${snapshot.isDragging 
                                  ? 'shadow-lg ring-2 ring-blue-400 rotate-[1deg]' 
                                  : 'shadow-sm hover:shadow-md'
                                }
                                ${updateTaskStatusMutation.isLoading && updateTaskStatusMutation.variables?.taskId === task.task_id
                                  ? 'animate-pulse'
                                  : ''
                                }
                                cursor-grab active:cursor-grabbing
                                transition-all duration-200`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <h4 className="font-medium text-slate-900 truncate flex-1">
                                  {task.title}
                                </h4>
                                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium shrink-0 ${getPriorityColor(task.priority)}`}>
                                  {task.priority}
                                </span>
                              </div>

                              <div className="flex justify-between items-center">
                                <div className="flex -space-x-2">
                                  {task.assignee && (
                                    <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-xs text-blue-700 ring-2 ring-white">
                                      {task.assignee.username.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {task.due_date && 
                                    `Due ${new Date(task.due_date).toLocaleDateString()}`
                                  }
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                    </div>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          </div>
        ))}
      </div>
    </DragDropProvider>
  );
}
