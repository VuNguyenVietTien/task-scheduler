import React from 'react';
import { Task, TaskStatus, Priority, TaskStatuses, Priorities } from '@/types/task';
import { useTranslation } from 'react-i18next';

interface DetailsTabProps {
  task: Task;
  editedTask: Task;
  editingField: string | null;
  calculateDaysRemaining: () => string | null;
  formatDate: (dateString?: string) => string;
  formatEffortWithRemaining: (subtasks: Task[]) => string;
  calculateProgress: (subtasks: Task[]) => number;
  renderEditableField: (label: string, fieldName: string, type?: 'text' | 'number' | 'date' | 'select', options?: {value: string, label: string}[]) => React.ReactNode;
  projectMembers?: {
    role: string;
    joinedAt: string;
    user: {
      userId: string;
      email: string;
      fullName: string;
      username: string;
      avatarUrl: string;
    };
  }[];
  subtasks: Task[];
}

export default function DetailsTab({
  task,
  editedTask,
  editingField,
  calculateDaysRemaining,
  formatDate,
  formatEffortWithRemaining,
  calculateProgress,
  renderEditableField,
  projectMembers,
  subtasks
}: DetailsTabProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-lg">
      <h2 className="text-lg font-medium text-gray-900 mb-4">{t('tasks.sections.detailedInfo')}</h2>

      <div className="grid grid-cols-1 gap-2">
        {/* Status */}
        {renderEditableField(t('tasks.fields.status'), 'status', 'select',
          Object.entries(TaskStatuses).map(([_, value]) => ({
            value,
            label: value.charAt(0).toUpperCase() + value.slice(1)
          })))}

        {/* Priority */}
        {renderEditableField(t('tasks.fields.priority'), 'priority', 'select',
          Object.entries(Priorities).map(([_, value]) => ({
            value,
            label: value.charAt(0).toUpperCase() + value.slice(1)
          })))}

        {/* Timeline */}
        <div className="mt-6 border-t border-gray-200 pt-4">
          <h3 className="text-base font-medium text-gray-900 mb-3">{t('tasks.sections.timeline')}</h3>
          {renderEditableField(t('tasks.fields.startDate'), 'start_date', 'date')}
          {renderEditableField(t('tasks.fields.dueDate'), 'due_date', 'date')}

          <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
            <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">{t('tasks.fields.actualStartDate')}:</div>
            <div className="flex-1 text-sm text-gray-900">
              {task.actual_start_date ? formatDate(task.actual_start_date) : t('common.notSet')}
            </div>
          </div>

          <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
            <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">{t('tasks.fields.actualEndDate')}:</div>
            <div className="flex-1 text-sm text-gray-900">
              {task.actual_end_date ? formatDate(task.actual_end_date) : t('common.notSet')}
            </div>
          </div>

          {calculateDaysRemaining() && (
            <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
              <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">{t('tasks.fields.timeRemaining')}:</div>
              <div className="flex-1">
                <span className={`inline-block px-2 py-1 text-sm rounded ${calculateDaysRemaining()?.includes('Quá hạn') || calculateDaysRemaining()?.includes('Overdue') || calculateDaysRemaining()?.includes('超過') ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                  {calculateDaysRemaining()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Assignees */}
        <div className="mt-6 border-t border-gray-200 pt-4">
          <h3 className="text-base font-medium text-gray-900 mb-3">{t('tasks.sections.assignees')}</h3>
          {renderEditableField(t('tasks.fields.assignedTo'), 'assignee', 'select',
            projectMembers && projectMembers.length > 0 ?
              [{ value: '', label: t('common.notAssigned') }, ...projectMembers.map(member => ({
                value: member.user.userId,
                label: member.user.username || member.user.fullName || member.user.email
              }))] :
              [{ value: '', label: t('common.notAssigned') }]
          )}

          {renderEditableField(t('tasks.fields.createdBy'), 'created_by')}
        </div>

        {/* Effort & Progress */}
        <div className="mt-6 border-t border-gray-200 pt-4">
          <h3 className="text-base font-medium text-gray-900 mb-3">{t('tasks.sections.effortAndProgress')}</h3>
          {subtasks.length === 0 ? (
            <>
              {renderEditableField(t('tasks.fields.effort'), 'effort', 'number')}
              {renderEditableField(t('tasks.fields.progress'), 'progress', 'number')}
            </>
          ) : (
            <>
              <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
                <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">{t('tasks.fields.effortLabel')}:</div>
                <div className="flex-1 text-sm text-gray-900">
                  {formatEffortWithRemaining(subtasks)}
                </div>
              </div>
              <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
                <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">{t('tasks.fields.progressLabel')}:</div>
                <div className="flex-1 text-sm text-gray-900">
                  {calculateProgress(subtasks)}%
                </div>
              </div>
            </>
          )}
        </div>

        {/* Classification */}
        <div className="mt-6 border-t border-gray-200 pt-4">
          <h3 className="text-base font-medium text-gray-900 mb-3">{t('tasks.sections.classification')}</h3>

          {renderEditableField(t('tasks.fields.taskType'), 'type', 'select',
            [
              { value: '', label: t('common.unknown') },
              { value: 'Feature', label: 'Feature' },
              { value: 'Bug', label: 'Bug' },
              { value: 'Enhancement', label: 'Enhancement' },
              { value: 'Documentation', label: 'Documentation' }
            ]
          )}

          {renderEditableField(t('tasks.fields.category'), 'category', 'select',
            [
              { value: '', label: t('common.unknown') },
              { value: 'Frontend', label: 'Frontend' },
              { value: 'Backend', label: 'Backend' },
              { value: 'Design', label: 'Design' },
              { value: 'Testing', label: 'Testing' },
              { value: 'DevOps', label: 'DevOps' }
            ]
          )}

          {/* Tags */}
          <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
            <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">Tags:</div>
            <div className="flex-1 flex flex-wrap gap-1">
              {task.tags && Array.isArray(task.tags) && task.tags.length > 0 ? (
                task.tags.map((tag, idx) => (
                  <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {tag}
                  </span>
                ))
              ) : task.tags && typeof task.tags === 'object' && Object.keys(task.tags).length > 0 ? (
                Object.entries(task.tags).map(([key, value], idx) => (
                  <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {typeof value === 'string' ? value : key}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-500">{t('common.noTags')}</span>
              )}
            </div>
          </div>

          {renderEditableField(t('tasks.fields.progressType'), 'progress_type', 'select',
            [
              { value: '', label: t('tasks.progressTypes.notSet') },
              { value: 'study', label: t('tasks.progressTypes.study') },
              { value: 'investigate', label: t('tasks.progressTypes.investigate') },
              { value: 'code', label: t('tasks.progressTypes.code') },
              { value: 'test', label: t('tasks.progressTypes.test') },
              { value: 'review_code', label: t('tasks.progressTypes.review_code') },
              { value: 'review_test_report', label: t('tasks.progressTypes.review_test_report') },
              { value: 'release', label: t('tasks.progressTypes.release') }
            ]
          )}
        </div>

        {/* Other info */}
        <div className="mt-6 border-t border-gray-200 pt-4">
          <h3 className="text-base font-medium text-gray-900 mb-3">{t('tasks.sections.otherInfo')}</h3>
          <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
            <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">{t('tasks.fields.createdAt')}:</div>
            <div className="flex-1 text-sm text-gray-900">
              {formatDate(task.created_at)}
            </div>
          </div>

          <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
            <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">{t('tasks.fields.lastUpdated')}:</div>
            <div className="flex-1 text-sm text-gray-900">
              {formatDate(task.updated_at)}
            </div>
          </div>

          {task.task_id && (
            <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
              <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">{t('tasks.fields.taskId')}:</div>
              <div className="flex-1 text-sm text-gray-900 font-mono">
                {task.task_id}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
