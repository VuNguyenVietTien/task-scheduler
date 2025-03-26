'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useMutation } from '@apollo/client';
import { DELETE_TASK_COMMENT } from '@/graphql/mutations/tasks';

export interface Comment {
  id: string;
  content: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  created_at: string;
  task_id?: string;
  updated_at?: string;
  status?: 'pending' | 'saved' | 'failed';
  error?: string;
}

export interface CommentCardProps {
  comment: Comment;
  currentUserId?: string;
  onDelete?: (id: string) => void;
}

export function CommentCard({ comment, currentUserId, onDelete }: CommentCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // GraphQL mutation để xóa comment
  const [deleteComment] = useMutation(DELETE_TASK_COMMENT);

  // Format thời gian đăng bình luận
  const formattedDate = (() => {
    try {
      return format(new Date(comment.created_at), 'HH:mm - dd/MM/yyyy', { locale: vi });
    } catch (e) {
      return 'Chưa rõ thời gian';
    }
  })();

  // Xử lý khi người dùng muốn xóa comment
  const handleDelete = async () => {
    setIsMenuOpen(false);
    
    // Nếu đang xóa, không làm gì cả
    if (isDeleting) return;
    
    setIsDeleting(true);
    
    try {
      // Gọi callback để cập nhật UI và gọi API xóa comment
      if (onDelete) {
        onDelete(comment.id);
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Không thể xóa bình luận. Vui lòng thử lại sau.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex space-x-4 mb-4">
      {/* Avatar */}
      <div className="flex-shrink-0">
        {comment.avatar_url ? (
          <img
            src={comment.avatar_url}
            alt={`Avatar của ${comment.username}`}
            className="h-10 w-10 rounded-full"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
            <span className="text-gray-600 font-medium text-sm">
              {comment.username?.substring(0, 2).toUpperCase() || 'UN'}
            </span>
          </div>
        )}
      </div>

      {/* Comment content */}
      <div className="flex-1 bg-gray-50 rounded-lg p-3">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="font-medium text-gray-900">{comment.username}</h4>
            <p className="text-xs text-gray-500">{formattedDate}</p>
          </div>
          
          {currentUserId === comment.user_id && (
            <div className="relative">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Tùy chọn bình luận"
                title="Tùy chọn bình luận"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-gray-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                )}
              </button>

              {isMenuOpen && !isDeleting && (
                <div className="absolute right-0 top-8 w-36 py-2 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  <button
                    onClick={handleDelete}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Xóa bình luận
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="mt-2 text-sm text-gray-700 comment-content" dangerouslySetInnerHTML={{ __html: comment.content }} />
      </div>
    </div>
  );
} 