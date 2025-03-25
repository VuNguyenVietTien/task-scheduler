'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_TASK_COMMENTS } from '@/graphql/queries/tasks';
import { CREATE_TASK_COMMENT } from '@/graphql/mutations/tasks';
import { CommentCard, Comment as CommentType } from '@/components/common/CommentCard';
import AdvancedEditor from '@/components/common/AdvancedEditor';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { User } from '@/contexts/AuthContext';

// Định nghĩa kiểu dữ liệu cho API Comment
interface ApiComment {
  id: string;
  content: string;
  authorId: string;
  username: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// Định nghĩa kiểu dữ liệu cho response của GET_TASK_COMMENTS
interface TaskCommentsData {
  taskComments: ApiComment[];
}

// Định nghĩa kiểu dữ liệu cho input của CREATE_COMMENT
interface CreateCommentInput {
  taskId: string;
  content: string;
}

// Định nghĩa kiểu dữ liệu cho response của CREATE_COMMENT
interface CreateCommentData {
  createComment: ApiComment;
}

// Định nghĩa kiểu dữ liệu cho local comment
interface LocalComment extends CommentType {
  status: 'saved' | 'pending' | 'failed';
  error?: string;
}

// Props của component
interface CommentSectionProps {
  taskId: string;
  currentUser: User | null;
}

export default function CommentSection({ taskId, currentUser }: CommentSectionProps) {
  const [comments, setComments] = useState<LocalComment[]>([]);
  const [newComment, setNewComment] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [localComments, setLocalComments] = useState<LocalComment[]>([]);
  
  // Query để lấy danh sách comments
  const { data: commentsData, loading: commentsLoading, error: commentsError, refetch } = useQuery<TaskCommentsData>(
    GET_TASK_COMMENTS,
    {
      variables: { taskId },
      fetchPolicy: 'cache-and-network',
      skip: !taskId,
    }
  );
  
  // Mutation để tạo comment mới
  const [createComment, { loading: createLoading }] = useMutation<CreateCommentData, { input: CreateCommentInput }>(
    CREATE_TASK_COMMENT
  );
  
  // Chuyển đổi từ API comment sang định dạng CommentType
  const mapApiToComment = (apiComment: ApiComment, status: 'saved' | 'pending' | 'failed' = 'saved'): LocalComment => ({
    id: apiComment.id,
    content: apiComment.content,
    user_id: apiComment.authorId,
    username: apiComment.username,
    avatar_url: apiComment.avatarUrl,
    created_at: apiComment.createdAt,
    updated_at: apiComment.updatedAt,
    task_id: taskId,
    status
  });
  
  // Cập nhật danh sách comments khi có dữ liệu mới
  useEffect(() => {
    if (commentsData?.taskComments) {
      // Format comments từ API
      const formattedComments = commentsData.taskComments.map(comment => 
        mapApiToComment(comment)
      );
      
      // Kết hợp comments từ API với local comments đang chờ xử lý
      const pendingOrFailedComments = localComments.filter(c => c.status === 'pending' || c.status === 'failed');
      
      setComments([...formattedComments, ...pendingOrFailedComments]);
      setLoading(false);
    }
  }, [commentsData, localComments, taskId]);
  
  // Cập nhật state loading
  useEffect(() => {
    setLoading(commentsLoading);
  }, [commentsLoading]);
  
  // Cập nhật state error
  useEffect(() => {
    if (commentsError) {
      setError('Không thể tải bình luận. Vui lòng thử lại sau.');
    } else {
      setError(null);
    }
  }, [commentsError]);
  
  // Xử lý gửi comment mới
  const handleSubmitComment = async () => {
    if (!newComment || !newComment.trim() || !currentUser) return;
    
    // Tạo một ID tạm thời cho comment đang chờ xử lý
    const tempId = `temp-${Date.now()}`;
    const commentContent = newComment.trim();
    
    try {
      // Tạo comment tạm thời để hiển thị ngay lập tức
      const tempComment: LocalComment = {
        id: tempId,
        content: commentContent,
        user_id: currentUser.id || 'unknown',
        username: currentUser.name || currentUser.email || 'Người dùng',
        avatar_url: undefined, // User có thể không có avatar
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        task_id: taskId,
        status: 'pending'
      };
      
      // Thêm comment tạm thời vào state
      setLocalComments(prev => [...prev, tempComment]);
      
      // Clear input
      setNewComment('');
      
      // Gọi API để tạo comment
      const { data } = await createComment({
        variables: {
          input: {
            taskId,
            content: commentContent
          }
        }
      });
      
      if (data?.createComment) {
        // Cập nhật state localComments, đánh dấu comment là đã lưu
        setLocalComments(prev => prev.map(c => 
          c.id === tempId 
            ? mapApiToComment(data.createComment) 
            : c
        ));
        
        // Refresh lại danh sách comments
        refetch();
      }
    } catch (err) {
      console.error('Error creating comment:', err);
      
      // Cập nhật state localComments, đánh dấu comment là thất bại
      setLocalComments(prev => prev.map(c => 
        c.id === tempId 
          ? { ...c, status: 'failed', error: 'Không thể gửi bình luận. Vui lòng thử lại.' } 
          : c
      ));
    }
  };
  
  // Xử lý thử lại gửi comment thất bại
  const handleRetryComment = async (commentId: string) => {
    const comment = localComments.find(c => c.id === commentId);
    if (!comment) return;
    
    // Cập nhật status thành pending
    setLocalComments(prev => prev.map(c => 
      c.id === commentId 
        ? { ...c, status: 'pending', error: undefined } 
        : c
    ));
    
    try {
      // Gọi API để tạo comment
      const { data } = await createComment({
        variables: {
          input: {
            taskId,
            content: comment.content
          }
        }
      });
      
      if (data?.createComment) {
        // Cập nhật state localComments, đánh dấu comment là đã lưu
        setLocalComments(prev => prev.map(c => 
          c.id === commentId 
            ? mapApiToComment(data.createComment)
            : c
        ));
        
        // Refresh lại danh sách comments
        refetch();
      }
    } catch (err) {
      console.error('Error retrying comment:', err);
      
      // Cập nhật state localComments, đánh dấu comment là thất bại
      setLocalComments(prev => prev.map(c => 
        c.id === commentId 
          ? { ...c, status: 'failed', error: 'Không thể gửi bình luận. Vui lòng thử lại.' } 
          : c
      ));
    }
  };
  
  // Xử lý xóa comment thất bại
  const handleDeleteFailedComment = (commentId: string) => {
    setLocalComments(prev => prev.filter(c => c.id !== commentId));
  };
  
  // Render comment dựa vào status
  const renderComment = (comment: LocalComment) => {
    switch (comment.status) {
      case 'pending':
        return (
          <div className="opacity-60">
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 flex-shrink-0 rounded-full overflow-hidden bg-gray-200">
                  {comment.avatar_url ? (
                    <img
                      src={comment.avatar_url}
                      alt={`Avatar của ${comment.username}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-blue-500 text-white font-medium">
                      {comment.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {comment.username}
                    </h3>
                    <div className="flex items-center text-xs text-gray-500">
                      <span>Đang gửi...</span>
                      <Spinner size="sm" className="ml-2" />
                    </div>
                  </div>
                  <div
                    className="prose prose-sm max-w-none text-gray-700 overflow-auto"
                    dangerouslySetInnerHTML={{ __html: comment.content }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      case 'failed':
        return (
          <div className="border border-red-300 rounded-lg p-4 mb-4">
            <CommentCard
              comment={comment}
              currentUserId={currentUser?.id}
            />
            <div className="mt-2 flex items-center justify-end space-x-2">
              <div className="text-sm text-red-500">{comment.error}</div>
              <Button 
                size="sm" 
                variant="secondary" 
                onClick={() => handleRetryComment(comment.id)}
              >
                Thử lại
              </Button>
              <Button 
                size="sm" 
                variant="danger" 
                onClick={() => handleDeleteFailedComment(comment.id)}
              >
                Xóa
              </Button>
            </div>
          </div>
        );
      default:
        return (
          <CommentCard 
            comment={comment}
            currentUserId={currentUser?.id}
          />
        );
    }
  };
  
  return (
    <div className="comments-section">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Bình luận</h2>
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center my-8">
          <Spinner size="md" />
        </div>
      ) : comments.length > 0 ? (
        <div className="space-y-4 mb-6">
          {comments.map(comment => (
            <div key={comment.id}>
              {renderComment(comment)}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>Chưa có bình luận nào. Hãy là người đầu tiên bình luận!</p>
        </div>
      )}
      
      {/* Comment editor */}
      <div className="mt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Thêm bình luận:</h3>
        <div className="border border-gray-300 rounded-lg overflow-hidden">
          <AdvancedEditor
            value={newComment}
            onChange={(content) => {
              try {
                setNewComment(content);
              } catch (error) {
                console.error('Lỗi khi cập nhật nội dung:', error);
              }
            }}
            placeholder="Viết bình luận của bạn..."
            mode="compact"
          />
          <div className="flex justify-end bg-gray-50 px-4 py-2">
            <Button
              onClick={handleSubmitComment}
              disabled={!newComment.trim() || createLoading}
              isLoading={createLoading}
            >
              Gửi bình luận
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 