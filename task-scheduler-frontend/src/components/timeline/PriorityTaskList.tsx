'use client';

import { Task } from '@/types/task';
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { 
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowUpDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

interface PriorityTaskListProps {
  tasks: Task[];
  onTaskClick?: (taskId: string) => void;
  onTaskReorder?: (taskId: string, newIndex: number) => void;
}

// Component cho task có thể kéo thả
function SortableTaskItem({ task, onClick }: { 
  task: Task;
  onClick?: (taskId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.task_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  // Lấy màu cho task status
  const getStatusColor = (status: string | undefined) => {
    switch (status?.toLowerCase()) {
      case 'done':
        return 'border-l-green-500';
      case 'in_progress':
      case 'doing':
        return 'border-l-blue-500';
      case 'blocked':
        return 'border-l-red-500';
      default:
        return 'border-l-gray-400';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center py-2 px-3 border-b border-slate-200 border-l-4 
        ${getStatusColor(task.status)}
        hover:bg-slate-50 cursor-pointer
        ${isDragging ? 'shadow-md rounded bg-white' : ''}
      `}
      onClick={() => onClick?.(task.task_id)}
    >
      <div
        {...attributes}
        {...listeners}
        className="mr-2 text-slate-400 cursor-grab"
      >
        <ArrowUpDown size={14} />
      </div>
      <div className="flex-1 truncate font-medium text-sm">
        {task.title}
      </div>
      <div className="ml-2 text-xs text-slate-500 flex-shrink-0">
        {task.priority}
      </div>
    </div>
  );
}

export function PriorityTaskList({ tasks, onTaskClick, onTaskReorder }: PriorityTaskListProps) {
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  // Sensors cho DnD
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    // Lọc và sắp xếp tasks
    const priorityValue: Record<string, number> = {
      'urgent': 1,  // Giữ giá trị 0 cho 'urgent' để đảm bảo nó luôn được ưu tiên cao nhất
      'high': 2,
      'medium': 3,
      'low': 4
    };
    
    const filteredTasks = tasks
      .filter(task => task.status !== 'done')
      .sort((a, b) => {
        // Lấy priority của task, mặc định là 'medium' nếu không có
        const priorityA = a.priority?.toLowerCase() || 'medium';
        const priorityB = b.priority?.toLowerCase() || 'medium';
        
        // Sắp xếp theo priority
        return (priorityValue[priorityA as keyof typeof priorityValue] || 2) - 
               (priorityValue[priorityB as keyof typeof priorityValue] || 2);
      });
    
    setActiveTasks(filteredTasks);
  }, [tasks]);

  // Xử lý khi kéo thả hoàn tất
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = activeTasks.findIndex(task => task.task_id === active.id);
      const newIndex = activeTasks.findIndex(task => task.task_id === over.id);
      
      // Cập nhật thứ tự tasks
      if (oldIndex !== -1 && newIndex !== -1) {
        const newTasks = arrayMove(activeTasks, oldIndex, newIndex);
        setActiveTasks(newTasks);
        
        // Gọi callback để cập nhật thứ tự
        if (onTaskReorder) {
          onTaskReorder(String(active.id), newIndex);
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-slate-200 bg-slate-50">
        <h3 className="font-medium text-slate-800">Thứ tự ưu tiên công việc</h3>
        <p className="text-xs text-slate-500 mt-1">Kéo và thả để thay đổi thứ tự ưu tiên</p>
      </div>
      
      <div className="overflow-y-auto flex-1">
        {activeTasks.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <SortableContext
              items={activeTasks.map(t => t.task_id)}
              strategy={verticalListSortingStrategy}
            >
              {activeTasks.map((task, index) => (
                <SortableTaskItem
                  key={task.task_id}
                  task={task}
                  onClick={onTaskClick}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          <div className="p-4 text-center text-slate-500">
            <p>Không có công việc nào để hiển thị</p>
          </div>
        )}
      </div>
    </div>
  );
}
