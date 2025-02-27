'use client';

import { Task, TaskStatus } from '@/types/task';
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

interface KanbanBoardProps {
  tasks: Task[];
  projectId: string;
}

interface Column {
  id: TaskStatus;
  label: string;
}

export function KanbanBoard({ tasks, projectId }: KanbanBoardProps) {
  const updateTaskStatus = useTaskStatusUpdate();
  const columns: Column[] = [
    { id: TaskStatus.BACKLOG, label: 'Backlog' },
    { id: TaskStatus.PLANNED, label: 'Planned' },
    { id: TaskStatus.IN_PROGRESS, label: 'In Progress' },
    { id: TaskStatus.IN_REVIEW, label: 'In Review' },
    { id: TaskStatus.DONE, label: 'Done' }
  ];

  const getTasksByStatus = (status: TaskStatus) => {
    return tasks.filter(task => task.status === status);
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.DONE:
        return 'border-green-500 bg-green-50';
      case TaskStatus.IN_PROGRESS:
        return 'border-blue-500 bg-blue-50';
      case TaskStatus.IN_REVIEW:
        return 'border-purple-500 bg-purple-50';
      case TaskStatus.PLANNED:
        return 'border-amber-500 bg-amber-50';
      default:
        return 'border-slate-500 bg-slate-50';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'text-red-600 bg-red-50';
      case 'HIGH':
        return 'text-orange-600 bg-orange-50';
      case 'MEDIUM':
        return 'text-amber-600 bg-amber-50';
      case 'LOW':
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

    if (newStatus === previousStatus) return;

    updateTaskStatus.mutate({
      taskId,
      newStatus,
      previousStatus,
      projectId,
    });
  };

  return (
    <DragDropProvider onDragEnd={handleDragEnd}>
      <div className="flex gap-4 h-full overflow-x-auto p-4">
        {columns.map(column => (
          <div key={column.id} className="flex-1 min-w-[280px] max-w-[280px]">
            <div className="bg-slate-100 rounded-lg p-4 h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-slate-900">{column.label}</h3>
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
                          key={task.id}
                          draggableId={task.id}
                          index={index}
                          isDragDisabled={updateTaskStatus.isLoading}
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
                                ${updateTaskStatus.isLoading && updateTaskStatus.variables?.taskId === task.id
                                  ? 'animate-pulse'
                                  : ''
                                }
                                cursor-grab active:cursor-grabbing
                                transition-all duration-200`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <h4 className="font-medium text-slate-900">
                                  {task.title}
                                </h4>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                                  {task.priority}
                                </span>
                              </div>

                              <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                                {task.description}
                              </p>

                              <div className="flex justify-between items-center">
                                <div className="flex -space-x-2">
                                  {task.assignees.map(assignee => (
                                    <img
                                      key={assignee.id}
                                      src={assignee.avatarUrl}
                                      alt={assignee.name}
                                      className="w-6 h-6 rounded-full ring-2 ring-white"
                                    />
                                  ))}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {task.deadline && 
                                    `Due ${new Date(task.deadline).toLocaleDateString()}`
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
