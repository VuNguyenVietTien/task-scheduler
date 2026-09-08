'use client';

import Link from 'next/link';
import type { Task } from '@/types/task';

interface TaskDetailSubtasksProps {
  taskId: string;
  projectId: string;
  subtasks: readonly Task[];
  loading?: boolean;
}

export default function TaskDetailSubtasks({
  taskId,
  projectId,
  subtasks,
  loading = false,
}: TaskDetailSubtasksProps) {
  const directSubtasks = subtasks.filter((task) => task.parent_task_id === taskId);

  if (loading) {
    return <p className="py-8 text-center text-gray-500" role="status">Loading subtasks…</p>;
  }

  if (!directSubtasks.length) {
    return <p className="py-8 text-center text-gray-500">No subtasks.</p>;
  }

  return (
    <ul className="divide-y divide-gray-200" aria-label="Subtasks">
      {directSubtasks.map((subtask) => (
        <li key={subtask.task_id} className="flex items-center justify-between gap-4 py-3">
          <Link
            href={`/projects/${projectId}/tasks/${subtask.task_id}`}
            className="font-medium text-indigo-600 hover:text-indigo-900"
          >
            {subtask.title}
          </Link>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
            {subtask.status}
          </span>
        </li>
      ))}
    </ul>
  );
}
