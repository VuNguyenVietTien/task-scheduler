import React, { useState } from 'react';
import { Task } from '@/types/task';
import { FiPlus, FiCheck, FiX } from 'react-icons/fi';
import Link from 'next/link';
import TaskStatusBadge from '@/components/tasks/TaskStatusBadge';
import TaskPriorityBadge from '@/components/tasks/TaskPriorityBadge';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';

interface SubtasksTabProps {
  task: Task;
  projectId: string;
  subtasks: Task[];
  isLoadingSubtasks: boolean;
  handleCreateSubtask: () => void;
  formatDate: (dateString?: string) => string;
}

export default function SubtasksTab({
  task,
  projectId,
  subtasks,
  isLoadingSubtasks,
  handleCreateSubtask,
  formatDate
}: SubtasksTabProps) {
  const { t } = useTranslation();
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);

  const startAddingSubtask = () => {
    setIsAddingSubtask(true);
    setNewSubtaskTitle('');
  };

  const cancelAddingSubtask = () => {
    setIsAddingSubtask(false);
    setNewSubtaskTitle('');
  };

  const confirmAddSubtask = () => {
    if (newSubtaskTitle.trim()) {
      handleCreateSubtask();
      setIsAddingSubtask(false);
      setNewSubtaskTitle('');
    }
  };

  return (
    <div className="bg-white rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-900">{t('tasks.subtasks.title')}</h2>
        <button
          type="button"
          onClick={startAddingSubtask}
          className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <FiPlus className="mr-1" />
          {t('tasks.subtasks.addSubtask')}
        </button>
      </div>

      {isAddingSubtask && (
        <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h3 className="text-base font-medium text-gray-900 mb-3">{t('tasks.subtasks.createNew')}</h3>
          <div className="mb-3">
            <label htmlFor="subtask-title" className="block text-sm font-medium text-gray-700">
              {t('tasks.subtasks.subtaskTitle')}
            </label>
            <input
              type="text"
              id="subtask-title"
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
              placeholder={t('tasks.subtasks.subtaskTitle')}
              autoFocus
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={cancelAddingSubtask}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <FiX className="mr-1" />
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={confirmAddSubtask}
              className={`inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                !newSubtaskTitle.trim() ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={!newSubtaskTitle.trim()}
            >
              <FiCheck className="mr-1" />
              {t('tasks.subtasks.createSubtask')}
            </button>
          </div>
        </div>
      )}

      {isLoadingSubtasks ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : subtasks && subtasks.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tasks.subtasks.subtaskTitle')}
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tasks.subtasks.statusHeader')}
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tasks.subtasks.priorityHeader')}
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tasks.subtasks.assigneeHeader')}
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tasks.subtasks.startDateHeader')}
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tasks.subtasks.endDateHeader')}
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('tasks.subtasks.effortHeader')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {subtasks.map((subtask) => (
                <tr key={subtask.task_id} className="hover:bg-gray-50">
                  <td className="px-3 py-3 whitespace-nowrap">
                    <Link
                      href={`/projects/${projectId}/tasks/${subtask.task_id}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                    >
                      {subtask.title}
                    </Link>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <TaskStatusBadge status={subtask.status} />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <TaskPriorityBadge priority={subtask.priority} />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {subtask.assignee ? (
                      <div className="flex items-center">
                        {subtask.assignee.avatarUrl ? (
                          <Image
                            src={subtask.assignee.avatarUrl}
                            alt={subtask.assignee.username}
                            width={24}
                            height={24}
                            className="rounded-full mr-2"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-xs mr-2">
                            {subtask.assignee.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm">{subtask.assignee.username}</span>
                      </div>
                    ) : (
                      <span className="text-gray-500 text-sm">{t('common.notAssigned')}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                    {subtask.start_date ? formatDate(subtask.start_date) : t('common.notSet')}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                    {subtask.due_date ? formatDate(subtask.due_date) : t('common.notSet')}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                    {subtask.effort || 0} {t('common.hours')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-10 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-500 mb-4">{t('tasks.subtasks.noSubtasks')}</p>
          <button
            type="button"
            onClick={startAddingSubtask}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <FiPlus className="mr-2" />
            {t('tasks.subtasks.createSubtask')}
          </button>
        </div>
      )}
    </div>
  );
}
