import { useTasks } from '@/hooks/useTasks';
import { Task, Priorities } from '@/types/task';
import { PriorityTaskCard } from './PriorityTaskCard';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { 
  DndContext, 
  DragEndEvent,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useReorderTasks } from '@/hooks/useTasks';

export function PriorityTaskList() {
  const { data: tasks, isLoading } = useTasks();
  const reorderTasks = useReorderTasks();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor),
    useSensor(TouchSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Find tasks involved in the drag operation
    const draggedTask = tasks?.find(task => task.id === active.id);
    const targetTask = tasks?.find(task => task.id === over.id);
    
    if (!draggedTask || !targetTask || !tasks) return;

    // Calculate new priority order
    const updatedTasks = tasks.map(task => ({
      taskId: task.id,
      priorityOrder: task.id === active.id 
        ? targetTask.priorityOrder 
        : task.id === over.id 
          ? draggedTask.priorityOrder 
          : task.priorityOrder
    }));

    // Update priority orders
    reorderTasks.mutate({
      projectId: draggedTask.projectId,
      taskOrders: updatedTasks
    });
  };

  if (isLoading) {
    return (
      <div className="h-full bg-slate-50 rounded-lg flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-white">
          <h2 className="text-lg font-medium text-slate-900">Priority Tasks</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-slate-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Filter tasks that have HIGH or URGENT priority, sorted by priorityOrder
  const priorityTasks = tasks?.filter(
    task => task.priority === Priorities.HIGH || task.priority === Priorities.URGENT
  ).sort((a, b) => a.priorityOrder - b.priorityOrder) ?? [];

  return (
    <div 
      className="h-full bg-slate-50 rounded-lg flex flex-col overflow-hidden"
      role="region" 
      aria-label="Priority Tasks"
    >
      <div className="p-4 border-b border-slate-200 bg-white">
        <h2 className="text-lg font-medium text-slate-900">
          Priority Tasks ({priorityTasks.length})
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <DndContext 
          onDragEnd={handleDragEnd}
          sensors={sensors}
          modifiers={[restrictToVerticalAxis]}
        >
          <SortableContext
            items={priorityTasks.map(task => task.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="min-h-[calc(100%-1rem)] rounded-lg flex flex-col gap-3">
              {priorityTasks.map((task) => (
                <PriorityTaskCard 
                  key={task.id} 
                  task={task}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
