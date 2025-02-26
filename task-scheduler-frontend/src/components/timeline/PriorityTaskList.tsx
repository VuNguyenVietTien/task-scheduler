/**
 * PriorityTaskList Component
 * 
 * This component enables task reordering in the Gantt chart view.
 * When tasks are dragged to reorder, it:
 * 1. Updates the visual order in this list
 * 2. Updates corresponding task bars in the Gantt chart
 * 3. Persists the new priority order to the backend
 */

import { Task } from '@/types/task';
import { PriorityTaskCard } from './PriorityTaskCard';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

interface PriorityTaskListProps {
  tasks: Task[];
}

export function PriorityTaskList({ tasks }: PriorityTaskListProps) {
  return (
    <div 
      className="h-full bg-slate-50 rounded-lg flex flex-col overflow-hidden"
      role="region" 
      aria-label="Priority Tasks"
    >
      <div className="p-4 border-b border-slate-200 bg-white">
        <h2 className="text-lg font-medium text-slate-900">Priority Tasks</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <SortableContext
          items={tasks.map(task => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="min-h-[calc(100%-1rem)] rounded-lg flex flex-col gap-3">
            {tasks.map((task) => (
              <PriorityTaskCard 
                key={task.id} 
                task={task}
              />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}
