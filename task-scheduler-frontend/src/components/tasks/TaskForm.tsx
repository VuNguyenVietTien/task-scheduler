import React from 'react';
import { useForm, Controller, ControllerRenderProps } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Task, TaskStatus, User } from '@/types/task';
import { taskFormSchema, TaskFormSchema } from '@/schemas/taskForm';
import clsx from 'clsx';

export interface TaskFormProps {
  task?: Task;
  users: User[];
  onSubmit: (data: TaskFormSchema) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

interface ControllerFieldProps {
  field: ControllerRenderProps<TaskFormSchema, 'assigneeIds'>;
  fieldState: {
    invalid: boolean;
    isTouched: boolean;
    isDirty: boolean;
  };
}

export const TaskForm: React.FC<TaskFormProps> = ({
  task,
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
  } = useForm<TaskFormSchema>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: task
      ? {
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          effortHours: task.effortHours,
          startDate: task.startDate?.split('T')[0],
          deadline: task.deadline?.split('T')[0],
          assigneeIds: task.assignees.map(a => a.id),
        }
      : {
          status: TaskStatus.PLANNED,
          priority: 'medium' as const,
          assigneeIds: [],
        },
  });

  const onSubmitHandler = handleSubmit(async (data: TaskFormSchema) => {
    try {
      await onSubmit(data);
    } catch (error) {
      console.error('Form submission error:', error instanceof Error ? error.message : 'Unknown error');
    }
  });

  return (
    <form onSubmit={onSubmitHandler} className="space-y-6" noValidate>
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
          <p className="mt-1 text-sm text-red-600">{errors.title.message as string}</p>
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
          <p className="mt-1 text-sm text-red-600">{errors.description.message as string}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700">
            Status
          </label>
          <select
            id="status"
            {...register('status')}
            className={clsx(
              'mt-1 block w-full rounded-md shadow-sm sm:text-sm',
              errors.status
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
            )}
          >
            {Object.values(TaskStatus).map(status => (
              <option key={status} value={status}>
                {status.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          {errors.status && (
            <p className="mt-1 text-sm text-red-600">{errors.status.message as string}</p>
          )}
        </div>

        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
            Priority
          </label>
          <select
            id="priority"
            {...register('priority')}
            className={clsx(
              'mt-1 block w-full rounded-md shadow-sm sm:text-sm',
              errors.priority
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
            )}
          >
            {(['high', 'medium', 'low'] as const).map(priority => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
          {errors.priority && (
            <p className="mt-1 text-sm text-red-600">{errors.priority.message as string}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="effortHours" className="block text-sm font-medium text-gray-700">
          Effort Hours
        </label>
        <input
          type="number"
          id="effortHours"
          min="0"
          step="0.5"
          {...register('effortHours', { valueAsNumber: true })}
          className={clsx(
            'mt-1 block w-full rounded-md shadow-sm sm:text-sm',
            errors.effortHours
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          )}
        />
        {errors.effortHours && (
          <p className="mt-1 text-sm text-red-600">{errors.effortHours.message as string}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
            Start Date
          </label>
          <input
            type="date"
            id="startDate"
            {...register('startDate')}
            className={clsx(
              'mt-1 block w-full rounded-md shadow-sm sm:text-sm',
              errors.startDate
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
            )}
          />
          {errors.startDate && (
            <p className="mt-1 text-sm text-red-600">{errors.startDate.message as string}</p>
          )}
        </div>

        <div>
          <label htmlFor="deadline" className="block text-sm font-medium text-gray-700">
            Deadline
          </label>
          <input
            type="date"
            id="deadline"
            {...register('deadline')}
            className={clsx(
              'mt-1 block w-full rounded-md shadow-sm sm:text-sm',
              errors.deadline
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
            )}
          />
          {errors.deadline && (
            <p className="mt-1 text-sm text-red-600">{errors.deadline.message as string}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="assignees" className="block text-sm font-medium text-gray-700">
          Assignees
        </label>
        <Controller
          name="assigneeIds"
          control={control}
          render={({ field }) => (
            <select
              id="assignees"
              multiple
              {...field}
              className={clsx(
                'mt-1 block w-full rounded-md shadow-sm sm:text-sm',
                errors.assigneeIds
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
              )}
            >
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          )}
        />
        {errors.assigneeIds && (
          <p className="mt-1 text-sm text-red-600">{errors.assigneeIds.message as string}</p>
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
