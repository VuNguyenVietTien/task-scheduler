'use client';

import React, { useState } from 'react';
import { formatDistance } from 'date-fns';
import { vi } from 'date-fns/locale';

export interface Comment {
  id: string;
  content: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  created_at: string;
  updated_at?: string;
  task_id: string;
}

interface CommentCardProps {
  comment: Comment;
  currentUserId?: string;
  onDelete?: (commentId: string) => void;
}

export function CommentCard({ comment, currentUserId, onDelete }: CommentCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Định dạng thời gian
  const formatDate = (dateString: string) => {
    return formatDistance(new Date(dateString), new Date(), {
      addSuffix: true,
      locale: vi,
    });
  };

  // Render nội dung HTML an toàn
  const renderHTML = (html: string) => {
    return { __html: html };
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {/* Avatar */}
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

        {/* Nội dung comment */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-gray-900">
              {comment.username}
            </h3>
            <div className="text-xs text-gray-500">
              {formatDate(comment.created_at)}
            </div>
          </div>
          
          <div
            className="prose prose-sm max-w-none text-gray-700 overflow-auto"
            dangerouslySetInnerHTML={renderHTML(comment.content)}
          />
        </div>

        {/* Tùy chọn xóa comment (chỉ hiển thị với người tạo comment) */}
        {currentUserId === comment.user_id && onDelete && (
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Tùy chọn bình luận"
              title="Tùy chọn bình luận"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-gray-500"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-8 w-36 py-2 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onDelete(comment.id);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  Xóa bình luận
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 