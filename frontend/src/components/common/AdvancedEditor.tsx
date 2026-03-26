'use client';

import React, { forwardRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from 'react-hot-toast';
import { imageService } from '@/services/imageService';

// Định nghĩa kiểu
export type EditorMode = 'full' | 'compact' | 'simple';

export interface AdvancedEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  mode?: EditorMode;
  minHeight?: string;
  className?: string;
  readOnly?: boolean;
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
  onMentionSelect?: (userId: string, username: string) => void;
}

// Nhập động RichTextEditor để tránh lỗi SSR
const RichTextEditor = dynamic(() => import('./RichTextEditor'), {
  ssr: false,
  loading: () => (
    <div className="h-64 flex items-center justify-center bg-gray-50 rounded-md">
      <Spinner />
    </div>
  ),
});

// Wrapper component cho RichTextEditor
export const AdvancedEditor = forwardRef<any, AdvancedEditorProps>(({
  value = '',
  onChange,
  placeholder = 'Viết nội dung của bạn...',
  mode = 'full',
  minHeight = mode === 'full' ? '300px' : '150px',
  className = '',
  readOnly = false,
  projectMembers = [],
  onMentionSelect
}, ref) => {
  // Chuẩn bị mode cho RichTextEditor
  // RichTextEditor chỉ chấp nhận 'full' hoặc 'compact'
  const editorMode = mode === 'simple' ? 'compact' : mode;

  return (
    <RichTextEditor
      ref={ref}
      value={value}
      onChange={onChange || (() => {})}
      placeholder={placeholder}
      mode={editorMode}
      minHeight={minHeight}
      className={className}
      readOnly={readOnly}
      projectMembers={projectMembers}
      onMentionSelect={onMentionSelect}
    />
  );
});

AdvancedEditor.displayName = 'AdvancedEditor';

export default AdvancedEditor; 