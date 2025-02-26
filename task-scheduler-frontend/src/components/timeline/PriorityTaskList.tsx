import { Task } from '@/types/task';
import { PriorityTaskCard } from './PriorityTaskCard';
import { Droppable } from 'react-beautiful-dnd';

interface PriorityTaskListProps {
  tasks: Task[];
}

export function PriorityTaskList({ tasks }: PriorityTaskListProps) {
  return (
    <div className="w-80 bg-slate-50 p-4 rounded-lg">
      <h2 className="text-lg font-medium text-slate-900 mb-4">Priority Tasks</h2>
      <Droppable droppableId="priorityList">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`
              space-y-2 min-h-[200px] transition-all duration-200
              ${snapshot.isDraggingOver ? 'bg-blue-50 ring-2 ring-blue-200 rounded-lg' : ''}
              p-2
            `}
            style={{
              minHeight: Math.max(200, tasks.length * 100 + 16), // Ensure minimum height with padding
            }}
          >
            {tasks.map((task, index) => (
              <PriorityTaskCard key={task.id} task={task} index={index} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
