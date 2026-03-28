'use client';

import React from 'react';
import { Task } from '@/types/task';
import { User } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import dynamic from 'next/dynamic';
import { useMutation, useQuery } from '@apollo/client';
import { GET_TASK_COMMENTS } from '@/graphql/queries/tasks';
import { CREATE_TASK_COMMENT } from '@/graphql/mutations/tasks';
import { formatDistance } from 'date-fns';
import { vi } from 'date-fns/locale';

// Types
export interface TaskDetailPageProps {
  task: Task;
  projectId: string;
  currentUser?: User;
  onTaskUpdate: (updates: Partial<Task>) => Promise<boolean>;
  isLoadingProp?: boolean;
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

interface Comment {
  id: string;
  content: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  created_at: string;
  status?: 'pending' | 'failed' | 'saved' | 'local';
}

interface TaskCommentsData {
  taskComments: Comment[];
}

interface CreateCommentResponse {
  create_comment: Comment;
}

// Dynamically import editor
const RichTextEditor = dynamic(() => import('@/components/common/RichTextEditor'), {
  ssr: false,
  loading: () => <Spinner />
});

// Editor component with hooks
const Editor = ({
  value,
  onChange,
  placeholder,
  isCompact = false,
  inputRef
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isCompact?: boolean;
  inputRef?: React.RefObject<any>;
}) => {
  return (
    <RichTextEditor
      ref={inputRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      mode={isCompact ? 'compact' : 'full'}
      minHeight={isCompact ? '150px' : '300px'}
    />
  );
};

// Description section component
const Description: React.FC<{
  task: Task;
  onUpdate: (description: string) => Promise<void>;
}> = ({ task, onUpdate }) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [content, setContent] = React.useState(task.description || '');
  const [isSaving, setIsSaving] = React.useState(false);
  const editorRef = React.useRef<any>(null);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(content);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return isEditing ? (
    <div className="space-y-4">
      <Editor
        value={content}
        onChange={setContent}
        placeholder="Enter task description..."
        inputRef={editorRef}
      />
      <div className="flex justify-end space-x-3">
        <Button
          variant="outline"
          onClick={() => {
            setContent(task.description || '');
            setIsEditing(false);
          }}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving && <Spinner size="sm" className="mr-2" />}
          Save Description
        </Button>
      </div>
    </div>
  ) : (
    <div 
      className="prose prose-indigo max-w-none p-6 bg-white rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={() => setIsEditing(true)}
    >
      {task.description ? (
        <div dangerouslySetInnerHTML={{ __html: task.description }} />
      ) : (
        <div className="text-center text-gray-500">
          <p>Click to add description</p>
        </div>
      )}
    </div>
  );
};

// Comment section component
const Comments: React.FC<{
  taskId: string | undefined;
  currentUser?: User;
}> = ({ taskId, currentUser }) => {
  const [content, setContent] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const commentRef = React.useRef<any>(null);

  // Fetch comments
  const { data: commentsData, loading: commentsLoading } = useQuery<TaskCommentsData>(GET_TASK_COMMENTS, {
    variables: { taskId },
    skip: !taskId
  });

  // Create comment mutation
  const [createComment, { loading: isSubmitting }] = useMutation<CreateCommentResponse>(CREATE_TASK_COMMENT, {
    update(cache, { data }) {
      if (!data?.create_comment || !taskId) return;

      const existingData = cache.readQuery<TaskCommentsData>({
        query: GET_TASK_COMMENTS,
        variables: { taskId }
      });

      const existingComments = existingData?.taskComments || [];

      cache.writeQuery<TaskCommentsData>({
        query: GET_TASK_COMMENTS,
        variables: { taskId },
        data: {
          taskComments: [...existingComments, data.create_comment]
        }
      });
    },
    onError: (error) => {
      setError('Failed to post comment. Please try again.');
      console.error('Error posting comment:', error);
    }
  });

  const handleSubmit = async () => {
    if (!content.trim() || !taskId || !currentUser) return;

    try {
      setError(null);
      await createComment({
        variables: {
          input: {
            taskId,
            content: content.trim()
          }
        }
      });
      setContent('');
    } catch (err) {
      // Error is handled by onError in mutation config
    }
  };

  if (!taskId) {
    return null;
  }

  const comments = commentsData?.taskComments || [];

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-lg font-medium mb-4">Add Comment</h3>
        <div className="space-y-4">
          <Editor
            value={content}
            onChange={setContent}
            placeholder="Write your comment..."
            isCompact
            inputRef={commentRef}
          />
          {error && (
            <div className="text-sm text-red-600">
              {error}
            </div>
          )}
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!content.trim() || isSubmitting}
            >
              {isSubmitting && <Spinner size="sm" className="mr-2" />}
              Post Comment
            </Button>
          </div>
        </div>
      </div>

      {/* Comments list */}
      <div className="space-y-4">
        {commentsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : comments.length > 0 ? (
          comments.map((comment: Comment) => (
            <div 
              key={comment.id}
              className={`bg-white p-6 rounded-lg border ${
                comment.status === 'pending' ? 'border-blue-200 bg-blue-50' :
                comment.status === 'failed' ? 'border-red-200 bg-red-50' :
                'border-gray-200'
              } shadow-sm`}
            >
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  {comment.avatar_url ? (
                    <img
                      src={comment.avatar_url}
                      alt={comment.username}
                      className="h-10 w-10 rounded-full"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-600 font-medium">
                        {comment.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-grow">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{comment.username}</span>
                    <span className="text-sm text-gray-500">
                      {formatDistance(new Date(comment.created_at), new Date(), {
                        addSuffix: true,
                        locale: vi
                      })}
                    </span>
                  </div>
                  <div 
                    className="mt-2 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: comment.content }}
                  />
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            No comments yet. Be the first to comment!
          </div>
        )}
      </div>
    </div>
  );
};

// Main component
const TaskDetailPage: React.FC<TaskDetailPageProps> = ({
  task,
  projectId,
  currentUser,
  onTaskUpdate,
  isLoadingProp = false,
  projectMembers
}) => {
  const taskId = task.task_id || task.id;
  
  const handleDescriptionUpdate = async (description: string) => {
    await onTaskUpdate({ description });
  };

  if (!taskId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-gray-500">
          <p>Invalid task ID</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Description</h2>
          <Description task={task} onUpdate={handleDescriptionUpdate} />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Comments</h2>
          <Comments taskId={taskId} currentUser={currentUser} />
        </div>
      </Card>
    </div>
  );
};

export default TaskDetailPage;