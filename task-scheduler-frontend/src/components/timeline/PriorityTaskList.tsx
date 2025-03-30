'use client';

import React, { useMemo, useEffect, useState } from 'react';
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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowUpDown } from 'lucide-react';
import { TaskStatus } from '@/types/task';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { 
  selectOrderedTasks, 
  updateTaskOrder, 
  TaskOrderItem
} from '@/redux/features/taskOrderStore';

interface PriorityTaskListProps {
  tasks: Task[];
  onTaskClick?: (taskId: string) => void;
  onTaskReorder?: (taskId: string, newIndex: number) => void;
}

// Component cho task có thể kéo thả trong PriorityTaskList
function SortableTaskItem({ 
  task, 
  onClick 
}: { 
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
  const dispatch = useAppDispatch();
  const orderedTaskItems = useAppSelector(selectOrderedTasks);
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [hasUserReordered, setHasUserReordered] = useState(false);
  
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

  // Cập nhật danh sách activeTasks từ orderedTaskItems và tasks gốc
  useEffect(() => {
    const tasksMap = new Map<string, Task>();
    tasks.forEach(task => {
      tasksMap.set(task.task_id, task);
    });
    
    // Lọc task đã hoàn thành và sắp xếp theo thứ tự trong orderedTaskItems
    const updatedActiveTasks = orderedTaskItems
      .map(orderItem => {
        const task = tasksMap.get(orderItem.taskId);
        if (!task) return null;
        
        // Chỉ hiển thị task chưa hoàn thành
        if (task.status === 'done') return null;
        
        // Trả về task với priority_order từ orderedTaskItems
        return {
          ...task,
          priority_order: orderItem.priorityOrder 
        };
      })
      .filter((task): task is Task => task !== null);
    
    setActiveTasks(updatedActiveTasks);
  }, [orderedTaskItems, tasks]);

  // Xử lý khi kéo thả hoàn tất
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      // Tìm index trong mảng orderedTaskItems (từ Redux)
      const oldIndex = orderedTaskItems.findIndex(item => item.taskId === active.id);
      const newIndex = orderedTaskItems.findIndex(item => item.taskId === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        // Tạo mảng mới theo thứ tự đã kéo thả
        const newOrderedItems = arrayMove(orderedTaskItems, oldIndex, newIndex);
        
        // Cập nhật priorityOrder cho mỗi task
        const updatedOrderedItems = newOrderedItems.map((item, idx) => ({
          ...item,
          priorityOrder: idx
        }));
        
        // Cập nhật store
        dispatch(updateTaskOrder(updatedOrderedItems));
        setHasUserReordered(true);
        
        // Gọi callback nếu có
        if (onTaskReorder) {
          onTaskReorder(String(active.id), newIndex);
        }
      }
    }
  };

  return (
    <div className="flex flex-col">
      <div className="p-3 border-b border-slate-200 bg-slate-50">
        <h3 className="font-medium text-slate-800">Thứ tự ưu tiên công việc</h3>
        <p className="text-xs text-slate-500 mt-1">Kéo và thả để thay đổi thứ tự ưu tiên</p>
      </div>
      
      <div>
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
              {activeTasks.map((task) => (
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
