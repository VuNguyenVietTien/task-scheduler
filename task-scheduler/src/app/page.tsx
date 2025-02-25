'use client';

import { TaskList } from '@/components/tasks/TaskList';
import { Timeline } from '@/components/timeline/Timeline';
import { calculateSchedule } from '@/lib/scheduler';
import { Task } from '@/types/task';
import { useState } from 'react';
import tasksData from '@/data/tasks.json';

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>(() => 
    calculateSchedule(tasksData as Task[])
  );

  const handleReorder = (newOrder: Task[]) => {
    const updated = newOrder.map((t, idx) => ({
      ...t,
      priority_order: idx + 1
    }));
    setTasks(calculateSchedule(updated));
  };

  return (
    <main className="flex h-screen overflow-hidden">
      <TaskList tasks={tasks} onReorder={handleReorder} />
      <Timeline tasks={tasks} />
    </main>
  );
}