'use client';

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { taskFormSchema, progressTypeOptions } from '@/schemas/taskForm';
import { TASK_TYPES, TASK_CATEGORIES, TASK_TAGS, Task } from '@/types/task';
import { mockTasks } from '@/data/mockTasks';

// Dynamic import for React Quill
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });
import 'react-quill/dist/quill.snow.css';

interface NewTaskFormProps {
  projectId: string;
}

export interface TaskFormInputs {
  title: string;
  description: string;
  assignee: string;
  deadline: string;
  category: string;
  type: string;
  effort?: number;
  progressType: string;
  tags: string[];
  parentTaskId?: string;
}

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ color: [] }, { background: [] }],
    ['link', 'image'],
    ['clean'],
  ],
};

export default function NewTaskForm({ projectId }: NewTaskFormProps) {
  const router = useRouter();
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [selectedParentTask, setSelectedParentTask] = useState<Task | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<TaskFormInputs>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      tags: [],
      type: '',
      category: '',
      progressType: '',
      effort: 0,
    },
  });

  // Filter available parent tasks
  const availableParentTasks = useMemo(() => {
    return mockTasks.filter(task => {
      if (task.projectId !== projectId) return false;
      if (!taskSearchQuery) return true;
      
      const query = taskSearchQuery.toLowerCase();
      return task.title.toLowerCase().includes(query) || 
             task.description?.toLowerCase().includes(query);
    });
  }, [taskSearchQuery, projectId]);

  const onSubmit = async (data: TaskFormInputs) => {
    try {
      // Include parent task ID if selected
      const taskData = {
        ...data,
        projectId,
        parentTaskId: selectedParentTask?.id,
      };
      console.log('Creating task:', taskData);
      router.push(`/projects/${projectId}`);
      router.refresh();
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  // Handle parent task selection
  const handleParentTaskSelect = (task: Task) => {
    setSelectedParentTask(task);
    setTaskSearchQuery('');
    setValue('parentTaskId', task.id);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-white p-6 rounded-lg shadow">
      <div className="space-y-4">
        {/* Parent Task Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Parent Task (optional)
          </label>
          <div className="mt-1 relative">
            {selectedParentTask ? (
              <div className="flex items-center justify-between p-2 border rounded-md">
                <span>{selectedParentTask.title}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedParentTask(null);
                    setValue('parentTaskId', undefined);
                  }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <span className="sr-only">Remove parent task</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  value={taskSearchQuery}
                  onChange={(e) => setTaskSearchQuery(e.target.value)}
                  placeholder="Search for a parent task..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                {taskSearchQuery && (
                  <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    {availableParentTasks.map((task) => (
                      <li
                        key={task.id}
                        onClick={() => handleParentTaskSelect(task)}
                        className="relative cursor-pointer select-none py-2 px-3 hover:bg-blue-50"
                      >
                        <div className="font-medium">{task.title}</div>
                        <div className="text-sm text-gray-500 truncate">{task.description}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Title
          </label>
          <input
            {...register('title')}
            type="text"
            id="title"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="Enter task title"
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600">{errors.title.message as string}</p>
          )}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <div className="mt-1">
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <ReactQuill
                  {...field}
                  theme="snow"
                  modules={quillModules}
                  placeholder="Enter task description"
                  className="bg-white"
                />
              )}
            />
          </div>
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">{errors.description.message as string}</p>
          )}
        </div>

        <div>
          <label htmlFor="assignee" className="block text-sm font-medium text-gray-700">
            Assignee
          </label>
          <input
            {...register('assignee')}
            type="text"
            id="assignee"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="Enter assignee name"
          />
          {errors.assignee && (
            <p className="mt-1 text-sm text-red-600">{errors.assignee.message as string}</p>
          )}
        </div>

        <div>
          <label htmlFor="deadline" className="block text-sm font-medium text-gray-700">
            Deadline
          </label>
          <input
            {...register('deadline')}
            type="datetime-local"
            id="deadline"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          {errors.deadline && (
            <p className="mt-1 text-sm text-red-600">{errors.deadline.message as string}</p>
          )}
        </div>

        <div>
          <label htmlFor="effort" className="block text-sm font-medium text-gray-700">
            Effort (hours)
          </label>
          <input
            {...register('effort', { valueAsNumber: true })}
            type="number"
            id="effort"
            min="0"
            step="0.5"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          {errors.effort && (
            <p className="mt-1 text-sm text-red-600">{errors.effort.message as string}</p>
          )}
        </div>

        <div>
          <label htmlFor="progressType" className="block text-sm font-medium text-gray-700">
            Progress Type
          </label>
          <select
            {...register('progressType')}
            id="progressType"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Select progress type</option>
            {progressTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
          {errors.progressType && (
            <p className="mt-1 text-sm text-red-600">{errors.progressType.message as string}</p>
          )}
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">
            Category
          </label>
          <select
            {...register('category')}
            id="category"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Select category</option>
            {TASK_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          {errors.category && (
            <p className="mt-1 text-sm text-red-600">{errors.category.message as string}</p>
          )}
        </div>

        <div>
          <label htmlFor="type" className="block text-sm font-medium text-gray-700">
            Type
          </label>
          <select
            {...register('type')}
            id="type"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Select type</option>
            {TASK_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {errors.type && (
            <p className="mt-1 text-sm text-red-600">{errors.type.message as string}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
          <div className="mt-2 space-y-2 grid grid-cols-2 gap-4">
            {TASK_TAGS.map((tag) => (
              <label key={tag} className="inline-flex items-center">
                <input
                  type="checkbox"
                  value={tag}
                  {...register('tags')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">{tag}</span>
              </label>
            ))}
          </div>
          {errors.tags && (
            <p className="mt-1 text-sm text-red-600">{errors.tags.message as string}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Create Task
        </button>
      </div>
    </form>
  );
};
