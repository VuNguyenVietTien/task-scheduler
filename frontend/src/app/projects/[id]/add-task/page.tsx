import React from 'react';
import NewTaskForm from '@/components/tasks/NewTaskForm';

export default async function AddTaskPage({ params, searchParams }: { params: { id: string }, searchParams: { [key: string]: string | undefined } }) {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Add New Task</h1>
      <NewTaskForm projectId={params.id} />
    </div>
  );
}