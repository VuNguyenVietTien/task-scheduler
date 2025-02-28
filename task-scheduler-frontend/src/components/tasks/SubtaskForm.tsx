import React from 'react';
import { useForm, Controller, ControllerRenderProps } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Task, TaskStatus, User } from '@/types/task';
import { z } from 'zod';
import clsx from 'clsx';

type SubtaskFormData = {
  title: string;
  description?: string;
  effort?: number;
  assignee: string;
  status?: TaskStatus;
};

// Create a separate schema for subtasks with their specific requirements
const subtaskFormSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters'),
  description: z.string()
    .optional(),
  effort: z.number()
    .min(0, 'Effort must be positive')
    .optional(),
  assignee: z.string()
    .min(1, 'Assignee is required')
});

export interface SubtaskFormProps {
  subtask?: Task;
  users: User[];
  onSubmit: (data: SubtaskFormData) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

interface AssigneeFieldProps {
  field: ControllerRenderProps<SubtaskFormData, 'assignee'>;
}

export const SubtaskForm: React.FC<SubtaskFormProps> = ({
  subtask,
  users,
  onSubmit,
  onCancel,
  isSubmitting = false,
}) => {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = useForm<SubtaskFormData>({
    resolver: zodResolver(subtaskFormSchema),
    defaultValues: subtask
      ? {
          title: subtask.title,
          description: subtask.description,
          effort: subtask.effortHours,
          assignee: subtask.assignees[0]?.id || '',
          status: subtask.status,
        }
      : {
          status: TaskStatus.PLANNED,
          assignee: '',
        },
  });

  const onSubmitHandler = handleSubmit(async (data: SubtaskFormData) => {
    try {
      await onSubmit({
        ...data,
        status: TaskStatus.PLANNED,
      });
    } catch (error) {
      console.error('Form submission error:', error instanceof Error ? error.message : 'Unknown error');
    }
  });

  return (
    <form onSubmit={onSubmitHandler} className="space-y-4" noValidate>
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          type="text"
          id="title"
          {...register('title')}
          className={clsx(
            'mt-1 block w-full rounded-md shadow-sm sm:text-sm',
            errors.title
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          )}
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          {...register('description')}
          className={clsx(
            'mt-1 block w-full rounded-md shadow-sm sm:text-sm',
            errors.description
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          )}
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="effort" className="block text-sm font-medium text-gray-700">
          Effort Hours
        </label>
        <input
          type="number"
          id="effort"
          min="0"
          step="0.5"
          {...register('effort', { valueAsNumber: true })}
          className={clsx(
            'mt-1 block w-full rounded-md shadow-sm sm:text-sm',
            errors.effort
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          )}
        />
        {errors.effort && (
          <p className="mt-1 text-sm text-red-600">{errors.effort.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="assignee" className="block text-sm font-medium text-gray-700">
          Assignee
        </label>
        <Controller
          name="assignee"
          control={control}
          render={({ field }: AssigneeFieldProps) => (
            <select
              id="assignee"
              {...field}
              className={clsx(
                'mt-1 block w-full rounded-md shadow-sm sm:text-sm',
                errors.assignee
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
              )}
            >
              <option value="">Select an assignee</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          )}
        />
        {errors.assignee && (
          <p className="mt-1 text-sm text-red-600">{errors.assignee.message}</p>
        )}
      </div>

      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!isDirty || isSubmitting}
          className={clsx(
            'inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2',
            (!isDirty || isSubmitting)
              ? 'bg-blue-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
          )}
        >
          {isSubmitting ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
};
