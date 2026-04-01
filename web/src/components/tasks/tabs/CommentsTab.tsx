import React, { useState, useEffect } from 'react';
import { Task, TaskComment } from '@/types/task';
import { User } from '@/contexts/AuthContext';
import Image from 'next/image';
import { FiSend } from 'react-icons/fi';
import { detectMentions, isTiptapContentEmpty } from '@/utils/mentionUtils';
import { useMutation } from '@apollo/client';
import { CREATE_NOTIFICATION } from '@/graphql/mutations/notifications';
import { useTranslation } from 'react-i18next';
import { AdvancedEditor } from '@/components/common/AdvancedEditor';

// Extend TaskComment interface to match actual data shape
interface ExtendedTaskComment extends TaskComment {
  comment_id?: string;
  user?: {
    userId: string;
    email?: string;
    fullName?: string;
    username: string;
    avatarUrl?: string;
  };
}

interface CommentsTabProps {
  task: Task;
  comments: ExtendedTaskComment[];
  commentText: string;
  setCommentText: (text: string) => void;
  isSubmittingComment: boolean;
  handleSubmitComment: () => Promise<void>;
  currentUser?: User;
  formatDate: (dateString?: string) => string;
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
}

export default function CommentsTab({
  task,
  comments,
  commentText,
  setCommentText,
  isSubmittingComment,
  handleSubmitComment,
  currentUser,
  formatDate,
  projectMembers = []
}: CommentsTabProps) {
  const { t } = useTranslation();
  const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null);
  const [mentionedUsers, setMentionedUsers] = useState<string[]>([]);

  const [createNotification] = useMutation(CREATE_NOTIFICATION);

  const adaptedCurrentUser = currentUser ? {
    userId: currentUser.id || '',
    email: currentUser.email || '',
    fullName: currentUser.name || '',
    username: currentUser.name || '',
    avatarUrl: currentUser.providerData?.[0]?.photoURL || ''
  } : undefined;

  useEffect(() => {
    if (!isTiptapContentEmpty(commentText)) {
      const mentions = detectMentions(commentText);
      setMentionedUsers(mentions);
    } else {
      setMentionedUsers([]);
    }
  }, [commentText]);

  const handleCommentWithMentions = async () => {
    try {
      await handleSubmitComment();

      if (mentionedUsers.length > 0 && currentUser && task) {
        const commenterName = currentUser.name || 'A user';
        const taskTitle = task.title || 'Untitled task';
        const taskId = task.task_id || task.id || '';
        const projectId = task.project_id || '';

        for (const username of mentionedUsers) {
          const mentionedUser = projectMembers.find(
            member => member.user.username.toLowerCase() === username.toLowerCase() ||
                      member.user.fullName.toLowerCase() === username.toLowerCase()
          );

          if (mentionedUser) {
            await createNotification({
              variables: {
                input: {
                  userId: mentionedUser.user.userId,
                  title: `Mentioned by ${commenterName}`,
                  message: `${commenterName} mentioned you in a comment on task "${taskTitle}"`,
                  type: 'COMMENT_MENTION',
                  projectId,
                  taskId
                }
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Error handling comment with mentions:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg">
      <h2 className="text-lg font-medium text-gray-900 mb-4">{t('tasks.comments.title')}</h2>

      {/* Comment list */}
      <div className="space-y-4 mb-6">
        {comments && comments.length > 0 ? (
          comments.map((comment) => (
            <div
              key={comment.comment_id || comment.id}
              className="p-3 bg-gray-50 rounded-lg"
              onMouseEnter={() => setHoveredCommentId(comment.comment_id || comment.id)}
              onMouseLeave={() => setHoveredCommentId(null)}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  {comment.user?.avatarUrl ? (
                    <Image
                      src={comment.user.avatarUrl}
                      alt={comment.user.username || comment.username || 'User'}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                  ) : comment.avatar_url ? (
                    <Image
                      src={comment.avatar_url}
                      alt={comment.username || 'User'}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                      {((comment.user?.username || comment.username || 'U')).charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">
                        {comment.user?.username || comment.username || t('common.unknown')}
                      </h4>
                      <p className="text-xs text-gray-500">{formatDate(comment.created_at)}</p>
                    </div>
                    {hoveredCommentId === (comment.comment_id || comment.id) &&
                     ((adaptedCurrentUser?.userId === comment.user?.userId) || (adaptedCurrentUser?.userId === comment.user_id)) && (
                      <button
                        type="button"
                        className="text-gray-400 hover:text-gray-500"
                      >
                        <span className="sr-only">{t('tasks.comments.deleteComment')}</span>
                        <svg
                          className="h-5 w-5"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div
                    className="mt-1 text-sm text-gray-700 comment-content"
                    dangerouslySetInnerHTML={{ __html: comment.content }}
                  />
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-6 text-gray-500">
            <p>{t('tasks.comments.noComments')}</p>
            <p className="text-sm mt-1">{t('tasks.comments.noCommentsFirst').split('.').slice(1).join('.').trim()}</p>
          </div>
        )}
      </div>

      {/* New comment form */}
      <div className="mt-6">
        <div className="mb-3">
          <AdvancedEditor
            value={commentText}
            onChange={setCommentText}
            placeholder={t('tasks.comments.placeholder')}
            mode="compact"
            minHeight="128px"
            projectMembers={projectMembers}
          />
        </div>
        {mentionedUsers.length > 0 && (
          <div className="mb-3 text-sm text-blue-600">
            <p>{t('tasks.comments.mentioned', { users: mentionedUsers.join(', ') })}</p>
          </div>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
              isSubmittingComment || isTiptapContentEmpty(commentText)
                ? 'bg-blue-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            }`}
            onClick={handleCommentWithMentions}
            disabled={isSubmittingComment || isTiptapContentEmpty(commentText)}
          >
            <FiSend className="mr-2" />
            {isSubmittingComment ? t('tasks.comments.submitting') : t('tasks.comments.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
