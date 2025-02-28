'use client';

import React from 'react';
import { Task } from '@/types/task';

interface PriorityTaskListProps {
  tasks: Task[];
}

export function PriorityTaskList({ tasks }: PriorityTaskListProps) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 bg-white border-b border-slate-200 p-4">
        <h3 className="text-lg font-medium">Priority List</h3>
      </div>
      <div className="space-y-2 p-4">
        {tasks.map((task) => (
          <div 
            key={task.id}
            className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm"
          >
            <h4 className="font-medium text-slate-900">{task.title}</h4>
            {task.description && (
              <p className="mt-1 text-sm text-slate-500">
                {task.description}
              </p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <span className={`
                inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                ${task.priority === 'high' ? 'bg-red-100 text-red-800' :
                  task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'}
              `}>
                {task.priority}
              </span>
              <span className="text-xs text-slate-500">
                {task.deadline && new Date(task.deadline).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
