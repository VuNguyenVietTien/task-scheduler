'use client';

import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { Task } from '@/types/task';
import { sortTasksByPriority } from '@/utils/taskScheduler';
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
import { useAppDispatch } from '@/redux/hooks';
import { updateTaskOrder } from '@/redux/features/taskOrderStore';
import { processTasksAndUpdateStore } from '@/utils/taskScheduler';
// Replace the incorrect import with a utility function
// import { classNames } from '@/utils/classNames';

// Simple utility function for combining class names
const classNames = (...classes: (string | undefined | boolean)[]) => {
  return classes.filter(Boolean).join(' ');
};

interface PriorityTaskListProps {
  tasks: Task[];
  onTaskClick?: (taskId: string) => void;
  onTaskReorder?: (taskId: string, newIndex: number) => void;
  activePlanId?: string | null;
  autoSort?: boolean;
  title: string;
  showCount?: boolean;
  headerAction?: React.ReactNode;
  containerClassName?: string;
  maxHeight?: string;
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

export function PriorityTaskList({ 
  tasks, 
  onTaskClick, 
  onTaskReorder, 
  activePlanId, 
  autoSort,
  title,
  showCount,
  headerAction,
  containerClassName,
  maxHeight
}: PriorityTaskListProps) {
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [hasUserReordered, setHasUserReordered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dispatch = useAppDispatch();
  
  // Sensors cho DnD - Luôn định nghĩa ở cấp cao nhất của component
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

  // Xử lý khi bắt đầu kéo thả - Định nghĩa callback trước useEffect
  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  // Xử lý khi kéo thả hoàn tất - Định nghĩa callback trước useEffect
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    // Đánh dấu đã kết thúc quá trình kéo thả
    setIsDragging(false);
    
    if (over && active.id !== over.id) {
      const oldIndex = activeTasks.findIndex(task => task.task_id === active.id);
      const newIndex = activeTasks.findIndex(task => task.task_id === over.id);
      
      // Cập nhật thứ tự tasks
      if (oldIndex !== -1 && newIndex !== -1) {
        // Tạo mảng mới theo thứ tự sau khi kéo thả
        const newTasks = arrayMove(activeTasks, oldIndex, newIndex);
        
        // Cập nhật state local trước
        setActiveTasks(newTasks);
        setHasUserReordered(true);
        
        // Chuyển đổi tasks thành định dạng phù hợp để tính toán lại ngày
        const tasksToRecalculate = newTasks.map((task, index) => ({
          ...task,
          priority_order: index + 1,
          force_recalculate: true,
          start_date: undefined,
          due_date: undefined
        }));
        
        // QUAN TRỌNG: Chỉ gọi processTasksAndUpdateStore - KHÔNG gọi updateTaskOrder trước đó
        // vì processTasksAndUpdateStore sẽ tự động dispatch updateTaskOrderAndDates
        console.log('🔄 PriorityTaskList - handleDragEnd: Gọi processTasksAndUpdateStore để cập nhật thứ tự và ngày:', 
          tasksToRecalculate.length, 'tasks');
        processTasksAndUpdateStore(tasksToRecalculate, true, dispatch);
        
        // Gọi callback để thông báo thay đổi
        if (onTaskReorder) {
          setTimeout(() => {
            onTaskReorder(String(active.id), newIndex);
          }, 50);
        }
      }
    }
  }, [activeTasks, onTaskReorder, dispatch]);

  // useEffect luôn chạy dù có điều kiện gì bên trong
  useEffect(() => {
    // Logic sắp xếp tasks
    const updateTasksOrder = () => {
      // Nếu đang trong quá trình kéo thả, không cập nhật lại tasks từ props
      if (isDragging) {
        return;
      }
      
      // Reset trạng thái khi tasks, plan, hoặc autoSort thay đổi
      if (activePlanId || autoSort) {
        setHasUserReordered(false);
      } else if (hasUserReordered && tasks.length === activeTasks.length) {
        return; // Chỉ giữ nguyên thứ tự nếu người dùng đã kéo thả và không có plan/autoSort
      }
      
      // Lọc tasks đã hoàn thành
      const filteredTasks = tasks.filter(task => task.status !== 'done');
      
      console.log(`PriorityTaskList updating - activePlanId: ${activePlanId}, autoSort: ${autoSort}, tasks: ${filteredTasks.length}`);
      
      // Nếu có plan active hoặc tất cả tasks đều có priority_order, sắp xếp theo priority_order
      const allTasksHavePriorityOrder = filteredTasks.length > 0 && 
                                        filteredTasks.every(task => task.priority_order !== undefined);
      
      let sortedTasks: Task[] = [];
      if (activePlanId || allTasksHavePriorityOrder) {
        // Sắp xếp theo priority_order nếu có plan hoặc tất cả tasks đều có priority_order
        console.log('Sắp xếp tasks theo priority_order (từ plan hoặc đã có thứ tự)');
        sortedTasks = [...filteredTasks].sort((a, b) => 
          (a.priority_order || 999) - (b.priority_order || 999)
        );
      } else {
        // Sắp xếp theo priority nếu không có plan/priority_order hoặc autoSort=true
        console.log('Sắp xếp tasks theo priority (urgent > high > medium > low)');
        sortedTasks = sortTasksByPriority(filteredTasks);
      }
      
      setActiveTasks(sortedTasks);
    };
    
    updateTasksOrder();
  }, [tasks, hasUserReordered, activeTasks.length, isDragging, activePlanId, autoSort]);

  // Chuẩn bị empty item để hiển thị khi không có task
  const emptyContent = (
    <div className="p-4 text-center text-slate-500">
      <p>Không có công việc nào để hiển thị</p>
    </div>
  );

  const hasItems = activeTasks.length > 0;

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
            onDragStart={handleDragStart}
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
        ) : emptyContent}
      </div>
    </div>
  );
}
