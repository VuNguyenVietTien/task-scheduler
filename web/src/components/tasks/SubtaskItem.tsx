import React, { useState } from 'react';
import { Task, TaskStatus } from '@/types/task';
import clsx from 'clsx';
import { Dialog } from '@/components/ui/Dialog';

export interface SubtaskItemProps {
  subtask: Task;
  onClick: (subtaskId: string) => void;
  onStatusChange: (subtaskId: string, status: TaskStatus) => void;
  onDelete: (subtaskId: string) => void;
}

export const SubtaskItem: React.FC<SubtaskItemProps> = ({
  subtask,
  onClick,
  onStatusChange,
  onDelete,
}) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleStatusToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStatusChange(
      subtask.id,
      subtask.status === TaskStatus.DONE ? TaskStatus.IN_PROGRESS : TaskStatus.DONE
    );
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    onDelete(subtask.id);
    setShowDeleteDialog(false);
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
  };

  return (
    <>
      <div
        data-testid="subtask-item"
        onClick={() => onClick(subtask.id)}
        className={clsx(
          'p-3 rounded-lg border shadow-sm cursor-pointer transition-all',
          'hover:shadow-md',
          subtask.status === TaskStatus.DONE
            ? 'border-green-200 bg-green-50'
            : subtask.status === TaskStatus.IN_PROGRESS
            ? 'border-yellow-200 bg-yellow-50'
            : 'border-gray-200 bg-white'
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium flex-grow">{subtask.title}</h4>
          <div className="flex items-center gap-2">
            <button
              data-testid="status-toggle"
              onClick={handleStatusToggle}
              className={clsx(
                'px-2 py-1 rounded-full text-xs font-medium transition-colors',
                subtask.status === TaskStatus.DONE
                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                  : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
              )}
            >
              {subtask.status === TaskStatus.DONE ? 'Done' : 'In Progress'}
            </button>
            <button
              data-testid="delete-button"
              onClick={handleDelete}
              className="p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {subtask.description && (
          <p
            data-testid="description"
            className="mt-1 text-sm text-gray-500"
            title={subtask.description}
          >
            {truncateText(subtask.description, 100)}
          </p>
        )}

        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
          {subtask.effortHours && <span>{subtask.effortHours}h</span>}
          {subtask.assignees.length > 0 && (
            <div className="flex items-center gap-1">
              <svg
                className="h-3 w-3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {subtask.assignees.map(assignee => assignee.name).join(', ')}
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        title="Delete Subtask"
      >
        <div className="mt-2">
          <p className="text-sm text-gray-500">
            Are you sure you want to delete this subtask? This action cannot be undone.
          </p>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            onClick={() => setShowDeleteDialog(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            onClick={handleConfirmDelete}
          >
            Confirm
          </button>
        </div>
      </Dialog>
    </>
  );
};
