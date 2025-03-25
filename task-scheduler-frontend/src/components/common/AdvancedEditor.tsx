'use client';

import React, { forwardRef } from 'react';
import dynamic from 'next/dynamic';
import { Spinner } from '@/components/ui/Spinner';

// Định nghĩa kiểu
export type EditorMode = 'full' | 'compact';

export interface AdvancedEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  mode?: EditorMode;
  minHeight?: string;
  className?: string;
  readOnly?: boolean;
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
  readOnly = false
}, ref) => {
  return (
    <RichTextEditor
      ref={ref}
      value={value}
      onChange={onChange || (() => {})}
      placeholder={placeholder}
      mode={mode}
      minHeight={minHeight}
      className={className}
      readOnly={readOnly}
    />
  );
});

AdvancedEditor.displayName = 'AdvancedEditor';

export default AdvancedEditor; 