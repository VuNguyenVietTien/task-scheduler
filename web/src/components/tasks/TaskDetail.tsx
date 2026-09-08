import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { EDITABLE_TASK_STATUSES, Task, TaskStatus, Priority, TaskStatuses, Priorities } from '../../types/task';
import { User } from '../../contexts/AuthContext';
import { getStatusLabel, getPriorityLabel } from '@/constants/task-display-labels';
import { Dialog } from '../ui/Dialog';
import clsx from 'clsx';
import { useUpdateTask } from '@/hooks/useTasks';
import { useAppDispatch } from '@/redux/hooks';
import { deleteTask, upsertTask } from '@/redux/features/tasksSlice';
import { PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { TagInput } from '@/components/ui/tag-input';
import { useMutation, useQuery } from '@apollo/client';
import { CREATE_TASK_COMMENT } from '@/graphql/mutations/tasks';
import { GET_TASK_COMMENTS } from '@/graphql/queries/tasks';
import { AdvancedEditor } from '@/components/common/AdvancedEditor';
import { isTiptapContentEmpty } from '@/utils/mentionUtils';
import { imageService } from '@/services/imageService';
import { Member } from '@/types/members';
import { ProjectCatalogSelect } from '@/components/projects/ProjectCatalogSettingsPanel';
import type { ProjectCatalogKind } from '@/types/project-catalog';
import { taskDeletionConfirmationMessage } from '@/utils/task-deletion';
import { useUpdateTaskAssignee } from '@/hooks/useTaskFieldMutations';
import { RESOURCE_MEMBERS_QUERY } from '@/graphql/scheduling';

interface ResourceMemberOption {
  resource_member_id: string;
  display_name: string;
  user_id: string | null;
}

interface TaskDetailProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
  currentUser?: User;
  projectMembers?: Member[];
}

interface Comment {
  id: string;
  content: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  created_at: string;
  status?: 'pending' | 'saved' | 'failed';
}

export function TaskDetail({ task, isOpen, onClose, onTaskUpdate, currentUser, projectMembers }: TaskDetailProps) {
  const { t } = useTranslation();
  const taskId = task.task_id || task.id || '';
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: commentsData, loading: isLoading } = useQuery(GET_TASK_COMMENTS, {
    variables: { taskId },
    skip: !isOpen || !taskId,
  });
  const { data: resourceMemberData } = useQuery(RESOURCE_MEMBERS_QUERY, {
    variables: { project_id: task.project_id, only_assignable: true },
    skip: !isOpen || !task.project_id,
    fetchPolicy: 'cache-and-network',
  });
  const resourceMembers = (resourceMemberData?.resource_members ?? []) as ResourceMemberOption[];
  const commentEditorRef = useRef<{ focus: () => void } | null>(null);
  const { updateTask } = useUpdateTask();
  const { updateAssignee } = useUpdateTaskAssignee();
  const dispatch = useAppDispatch();
  const [createComment] = useMutation(CREATE_TASK_COMMENT);

  // Local edited state — staged changes before saving
  const [editedTask, setEditedTask] = useState<Task>(task);
  const [editingField, setEditingField] = useState<string | null>(null);

  // Sync editedTask only when a DIFFERENT task is opened
  const currentTaskId = task.task_id || task.id;
  const prevTaskIdRef = useRef(currentTaskId);
  useEffect(() => {
    if (currentTaskId !== prevTaskIdRef.current) {
      setEditedTask(task);
      setEditingField(null);
      prevTaskIdRef.current = currentTaskId;
    }
  }, [currentTaskId, task]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return t('tasks.notSet');
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const calculateDaysRemaining = () => {
    if (!editedTask.due_date) return null;
    const today = new Date();
    const dueDate = new Date(editedTask.due_date);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return t('tasks.fields.timeRemaining') + ': -' + Math.abs(diffDays) + 'd';
    if (diffDays === 0) return t('tasks.dueToday');
    return `+${diffDays}d`;
  };

  const formatEffort = (effort?: number) => {
    if (!effort) return t('tasks.notEstimated');
    return `${effort}h`;
  };

  const getStatusColor = (status: TaskStatus) => {
    const colors: Record<string, string> = {
      'TODO': 'bg-gray-100 text-gray-800',
      'DOING': 'bg-blue-100 text-blue-800',
      'DONE': 'bg-green-100 text-green-800',
      'CLOSE': 'bg-green-100 text-green-800',
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'REVIEW': 'bg-purple-100 text-purple-800',
      'BLOCKED': 'bg-red-100 text-red-800',
      'REJECTED': 'bg-red-100 text-red-800',
      'ARCHIVED': 'bg-gray-100 text-gray-800',
    };
    return colors[status] || colors.TODO;
  };

  const getPriorityColor = (priority: Priority) => {
    const colors: Record<string, string> = {
      'LOW': 'bg-green-100 text-green-800',
      'MEDIUM': 'bg-yellow-100 text-yellow-800',
      'HIGH': 'bg-orange-100 text-orange-800',
      'URGENT': 'bg-red-100 text-red-800',
      'CRITICAL': 'bg-red-100 text-red-800 font-bold',
    };
    return colors[priority] || colors.MEDIUM;
  };

  const handleDelete = async () => {
    if (!window.confirm(taskDeletionConfirmationMessage(task))) return false;
    try {
      setIsSaving(true);
      setError(null);
      await dispatch(deleteTask({ taskId })).unwrap();
      onClose();
      return true;
    } catch (err) {
      console.error('Error deleting task:', err);
      setError('Could not delete task.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Save a single field to backend
  const saveField = async (fieldName: string) => {
    try {
      setIsSaving(true);
      setError(null);
      const taskId = task.task_id || task.id || '';
      const updates: Partial<Task> = {};

      const val = (editedTask as any)[fieldName];
      if (fieldName === 'assignee') {
        const selected = resourceMembers.find(member => member.resource_member_id === editedTask.assignee_resource_member_id);
        const savedTask = await updateAssignee(taskId, selected ? {
          assigneeId: selected.user_id,
          assigneeResourceMemberId: selected.resource_member_id,
        } : null);
        setEditedTask(savedTask);
        dispatch(upsertTask(savedTask));
        setEditingField(null);
        onTaskUpdate?.(taskId, savedTask);
        return;
      }
      switch (fieldName) {
        case 'title': updates.title = val; break;
        case 'description': updates.description = val; break;
        case 'status': updates.status = val; break;
        case 'priority': updates.priority = val; break;
        case 'start_date': updates.start_date = val ? (val.includes('T') ? val : `${val}T00:00:00Z`) : null; break;
        case 'due_date': updates.due_date = val ? (val.includes('T') ? val : `${val}T00:00:00Z`) : null; break;
        case 'effort': updates.effort = val ? Number(val) : undefined; break;
        case 'progress': updates.progress = val !== undefined ? Number(val) : undefined; break;
        case 'actual_start_date': updates.actual_start_date = val ? (val.includes('T') ? val : `${val}T00:00:00Z`) : null; break;
        case 'actual_end_date': updates.actual_end_date = val ? (val.includes('T') ? val : `${val}T00:00:00Z`) : null; break;
        case 'tags': updates.tags = Array.isArray(val) ? val : []; break;
        case 'progressCatalogItemId': updates.progressCatalogItemId = val ?? null; break;
        case 'categoryCatalogItemId': updates.categoryCatalogItemId = val ?? null; break;
        case 'taskTypeCatalogItemId': updates.taskTypeCatalogItemId = val ?? null; break;
        default: return;
      }

      const savedTask = await updateTask(taskId, updates);
      // The modal, List, and Gantt consume the same authoritative result.
      setEditedTask(savedTask);
      dispatch(upsertTask(savedTask));
      setEditingField(null);
      onTaskUpdate?.(taskId, savedTask);
    } catch (err) {
      console.error('Error updating field:', err);
      setError(t('tasks.cannotUpdate'));
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel editing — revert field to original
  const cancelEdit = () => {
    setEditedTask(task);
    setEditingField(null);
  };

  // Render nội dung HTML an toàn
  const renderHTML = (html?: string) => {
    if (!html) return null;
    return <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  // Sync saved comments from GraphQL query (exclude optimistic/failed local ones)
  useEffect(() => {
    if (commentsData?.task_comments) {
      setComments(prev => {
        const localPending = prev.filter(c => c.status === 'pending' || c.status === 'failed');
        const fromApi: Comment[] = commentsData.task_comments.map((c: any) => ({
          id: c.id,
          content: c.content,
          user_id: c.user_id,
          username: c.username || '',
          avatar_url: c.avatar_url || undefined,
          created_at: c.created_at,
          status: 'saved' as const,
        }));
        // Merge: API comments + any still-pending local ones not yet in API response
        const apiIds = new Set(fromApi.map(c => c.id));
        const pendingNotYetSaved = localPending.filter(c => !apiIds.has(c.id));
        return [...fromApi, ...pendingNotYetSaved];
      });
    }
  }, [commentsData]);

  const handleSubmitComment = async () => {
    if (isTiptapContentEmpty(newComment) || !currentUser) return;
    const taskId = task.task_id || task.id;
    if (!taskId) return;

    // Process blob image URLs before submitting
    let processedContent = newComment;
    const hasImages = newComment.includes('<img');
    const containsBlob = newComment.includes('blob:');
    if (hasImages && containsBlob) {
      try {
        processedContent = await imageService.processHtmlContent(newComment);
      } catch (err) {
        console.error('Error processing images:', err);
      }
    }

    // Clear input and add optimistic comment immediately
    setNewComment('');
    const tempId = `temp-${Date.now()}`;
    const tempComment: Comment = {
      id: tempId,
      content: processedContent,
      user_id: currentUser.id || '',
      username: currentUser.name || '',
      avatar_url: currentUser.providerData?.[0]?.photoURL || undefined,
      created_at: new Date().toISOString(),
      status: 'pending',
    };
    setComments(prev => [...prev, tempComment]);
    commentEditorRef.current?.focus();

    try {
      setIsPostingComment(true);
      setError(null);
      const { data } = await createComment({
        variables: { input: { task_id: taskId, content: processedContent } }
      });
      if (data?.create_comment) {
        const saved = data.create_comment;
        setComments(prev => prev.map(c => c.id === tempId ? {
          id: saved.id,
          content: saved.content,
          user_id: saved.user_id,
          username: saved.username || currentUser.name || '',
          avatar_url: saved.avatar_url || currentUser.providerData?.[0]?.photoURL || undefined,
          created_at: saved.created_at,
          status: 'saved',
        } : c));
        imageService.cleanupUnusedImages?.();
      }
    } catch (err) {
      console.error('Error posting comment:', err);
      setError(t('tasks.comments.cannotSend'));
      setComments(prev => prev.map(c => c.id === tempId ? { ...c, status: 'failed' } : c));
    } finally {
      setIsPostingComment(false);
    }
  };


  const statusOptions = EDITABLE_TASK_STATUSES.map(s => ({
    value: s, label: getStatusLabel(s)
  }));
  const priorityOptions = Object.values(Priorities).map(p => ({
    value: p, label: getPriorityLabel(p)
  }));

  // Reusable editable field renderer — matches TaskDetailPage pattern
  const renderEditableField = (
    label: string,
    fieldName: string,
    type: 'text' | 'select' | 'date' | 'number' = 'text',
    options?: { value: string; label: string }[],
    displayRenderer?: (val: any) => React.ReactNode
  ) => {
    const val = (editedTask as any)[fieldName];
    const originalVal = (task as any)[fieldName];

    // Edit mode for this field
    if (editingField === fieldName) {
      return (
        <div>
          <span className="text-xs text-slate-500 block mb-1">{label}</span>
          {type === 'select' && options ? (
            <select
              value={val || ''}
              onChange={(e) => setEditedTask({ ...editedTask, [fieldName]: e.target.value } as Task)}
              className="w-full text-sm rounded-md border-slate-300 focus:border-blue-500 focus:ring-blue-500 px-2 py-1.5"
            >
              {options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : type === 'date' ? (
            <div className="flex items-center gap-1">
              <input
                type="date"
                aria-label={label}
                value={val?.split?.('T')?.[0] || val || ''}
                onChange={(e) => setEditedTask({ ...editedTask, [fieldName]: e.target.value || null } as Task)}
                className="flex-1 text-sm rounded-md border-slate-300 focus:border-blue-500 focus:ring-blue-500 px-2 py-1.5"
              />
              <button
                type="button"
                onClick={() => setEditedTask({ ...editedTask, [fieldName]: null } as Task)}
                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                aria-label={`Clear ${label}`}
              >
                Clear
              </button>
            </div>
          ) : type === 'number' ? (
            <input
              type="number"
              value={val ?? ''}
              onChange={(e) => setEditedTask({ ...editedTask, [fieldName]: e.target.value } as Task)}
              min={0}
              max={fieldName === 'progress' ? 100 : undefined}
              step={fieldName === 'effort' ? 0.5 : 1}
              className="w-full text-sm rounded-md border-slate-300 focus:border-blue-500 focus:ring-blue-500 px-2 py-1.5"
            />
          ) : (
            <input
              type="text"
              value={val || ''}
              onChange={(e) => setEditedTask({ ...editedTask, [fieldName]: e.target.value } as Task)}
              className="w-full text-sm rounded-md border-slate-300 focus:border-blue-500 focus:ring-blue-500 px-2 py-1.5"
            />
          )}
          <div className="flex mt-1.5 gap-1">
            <button
              onClick={() => saveField(fieldName)}
              disabled={isSaving}
              className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-full transition-colors disabled:opacity-50"
              title={t('tasks.confirm')}
            >
              {isSaving ? (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <CheckIcon className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={cancelEdit}
              className="p-1 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              title={t('tasks.actions.cancel')}
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      );
    }

    // Display mode — click to edit
    let displayContent: React.ReactNode;
    if (displayRenderer) {
      displayContent = displayRenderer(val);
    } else if (type === 'date') {
      displayContent = val ? formatDate(val) : <span className="text-slate-400 italic">{`${t('tasks.notSet')}`}</span>;
    } else if (type === 'number') {
      displayContent = val !== undefined && val !== null && val !== '' ? String(val) : <span className="text-slate-400 italic">{`${t('tasks.notSet')}`}</span>;
    } else {
      displayContent = val || <span className="text-slate-400 italic">{`${t('tasks.notSet')}`}</span>;
    }

    return (
      <div>
        <span className="text-xs text-slate-500 block mb-1">{label}</span>
        <div
          onClick={() => setEditingField(fieldName)}
          className="group cursor-pointer rounded px-2 py-1 -mx-2 transition-colors hover:bg-slate-100 flex items-center gap-1"
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter') setEditingField(fieldName); }}
        >
          <span className="flex-1 text-sm text-slate-900">{displayContent}</span>
          <PencilIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
        </div>
      </div>
    );
  };

  const renderCatalogField = (
    label: string,
    fieldName: 'progressCatalogItemId' | 'categoryCatalogItemId' | 'taskTypeCatalogItemId',
    kind: ProjectCatalogKind,
    legacyLabel?: string | null,
  ) => (
    <div>
      <span className="text-xs text-slate-500 block mb-1">{label}</span>
      <ProjectCatalogSelect
        projectId={editedTask.project_id}
        kind={kind}
        label={label}
        value={editedTask[fieldName]}
        legacyLabel={legacyLabel}
        disabled={editingField !== fieldName || isSaving}
        onChange={(value) => setEditedTask({ ...editedTask, [fieldName]: value })}
      />
      {editingField === fieldName ? (
        <div className="flex mt-1.5 gap-1">
          <button type="button" onClick={() => void saveField(fieldName)} disabled={isSaving} aria-label={`Save ${label}`} className="p-1 text-green-600 disabled:opacity-50"><CheckIcon className="h-4 w-4" /></button>
          <button type="button" onClick={cancelEdit} aria-label={`Cancel ${label}`} className="p-1 text-red-500"><XMarkIcon className="h-4 w-4" /></button>
        </div>
      ) : (
        <button type="button" onClick={() => setEditingField(fieldName)} className="mt-1 text-xs text-blue-600">Edit {label.toLowerCase()}</button>
      )}
    </div>
  );

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={t('tasks.detailTitle')}
      className="w-[calc(100%-64px)] max-w-[900px]"
      preventBackdropClose
    >
      <div className="relative p-6 space-y-6">
        {/* Close button (top-right) */}
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void handleDelete()}
          className="absolute top-4 right-12 px-2 py-1 text-sm text-red-600 hover:text-red-700 disabled:opacity-50 z-10"
        >
          Delete
        </button>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors z-10"
          title={t('common.close')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-3 flex items-center gap-2">
            <svg className="h-4 w-4 text-red-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Inline hint */}
        <p className="text-xs text-slate-400">{t('tasks.editHint')}</p>

        {/* Title */}
        {renderEditableField(t('tasks.fields.title'), 'title', 'text')}

        {/* Status + Priority */}
        <div className="flex flex-wrap gap-4 items-start">
          {renderEditableField(t('tasks.fields.status'), 'status', 'select', statusOptions, (v: string) => (
            <span className={clsx("px-2.5 py-1 rounded-full text-xs font-medium", getStatusColor(v as TaskStatus))}>
              {getStatusLabel(v)}
            </span>
          ))}
          {renderEditableField(t('tasks.fields.priority'), 'priority', 'select', priorityOptions, (v: string) => (
            <span className={clsx("px-2.5 py-1 rounded-full text-xs font-medium", getPriorityColor(v as Priority))}>
              {getPriorityLabel(v)}
            </span>
          ))}
          {editedTask.due_date && (
            <div>
              <span className="text-xs text-slate-500 block mb-1">&nbsp;</span>
              <span className={clsx(
                "px-2.5 py-1 rounded-full text-xs font-medium",
                new Date(editedTask.due_date) < new Date() ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
              )}>
                {calculateDaysRemaining()}
              </span>
            </div>
          )}
        </div>

        {/* Description (read-only display, editable if empty) */}
        <div>
          <span className="text-xs text-slate-500 block mb-1">{t('tasks.descriptionField')}</span>
          {editedTask.description ? (
            <div className="bg-slate-50 p-4 rounded-md">
              <div className="text-slate-700 rich-text-content text-sm">
                {renderHTML(editedTask.description)}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic px-2 py-1">{t('tasks.noDescription')}</p>
          )}
        </div>

        {/* Detail grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-md">
          {/* Assignee (editable) */}
          <div>
            <span className="text-xs text-slate-500 block mb-1">{t('tasks.fields.assignedTo')}</span>
            {editingField === 'assignee' ? (
              <div>
                <select
                  aria-label={t('tasks.fields.assignedTo')}
                  value={editedTask.assignee_resource_member_id || ''}
                  onChange={(e) => setEditedTask({
                    ...editedTask,
                    assignee_resource_member_id: e.target.value || null,
                  })}
                  className="w-full text-sm rounded-md border-slate-300 focus:border-blue-500 focus:ring-blue-500 px-2 py-1.5"
                >
                  <option value="">{t('tasks.notAssigned')}</option>
                  {resourceMembers.map(member => (
                    <option key={member.resource_member_id} value={member.resource_member_id}>
                      {member.display_name}
                    </option>
                  ))}
                </select>
                <div className="flex mt-1.5 gap-1">
                  <button
                    onClick={() => saveField('assignee')}
                    disabled={isSaving}
                    className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-full transition-colors disabled:opacity-50"
                    title={t('tasks.confirm')}
                  >
                    {isSaving ? (
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <CheckIcon className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="p-1 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                    title={t('tasks.actions.cancel')}
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setEditingField('assignee')}
                className="group cursor-pointer rounded px-2 py-1 -mx-2 transition-colors hover:bg-slate-100 flex items-center gap-1"
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') setEditingField('assignee'); }}
              >
                {editedTask.assignee_resource_member_id || editedTask.assignee ? (
                  <span className="flex-1 text-sm text-slate-900">
                    {resourceMembers.find(member => member.resource_member_id === editedTask.assignee_resource_member_id)?.display_name
                      ?? editedTask.assignee?.username
                      ?? t('tasks.notAssigned')}
                  </span>
                ) : (
                  <span className="flex-1 text-sm text-slate-400 italic">{t('tasks.notAssigned')}</span>
                )}
                <PencilIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
              </div>
            )}
          </div>

          {/* Creator (read-only) */}
          <div>
            <span className="text-xs text-slate-500 block mb-1">{t('tasks.fields.createdBy')}</span>
            <p className="px-2 py-1 text-sm text-slate-900">
              {typeof editedTask.created_by === 'object'
                ? ((editedTask.created_by as any)?.full_name || (editedTask.created_by as any)?.username || '-')
                : typeof editedTask.created_by === 'string'
                  ? (() => {
                      const creatorMember = projectMembers?.find(m => m.user.userId === editedTask.created_by);
                      const name = creatorMember?.user.fullName || creatorMember?.user.username || '-';
                      return creatorMember?.position ? `${name} (${creatorMember.position})` : name;
                    })()
                  : '-'}
            </p>
          </div>

          {renderEditableField(t('tasks.fields.startDate'), 'start_date', 'date')}
          {renderEditableField(t('tasks.fields.dueDate'), 'due_date', 'date')}
          {renderEditableField(t('tasks.fields.actualStartDate'), 'actual_start_date', 'date')}
          {renderEditableField(t('tasks.fields.actualEndDate'), 'actual_end_date', 'date')}
          {renderEditableField(t('tasks.fields.effort'), 'effort', 'number', undefined, (v: any) => (
            v ? formatEffort(Number(v)) : <span className="text-slate-400 italic">{t('tasks.notEstimated')}</span>
          ))}
          {renderEditableField(t('tasks.fields.progress'), 'progress', 'number', undefined, (v: any) => (
            <div className="flex items-center gap-2">
              <div className="w-24 bg-slate-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${Number(v) || 0}%` }}></div>
              </div>
              <span className="text-xs text-slate-700">{v || 0}%</span>
            </div>
          ))}
          {renderCatalogField(t('tasks.fields.progressType'), 'progressCatalogItemId', 'PROGRESS_TYPE', editedTask.progress_type)}
          {renderCatalogField(t('tasks.fields.category'), 'categoryCatalogItemId', 'CATEGORY', editedTask.category)}
          {renderCatalogField(t('tasks.fields.taskType'), 'taskTypeCatalogItemId', 'TASK_TYPE', editedTask.type)}

          {/* Created at (read-only) */}
          <div>
            <span className="text-xs text-slate-500 block mb-1">{t('tasks.fields.createdAt')}</span>
            <p className="px-2 py-1 text-sm text-slate-900">{formatDate(task.created_at)}</p>
          </div>

          {/* Updated at (read-only) */}
          <div>
            <span className="text-xs text-slate-500 block mb-1">{t('tasks.fields.lastUpdated')}</span>
            <p className="px-2 py-1 text-sm text-slate-900">{formatDate(task.updated_at)}</p>
          </div>

          {/* Tags — editable chip input, full width */}
          <div className="col-span-2">
            <span className="text-xs text-slate-500 block mb-1">Tags</span>
            {editingField === 'tags' ? (
              <div>
                <TagInput
                  value={Array.isArray(editedTask.tags) ? editedTask.tags : []}
                  onChange={(tags) => setEditedTask({ ...editedTask, tags })}
                  placeholder="Nhap tag, Enter hoac dau phay de them..."
                  className="border-slate-300"
                />
                <div className="flex mt-1.5 gap-1">
                  <button
                    onClick={() => saveField('tags')}
                    disabled={isSaving}
                    className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-full transition-colors disabled:opacity-50"
                    title={t('tasks.confirm')}
                  >
                    {isSaving ? (
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <CheckIcon className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="p-1 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                    title={t('tasks.actions.cancel')}
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="flex flex-wrap gap-1 cursor-pointer min-h-[32px] px-2 py-1.5 rounded-md border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-colors"
                onClick={() => setEditingField('tags')}
              >
                {Array.isArray(editedTask.tags) && editedTask.tags.length > 0 ? (
                  editedTask.tags.map((tag, i) => (
                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">{t('tasks.noTagsHint')}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Comments section */}
        <div className="mt-4">
          <h3 className="text-base font-semibold text-slate-800 mb-3">{t('tasks.commentsCount', { count: comments.length })}</h3>

          {isLoading && (
            <div className="flex justify-center py-4">
              <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          )}

          {!isLoading && (
            <div className="space-y-4 mb-6">
              {comments.map((comment) => (
                <div key={comment.id} className={`p-4 rounded-md ${comment.status === 'failed' ? 'bg-red-50 border border-red-200' : comment.status === 'pending' ? 'bg-gray-50 opacity-70' : 'bg-gray-50'}`}>
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      {comment.avatar_url ? (
                        <img className="h-10 w-10 rounded-full" src={comment.avatar_url} alt={comment.username} />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600">
                          {comment.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="ml-3 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-900">{comment.username}</div>
                        {comment.status === 'pending' && <span className="text-xs text-gray-400">{t('tasks.posting')}</span>}
                        {comment.status === 'failed' && <span className="text-xs text-red-500">{t('tasks.postFailed')}</span>}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(comment.created_at).toLocaleDateString(undefined, {
                          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                      <div className="mt-1 text-sm text-gray-700 rich-text-content">
                        {renderHTML(comment.content)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {!isLoading && comments.length === 0 && (
                <p className="text-gray-500 text-center py-4">{t('tasks.comments.noComments')}</p>
              )}
            </div>
          )}

          {currentUser && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('tasks.addNewComment')}
              </label>
              <AdvancedEditor
                ref={commentEditorRef}
                value={newComment}
                onChange={setNewComment}
                placeholder={t('tasks.commentPlaceholder')}
                mode="compact"
                minHeight="100px"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSubmitComment}
                  disabled={isTiptapContentEmpty(newComment) || isPostingComment}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPostingComment ? t('tasks.posting') : t('tasks.postComment')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
