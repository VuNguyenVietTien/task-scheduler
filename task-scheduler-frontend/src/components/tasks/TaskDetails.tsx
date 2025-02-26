import React, { useEffect, useRef } from 'react';
import type { Task } from '@/types/task';
import styles from './TaskDetails.module.css';

export interface TaskDetailsProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onClose: () => void;
}

export const TaskDetails: React.FC<TaskDetailsProps> = ({ 
  task,
  onEdit,
  onDelete,
  onClose,
}) => {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus management
  useEffect(() => {
    const previousActiveElement = document.activeElement as HTMLElement;
    closeButtonRef.current?.focus();

    // Cleanup function to restore focus
    return () => {
      previousActiveElement?.focus();
    };
  }, []);

  // Format dates using Intl
  const formatDate = (date: string | undefined) => {
    if (!date) return 'Not set';
    
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(date));
  };

  // Check if deadline is approaching (within 24 hours)
  const isDeadlineApproaching = () => {
    if (!task.deadline) return false;

    const deadline = new Date(task.deadline);
    const now = new Date();
    const timeDiff = deadline.getTime() - now.getTime();
    return timeDiff > 0 && timeDiff <= 24 * 60 * 60 * 1000;
  };

  // Handle keydown events
  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Escape':
        if (isDeleting) {
          setIsDeleting(false);
        } else {
          onClose();
        }
        break;
      case 'Delete':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          setIsDeleting(true);
        }
        break;
      case 'Enter':
        if (isDeleting && event.target === confirmButtonRef.current) {
          onDelete(task.id);
        }
        break;
    }
  };

  // Close dialog when clicking outside
  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === dialogRef.current) {
      onClose();
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-labelledby="task-details-title"
      aria-modal="true"
      className={styles.taskDetails}
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
    >
      <header className={styles.header}>
        <h2 id="task-details-title" className={styles.title}>
          {task.title}
        </h2>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className={styles.closeButton}
        >
          ×
        </button>
      </header>

      <div role="region" aria-label="Task details" className={styles.section}>
        <div className={styles.description}>
          <p>{task.description}</p>
        </div>

        <div className={styles.statusBadges}>
          <span 
            className={`${styles.status} ${styles[`status${task.status}`]}`}
            aria-label={`Status: ${task.status}`}
          >
            {task.status}
          </span>
          <span 
            className={`${styles.priority} ${styles[`priority${task.priority}`]}`}
            aria-label={`Priority: ${task.priority}`}
          >
            {task.priority}
          </span>
        </div>

        <div className={styles.effort}>
          <span>Effort: {task.effortHours || 0} hours</span>
        </div>
      </div>

      <div role="region" aria-label="Dates" className={styles.section}>
        <div className={styles.dates}>
          <p>
            Start: {task.startDate ? formatDate(task.startDate) : 'Not scheduled'}
          </p>
          <p>
            Deadline: {task.deadline ? formatDate(task.deadline) : 'No deadline'}
            {isDeadlineApproaching() && (
              <span className={styles.warning} role="alert">
                Deadline approaching
              </span>
            )}
          </p>
        </div>
      </div>

      <div role="region" aria-label="Assignees" className={styles.section}>
        <h3>Assignees</h3>
        {task.assignees.length > 0 ? (
          <ul className={styles.assigneesList}>
            {task.assignees.map(user => (
              <li key={user.id} className={styles.assigneeItem}>
                {user.name}
              </li>
            ))}
          </ul>
        ) : (
          <p>No assignees</p>
        )}
      </div>

      <div role="region" aria-label="Created by" className={styles.meta}>
        <p>Created by {task.createdBy.name}</p>
        <p>
          on {formatDate(task.createdAt)}
          {task.updatedAt && task.updatedAt !== task.createdAt && (
            <span className={styles.updated}>
              (Updated: {formatDate(task.updatedAt)})
            </span>
          )}
        </p>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          onClick={() => onEdit(task)}
          className={styles.editButton}
          aria-label="Edit task"
        >
          Edit
        </button>

        {isDeleting ? (
          <div 
            className={styles.deleteConfirmation}
            role="alertdialog"
            aria-labelledby="delete-confirmation"
          >
            <p id="delete-confirmation">Are you sure you want to delete this task?</p>
            <button
              ref={confirmButtonRef}
              type="button"
              onClick={() => onDelete(task.id)}
              className={styles.confirmButton}
              aria-label="Confirm delete"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setIsDeleting(false)}
              className={styles.cancelButton}
              aria-label="Cancel delete"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            ref={deleteButtonRef}
            type="button"
            onClick={() => setIsDeleting(true)}
            className={styles.deleteButton}
            aria-label="Delete task"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
};
