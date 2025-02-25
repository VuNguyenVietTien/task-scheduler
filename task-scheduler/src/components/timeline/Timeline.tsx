'use client';

import { Task } from '@/types/task';
import { TaskBar } from './TaskBar';
import React, { useMemo } from 'react';
import { calculateTaskDates } from '@/utils/taskScheduler';

interface TimelineProps {
  tasks: Task[];
}

export function Timeline({ tasks }: TimelineProps) {
  const days = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + i);
      return date;
    });
  }, []);

  const scheduledTasks = useMemo(() => calculateTaskDates(tasks), [tasks]);

  const renderHeaderCells = () => {
    return days.map((date, index) => (
      <div
        key={index}
        className="h-10 border-r border-b border-sky-200/40 px-2 flex items-center justify-center bg-white/30"
      >
        <div className="text-xs text-sky-800 font-medium">
          {date.getDate()}/{date.getMonth() + 1}
        </div>
      </div>
    ));
  };

  const renderEmptyGrid = () => {
    return (
      <div 
        className="grid" 
        style={{ 
          gridTemplateColumns: `repeat(${days.length}, 96px)`,
          minHeight: '48px'
        }}
      >
        {days.map((_, index) => (
          <div
            key={index}
            className="border-r border-sky-200/40 h-full"
          />
        ))}
      </div>
    );
  };

  const renderTaskRows = () => {
    if (scheduledTasks.length === 0) {
      return renderEmptyGrid();
    }

    return scheduledTasks.map((task) => (
      <div
        key={task.task_id}
        className="grid relative hover:bg-sky-50/40 transition-colors"
        style={{
          gridTemplateColumns: `repeat(${days.length}, 96px)`,
          height: '48px'
        }}
      >
        <div 
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${days.length}, 96px)` }}
        >
          {days.map((_, index) => (
            <div
              key={`${task.task_id}-${index}`}
              className="border-r border-b border-sky-200/40 h-full"
            />
          ))}
        </div>
        <TaskBar task={task} days={days} />
      </div>
    ));
  };

  return (
    <div className="flex-1 overflow-x-auto relative border border-sky-100/50 rounded-lg">
      <div className="min-w-full h-full bg-sky-50/20">
        {/* Header row */}
        <div 
          className="grid sticky top-0 bg-white/50 backdrop-blur-sm z-10" 
          style={{ gridTemplateColumns: `repeat(${days.length}, 96px)` }}
        >
          {renderHeaderCells()}
        </div>

        {/* Task rows */}
        <div>
          {renderTaskRows()}
        </div>
      </div>
    </div>
  );
}
