'use client';

import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';
import NewTaskForm from '@/components/tasks/NewTaskForm';

export default function CreateSubtaskPage() {
  const params = useParams();
  const projectId = params?.id as string;
  const parentTaskId = params?.taskId as string;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Tạo task con</h1>
      <NewTaskForm projectId={projectId} parentTaskId={parentTaskId} />
    </div>
  );
} 