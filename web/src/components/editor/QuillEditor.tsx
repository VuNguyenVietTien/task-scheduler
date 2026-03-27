'use client';

import React, { useEffect, forwardRef, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Spinner } from '@/components/ui/Spinner';
import { registerQuillModules } from './quill-modules/registerQuillModules';

// Biến toàn cục để đảm bảo chỉ khởi tạo Quill một lần
let isQuillInitialized = false;

// Dynamic import cho ReactQuill với ForwardRef để tránh warning
const ReactQuillWithForwardRef = dynamic(
  async () => {
    // Đăng ký các modules Quill ở phía client sau khi import thành công
    if (typeof window !== 'undefined' && !isQuillInitialized) {
      try {
        // Đảm bảo Quill được import và đăng ký các module
        const Quill = require('quill');
        if (!window.Quill) {
          window.Quill = Quill;
        }
        
        // Ghi đè phương thức theo dõi DOM thay vì sử dụng DOMNodeInserted đã bị loại bỏ
        if (window.Quill && window.Quill.prototype) {
          const originalScroll = window.Quill.import('blots/scroll');
          if (originalScroll) {
            // Ghi đè phương thức observe để sử dụng MutationObserver thay vì DOMNodeInserted
            const originalInit = originalScroll.prototype.initialize;
            originalScroll.prototype.initialize = function() {
              const result = originalInit.call(this);
              this.domNode.addEventListener = function(eventName: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
                if (eventName === 'DOMNodeInserted') {
                  // Bỏ qua các sự kiện đã không còn được hỗ trợ
                  return;
                }
                return EventTarget.prototype.addEventListener.call(this, eventName, listener, options);
              };
              return result;
            };
            window.Quill.register('blots/scroll', originalScroll, true);
          }
        }
        
        registerQuillModules();
        isQuillInitialized = true;
      } catch (error) {
        console.error('Lỗi khi khởi tạo Quill:', error);
      }
    }
    
    const { default: RQ } = await import('react-quill');
    
    // Sử dụng forwardRef đúng cách - quan trọng phải đặt tên hiển thị
    const ReactQuillWrapper = forwardRef((props: any, ref: any) => <RQ ref={ref} {...props} />);
    ReactQuillWrapper.displayName = 'ReactQuillWithRef';
    return ReactQuillWrapper;
  },
  { 
    ssr: false,
    loading: () => <div className="h-[200px] bg-gray-100 rounded-md flex items-center justify-center"><Spinner size="lg" /></div>
  }
);

// Quản lý việc import stylesheet cho ReactQuill
const QuillStylesheet = () => {
  useEffect(() => {
    // Đảm bảo stylesheet chỉ được import ở phía client
    try {
      // @ts-ignore
      import('react-quill/dist/quill.snow.css');
    } catch (error) {
      console.error('Không thể tải stylesheet của Quill:', error);
    }
  }, []);
  
  return null;
};

interface QuillEditorProps {
  value: string;
  onChange: (content: string) => void;
  modules?: any;
  className?: string;
  placeholder?: string;
  readOnly?: boolean;
  theme?: string;
  preserveWhitespace?: boolean;
}

// Sử dụng React.memo để chỉ render lại khi props thay đổi
const QuillEditor = React.memo(forwardRef<any, QuillEditorProps>(({
  value,
  onChange,
  modules,
  className = 'h-[200px]',
  placeholder = 'Viết nội dung...',
  readOnly = false,
  theme = 'snow',
  preserveWhitespace = true
}, ref) => {
  // Tham chiếu đến component ReactQuill
  const quillRef = useRef<any>(null);
  
  // State để theo dõi việc khởi tạo
  const [isInitialized, setIsInitialized] = useState(false);
  
  // State để theo dõi giá trị của editor - giúp ngăn chặn lỗi delta
  const [editorValue, setEditorValue] = useState(value || '');
  
  // State để theo dõi xem editor đã được focus hay chưa
  const [isFocused, setIsFocused] = useState(false);
  
  // Biến để theo dõi vị trí cursor hiện tại
  const cursorPositionRef = useRef<any>(null);
  
  // Flag để theo dõi nếu đang trong quá trình cập nhật giá trị nội bộ
  const isInternalUpdate = useRef(false);
  
  // Biến để theo dõi xem editor đã được mount hoàn toàn chưa
  const isMounted = useRef(false);

  // Hàm kiểm tra giá trị value
  const isValidValue = (val: any): boolean => {
    return val !== undefined && val !== null;
  };
  
  // Hàm xử lý sự kiện focus
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);
  
  // Hàm xử lý sự kiện blur
  const handleBlur = useCallback(() => {
    // Lưu vị trí cursor hiện tại trước khi blur
    if (quillRef.current?.editor) {
      cursorPositionRef.current = quillRef.current.editor.getSelection();
    }
    setIsFocused(false);
  }, []);
  
  // Khôi phục vị trí cursor
  const restoreCursor = useCallback(() => {
    if (!quillRef.current?.editor || !cursorPositionRef.current) return;
    
    try {
      quillRef.current.editor.focus();
      quillRef.current.editor.setSelection(
        cursorPositionRef.current.index, 
        cursorPositionRef.current.length || 0
      );
    } catch (error) {
      console.error('Lỗi khi khôi phục cursor:', error);
    }
  }, []);

  // Xử lý thay đổi nội dung editor - tối ưu với useCallback
  const handleChange = useCallback((content: string) => {
    // Nếu đang cập nhật nội bộ hoặc chưa mount hoàn toàn, bỏ qua
    if (isInternalUpdate.current || !isMounted.current) return;
    
    // Đảm bảo content hợp lệ
    const safeContent = isValidValue(content) ? content : '';
    
    // Lưu vị trí cursor hiện tại
    if (quillRef.current?.editor) {
      cursorPositionRef.current = quillRef.current.editor.getSelection();
    }
    
    // Tránh cập nhật khi giá trị không thay đổi để ngăn re-render không cần thiết
    if (safeContent === editorValue) return;
    
    // Đánh dấu đang cập nhật nội bộ để tránh vòng lặp vô hạn
    isInternalUpdate.current = true;
    
    // Cập nhật giá trị nội bộ
    setEditorValue(safeContent);
    
    // Gọi hàm onChange từ props
    if (onChange) {
      onChange(safeContent);
    }
    
    // Đánh dấu đã hoàn thành cập nhật nội bộ
    setTimeout(() => {
      isInternalUpdate.current = false;
      if (isFocused) {
        restoreCursor();
      }
    }, 0);
  }, [onChange, editorValue, isFocused, restoreCursor]);
  
  // Disable auto-focus effect khi sử dụng comment form
  const shouldFocus = !className.includes('h-[150px]');
  
  // Cập nhật editorValue khi prop value thay đổi từ bên ngoài
  useEffect(() => {
    // Chỉ chạy sau khi component đã mount hoàn toàn
    if (!isMounted.current) return;
    
    // Nếu đang cập nhật nội bộ, bỏ qua
    if (isInternalUpdate.current) return;
    
    // Đảm bảo value hợp lệ và khác với giá trị hiện tại
    const safeValue = isValidValue(value) ? value : '';
    if (safeValue !== editorValue) {
      // Đánh dấu đang cập nhật nội bộ
      isInternalUpdate.current = true;
      
      // Lưu vị trí cursor hiện tại
      if (quillRef.current?.editor) {
        cursorPositionRef.current = quillRef.current.editor.getSelection();
      }
      
      // Cập nhật giá trị
      setEditorValue(safeValue);
      
      // Đánh dấu hoàn thành cập nhật và khôi phục cursor
      setTimeout(() => {
        isInternalUpdate.current = false;
        if (isFocused) {
          restoreCursor();
        }
      }, 0);
    }
  }, [value, editorValue, isFocused, restoreCursor]);
  
  // Đảm bảo tất cả mọi thứ đã được khởi tạo đầy đủ trước khi xử lý cập nhật
  useEffect(() => {
    // Đánh dấu component đã mount hoàn toàn
    isMounted.current = true;
    
    // Gán giá trị ban đầu an toàn
    if (!isInternalUpdate.current) {
      const safeValue = isValidValue(value) ? value : '';
      if (safeValue !== editorValue) {
        setEditorValue(safeValue);
      }
    }
    
    return () => {
      // Đánh dấu component unmount
      isMounted.current = false;
    };
  }, [value, editorValue]);
  
  // Đảm bảo cursor được giữ khi di chuyển
  useEffect(() => {
    // Tạo một hàm đồng bộ cursor khi mouseup
    const syncCursorOnMouseUp = () => {
      if (quillRef.current?.editor && isFocused) {
        cursorPositionRef.current = quillRef.current.editor.getSelection();
      }
    };
    
    // Đăng ký sự kiện mouseup
    document.addEventListener('mouseup', syncCursorOnMouseUp);
    
    return () => {
      document.removeEventListener('mouseup', syncCursorOnMouseUp);
    };
  }, [isFocused]);
  
  // Kết hợp ref từ forwardRef và ref nội bộ
  const handleRefAssignment = useCallback((el: any) => {
    if (!el) return;
    
    quillRef.current = el;
    
    // Chuyển tiếp tham chiếu nếu được cung cấp
    if (typeof ref === 'function') {
      ref(el);
    } else if (ref) {
      (ref as React.MutableRefObject<any>).current = el;
    }
    
    // Nếu editor đã được khởi tạo
    if (el && el.editor) {
      setIsInitialized(true);
      
      // Focus vào editor nếu cần
      if (shouldFocus && !isFocused) {
        setTimeout(() => {
          try {
            el.editor.focus();
            
            // Di chuyển con trỏ đến cuối
            const length = el.editor.getLength();
            if (length) {
              el.editor.setSelection(length, 0);
            }
            
            // Đánh dấu là đã focus
            setIsFocused(true);
          } catch (error) {
            console.error('Lỗi khi focus editor:', error);
          }
        }, 50);
      }
    }
  }, [ref, shouldFocus, isFocused]);
  
  return (
    <div className={`quill-editor-wrapper ${preserveWhitespace ? 'preserve-whitespace' : ''}`}>
      <style jsx global>{`
        .quill-editor-wrapper.preserve-whitespace .ql-editor {
          white-space: pre-wrap;
        }
        .quill-editor-wrapper .ql-editor {
          min-height: 150px;
          font-size: 1rem;
          line-height: 1.5;
          cursor: text !important;
        }
        .quill-editor-wrapper .ql-toolbar {
          border-top-left-radius: 0.375rem;
          border-top-right-radius: 0.375rem;
          background-color: #f9fafb;
          border: 1px solid #e5e7eb;
          padding: 8px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 4px;
        }
        .quill-editor-wrapper .ql-toolbar .ql-formats {
          display: inline-flex;
          align-items: center;
          margin-right: 8px;
          border-right: 1px solid #e5e7eb;
          padding-right: 8px;
        }
        .quill-editor-wrapper .ql-toolbar .ql-formats:last-child {
          border-right: none;
        }
        .quill-editor-wrapper .ql-container {
          border-bottom-left-radius: 0.375rem;
          border-bottom-right-radius: 0.375rem;
          border: 1px solid #e5e7eb;
          border-top: none;
          font-family: inherit;
          font-size: 1rem;
        }
        .quill-editor-wrapper .ql-editor blockquote {
          border-left: 4px solid #ccc;
          margin-bottom: 5px;
          margin-top: 5px;
          padding-left: 16px;
        }
        .quill-editor-wrapper .ql-editor pre {
          background-color: #23241f;
          color: #f8f8f2;
          overflow: visible;
          white-space: pre-wrap;
          margin-bottom: 5px;
          margin-top: 5px;
          padding: 5px 10px;
          border-radius: 3px;
        }
        .quill-editor-wrapper .ql-snow .ql-picker.ql-font {
          width: 120px;
        }
        .quill-editor-wrapper .ql-snow .ql-picker {
          color: #374151;
          font-size: 1rem;
        }
        .quill-editor-wrapper .ql-snow .ql-stroke {
          stroke: #374151;
          stroke-width: 1.5;
        }
        .quill-editor-wrapper .ql-snow .ql-fill {
          fill: #374151;
        }
        .quill-editor-wrapper .ql-toolbar button {
          padding: 6px;
          margin: 3px;
          height: 36px;
          width: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s ease;
        }
        .quill-editor-wrapper .ql-toolbar button svg {
          width: 20px;
          height: 20px;
          display: block;
          margin: auto;
        }
        .quill-editor-wrapper .ql-toolbar button:hover {
          background-color: #e5e7eb;
        }
        .quill-editor-wrapper .ql-toolbar button.ql-active {
          background-color: #dbeafe;
          color: #2563eb;
        }
        .quill-editor-wrapper .ql-toolbar button.ql-active .ql-stroke {
          stroke: #2563eb;
        }
        .quill-editor-wrapper .ql-toolbar button.ql-active .ql-fill {
          fill: #2563eb;
        }
        .quill-editor-wrapper .ql-snow .ql-tooltip {
          background-color: #fff;
          border: 1px solid #e5e7eb;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
          padding: 8px 12px;
          border-radius: 6px;
        }
        .quill-editor-wrapper .ql-snow .ql-tooltip input[type=text] {
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          padding: 4px 8px;
          margin-right: 8px;
          font-size: 14px;
        }
        .quill-editor-wrapper .ql-snow .ql-tooltip a.ql-action,
        .quill-editor-wrapper .ql-snow .ql-tooltip a.ql-remove {
          background-color: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          padding: 4px 8px;
          margin-right: 8px;
          color: #374151;
          text-decoration: none;
          font-size: 14px;
        }
        .quill-editor-wrapper .ql-snow .ql-tooltip a.ql-action:hover,
        .quill-editor-wrapper .ql-snow .ql-tooltip a.ql-remove:hover {
          background-color: #e5e7eb;
        }
        /* Tùy chỉnh cho bảng */
        .quill-editor-wrapper .ql-editor table {
          border-collapse: collapse !important;
          width: 100% !important;
          margin: 1rem 0 !important;
          border: 2px solid #d1d5db !important;
          table-layout: fixed !important;
        }
        .quill-editor-wrapper .ql-editor table td,
        .quill-editor-wrapper .ql-editor table th {
          border: 2px solid #d1d5db !important;
          padding: 8px !important;
          min-width: 60px !important;
          height: 24px !important;
          word-break: break-word !important;
        }
        .quill-editor-wrapper .ql-editor table th {
          background-color: #f3f4f6 !important;
          font-weight: bold !important;
          text-align: left !important;
        }
        /* Làm rõ nút table */
        .quill-editor-wrapper .ql-toolbar button.ql-table {
          background-color: #f3f4f6;
          border: 1px solid #d1d5db;
          color: #374151;
        }
        .quill-editor-wrapper .ql-toolbar button.ql-table:hover {
          background-color: #e5e7eb;
        }
        .quill-editor-wrapper .ql-toolbar button.ql-table.ql-active {
          background-color: #dbeafe;
          color: #2563eb;
        }
        /* Table context menu */
        .quill-table-context-menu {
          position: absolute;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 9999;
          padding: 8px 0;
          min-width: 180px;
        }
        .quill-table-context-menu-item {
          padding: 8px 16px;
          cursor: pointer;
          font-size: 14px;
          color: #374151;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
        }
        .quill-table-context-menu-item:hover {
          background-color: #f3f4f6;
          color: #2563eb;
        }
        /* Dialog styles */
        .quill-table-dialog {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .quill-table-dialog-content {
          background: white;
          padding: 24px;
          border-radius: 8px;
          width: 350px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .quill-table-dialog h3 {
          margin-top: 0;
          margin-bottom: 16px;
          font-size: 18px;
          color: #1f2937;
        }
        .quill-table-dialog-field {
          margin-bottom: 16px;
        }
        .quill-table-dialog label {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
          color: #4b5563;
        }
        .quill-table-dialog input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
        }
        .quill-table-dialog-buttons {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
        }
        .quill-table-dialog-button {
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .quill-table-dialog-button.cancel {
          background: white;
          border: 1px solid #d1d5db;
          color: #4b5563;
        }
        .quill-table-dialog-button.insert {
          background: #2563eb;
          border: none;
          color: white;
        }
        .quill-table-dialog-button.cancel:hover {
          background: #f3f4f6;
        }
        .quill-table-dialog-button.insert:hover {
          background: #1d4ed8;
        }
        /* Cải thiện giao diện khi hiển thị trên mobile */
        @media (max-width: 640px) {
          .quill-editor-wrapper .ql-toolbar {
            padding: 4px;
            flex-wrap: wrap;
            justify-content: center;
          }
          .quill-editor-wrapper .ql-toolbar .ql-formats {
            margin-right: 4px;
            padding-right: 4px;
          }
          .quill-editor-wrapper .ql-toolbar button {
            padding: 4px;
            margin: 2px;
            height: 32px;
            width: 32px;
          }
        }
      `}</style>
      <QuillStylesheet />
      <ReactQuillWithForwardRef
        ref={handleRefAssignment}
        value={editorValue}
        onChange={handleChange}
        modules={modules}
        className={className}
        placeholder={placeholder}
        readOnly={readOnly}
        theme={theme}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    </div>
  );
}));

QuillEditor.displayName = 'QuillEditor';

export default QuillEditor; 