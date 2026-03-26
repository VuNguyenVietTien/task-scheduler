'use client';

import React, { useEffect, useRef, useState } from 'react';
import styles from './RichTextEditor.module.css';
import { TableHandler } from './TableHandler';
import { ImageHandler } from './ImageHandler';
import { editorSetup } from './editorSetup';

interface RichTextEditorProps {
  initialValue?: string;
  onChange?: (content: string) => void;
  className?: string;
  readOnly?: boolean;
  placeholder?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  initialValue = '',
  onChange,
  className = '',
  readOnly = false,
  placeholder = 'Bắt đầu nhập văn bản...'
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const tableDialogRef = useRef<HTMLDivElement>(null);
  const tableMenuRef = useRef<HTMLDivElement>(null);
  const imageMenuRef = useRef<HTMLDivElement>(null);
  const imageUploadRef = useRef<HTMLInputElement>(null);
  
  // References for table dialog inputs
  const tableRowsRef = useRef<HTMLInputElement>(null);
  const tableColsRef = useRef<HTMLInputElement>(null);
  const headerRowRef = useRef<HTMLInputElement>(null);
  const headerColumnRef = useRef<HTMLInputElement>(null);
  
  // State for handlers
  const [tableHandler, setTableHandler] = useState<TableHandler | null>(null);
  const [imageHandler, setImageHandler] = useState<ImageHandler | null>(null);
  
  // State for tracking content changes
  const [content, setContent] = useState<string>(initialValue);

  // Đường dẫn đến Font Awesome
  const fontAwesomeCss = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';

  // Thêm Font Awesome nếu cần
  useEffect(() => {
    // Kiểm tra xem Font Awesome đã được thêm vào chưa
    const fontAwesomeLink = document.querySelector(`link[href="${fontAwesomeCss}"]`);
    if (!fontAwesomeLink) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = fontAwesomeCss;
      document.head.appendChild(link);
    }
  }, []);
  
  // Initialize editor on mount
  useEffect(() => {
    if (!editorRef.current) return;
    
    // Set initial content
    if (initialValue) {
      editorRef.current.innerHTML = initialValue;
    } else {
      editorRef.current.innerHTML = `<p>${placeholder}</p>`;
    }
    
    // Make editor editable unless readOnly
    editorRef.current.contentEditable = readOnly ? 'false' : 'true';
    
    // Set up the editor with all event handlers
    const cleanup = editorSetup({
      editor: editorRef.current,
      tableDialog: tableDialogRef.current,
      tableMenu: tableMenuRef.current,
      imageMenu: imageMenuRef.current,
      imageUpload: imageUploadRef.current,
      tableRows: tableRowsRef.current,
      tableCols: tableColsRef.current,
      headerRow: headerRowRef.current,
      headerColumn: headerColumnRef.current,
      onContentChange: (newContent) => {
        setContent(newContent);
        if (onChange) {
          onChange(newContent);
        }
      },
      setTableHandler,
      setImageHandler
    });
    
    return cleanup;
  }, [initialValue, onChange, placeholder, readOnly]);
  
  // Button handlers for text formatting
  const handleBold = () => document.execCommand('bold');
  const handleItalic = () => document.execCommand('italic');
  const handleUnderline = () => document.execCommand('underline');
  
  // Button handlers for alignment
  const handleAlignLeft = () => {
    if (imageHandler?.currentImage) {
      imageHandler.alignImage(imageHandler.currentImage, 'left');
    } else {
      document.execCommand('justifyLeft');
    }
  };
  
  const handleAlignCenter = () => {
    if (imageHandler?.currentImage) {
      imageHandler.alignImage(imageHandler.currentImage, 'center');
    } else {
      document.execCommand('justifyCenter');
    }
  };
  
  const handleAlignRight = () => {
    if (imageHandler?.currentImage) {
      imageHandler.alignImage(imageHandler.currentImage, 'right');
    } else {
      document.execCommand('justifyRight');
    }
  };
  
  const handleAlignJustify = () => document.execCommand('justifyFull');
  
  // Button handlers for table and image
  const handleInsertTable = (e: React.MouseEvent) => {
    e.preventDefault();
    if (tableDialogRef.current) {
      tableDialogRef.current.style.display = 'flex';
    }
  };
  
  const handleInsertImage = () => {
    if (imageUploadRef.current) {
      imageUploadRef.current.click();
    }
  };
  
  const handleInsertTableConfirm = () => {
    if (!tableRowsRef.current || !tableColsRef.current || !headerRowRef.current || !headerColumnRef.current || !tableHandler) return;
    
    const rows = parseInt(tableRowsRef.current.value);
    const cols = parseInt(tableColsRef.current.value);
    const hasHeaderRow = headerRowRef.current.checked;
    const hasHeaderColumn = headerColumnRef.current.checked;
    
    if (rows && cols) {
      if (tableDialogRef.current) {
        tableDialogRef.current.style.display = 'none';
      }
      
      setTimeout(() => {
        if (tableHandler) {
          tableHandler.insertTable(rows, cols, hasHeaderRow, hasHeaderColumn);
        }
      }, 100);
    }
  };
  
  const handleInsertTableCancel = () => {
    if (tableDialogRef.current) {
      tableDialogRef.current.style.display = 'none';
    }
  };
  
  return (
    <div className={`rich-text-editor-container ${className}`}>
      {!readOnly && (
        <div className={styles.toolbar}>
          <div className={styles.toolbarGroup}>
            <button id="bold-btn" title="Đậm" onClick={handleBold}>
              <i className="fas fa-bold"></i>
            </button>
            <button id="italic-btn" title="Nghiêng" onClick={handleItalic}>
              <i className="fas fa-italic"></i>
            </button>
            <button id="underline-btn" title="Gạch chân" onClick={handleUnderline}>
              <i className="fas fa-underline"></i>
            </button>
          </div>
          <div className={styles.toolbarGroup}>
            <button id="align-left-btn" title="Căn trái" onClick={handleAlignLeft}>
              <i className="fas fa-align-left"></i>
            </button>
            <button id="align-center-btn" title="Căn giữa" onClick={handleAlignCenter}>
              <i className="fas fa-align-center"></i>
            </button>
            <button id="align-right-btn" title="Căn phải" onClick={handleAlignRight}>
              <i className="fas fa-align-right"></i>
            </button>
            <button id="align-justify-btn" title="Căn đều" onClick={handleAlignJustify}>
              <i className="fas fa-align-justify"></i>
            </button>
          </div>
          <div className={styles.toolbarGroup}>
            <button id="insert-table-btn" title="Chèn bảng" onClick={handleInsertTable}>
              <i className="fas fa-table"></i>
            </button>
            <button id="insert-image-btn" title="Chèn hình ảnh" onClick={handleInsertImage}>
              <i className="fas fa-image"></i>
            </button>
          </div>
        </div>
      )}

      <div 
        ref={editorRef} 
        className={styles.editor} 
        id="editor"
      />

      {/* Table Dialog */}
      <div id="table-dialog" ref={tableDialogRef} className={styles.dialog}>
        <div className={styles.dialogContent}>
          <h3>Chèn bảng</h3>
          <div className={styles.formGroup}>
            <label htmlFor="table-rows">Số hàng:</label>
            <input type="number" id="table-rows" ref={tableRowsRef} min="1" max="20" defaultValue="3" />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="table-cols">Số cột:</label>
            <input type="number" id="table-cols" ref={tableColsRef} min="1" max="10" defaultValue="3" />
          </div>
          <div className={styles.formGroup}>
            <label>Kiểu bảng:</label>
            <div className={styles.checkboxGroup}>
              <input type="checkbox" id="header-row" ref={headerRowRef} defaultChecked />
              <label htmlFor="header-row">Hàng tiêu đề</label>
            </div>
            <div className={styles.checkboxGroup}>
              <input type="checkbox" id="header-column" ref={headerColumnRef} />
              <label htmlFor="header-column">Cột tiêu đề</label>
            </div>
          </div>
          <div className={styles.dialogButtons}>
            <button id="insert-table-cancel" onClick={handleInsertTableCancel} className={styles.cancelBtn}>Hủy</button>
            <button id="insert-table-confirm" onClick={handleInsertTableConfirm} className={styles.confirmBtn}>Chèn</button>
          </div>
        </div>
      </div>

      {/* Context Menus */}
      <div id="table-menu" ref={tableMenuRef} className={styles.contextMenu}></div>
      <div id="image-menu" ref={imageMenuRef} className={styles.contextMenu}></div>
      
      {/* Hidden Image Upload Input */}
      <input 
        type="file" 
        id="image-upload" 
        ref={imageUploadRef} 
        accept="image/*" 
        style={{ display: 'none' }} 
        title="Tải lên hình ảnh"
        aria-label="Tải lên hình ảnh"
      />

      {/* Thêm CSS toàn cầu cho table cần thiết để resize và hiển thị menu button */}
      <style jsx global>{`
        .table-container {
          position: relative;
          margin: 1rem 0;
        }
        
        .table-menu-btn {
          position: absolute;
          top: -25px;
          right: 0;
          background-color: #f8f9fa;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          width: 25px;
          height: 25px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 5;
        }
        
        .table-menu-btn:hover {
          background-color: #edf2f7;
        }
        
        .table-switch-mode-btn {
          position: absolute;
          top: -25px;
          right: 30px;
          background-color: #f8f9fa;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          padding: 0 8px;
          height: 25px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          cursor: pointer;
          z-index: 5;
        }
        
        .table-switch-mode-btn:hover {
          background-color: #edf2f7;
        }
        
        .col-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          width: 4px;
          height: 100%;
          background-color: transparent;
          cursor: col-resize;
          z-index: 2;
        }
        
        .col-resize-handle:hover,
        .col-resize-handle.active {
          background-color: #4299e1;
        }
        
        .table-column-resizer {
          position: absolute;
          width: 2px;
          background-color: #4299e1;
          z-index: 1000;
          display: none;
        }
        
        .selected-cell {
          background-color: rgba(66, 153, 225, 0.2) !important;
        }
        
        table.resizing-column {
          cursor: col-resize;
        }
        
        table.focused {
          outline: 2px solid #4299e1;
        }
        
        table.merge-mode td,
        table.merge-mode th {
          cursor: pointer;
        }
        
        table.edit-mode td,
        table.edit-mode th {
          cursor: text;
        }
        
        .edit-mode-indicator::before {
          content: "✏️";
        }
        
        .merge-mode-indicator::before {
          content: "🔗";
        }
        
        /* Image styles */
        .resizable-image {
          position: relative;
          display: inline-block;
          margin: 5px;
        }
        
        .resizable-image img {
          max-width: 100%;
          display: block;
        }
        
        .resize-handle {
          position: absolute;
          width: 10px;
          height: 10px;
          background-color: #4299e1;
          border: 1px solid white;
          border-radius: 50%;
          z-index: 10;
        }
        
        .resize-handle-nw {
          top: -5px;
          left: -5px;
          cursor: nw-resize;
        }
        
        .resize-handle-ne {
          top: -5px;
          right: -5px;
          cursor: ne-resize;
        }
        
        .resize-handle-sw {
          bottom: -5px;
          left: -5px;
          cursor: sw-resize;
        }
        
        .resize-handle-se {
          bottom: -5px;
          right: -5px;
          cursor: se-resize;
        }
        
        .resizable-image.selected-image {
          outline: 2px solid #4299e1;
        }
        
        .resizable-image.align-left {
          float: left;
          margin-right: 15px;
        }
        
        .resizable-image.align-right {
          float: right;
          margin-left: 15px;
        }
        
        .resizable-image.align-center {
          margin-left: auto;
          margin-right: auto;
          display: block;
        }
        
        .image-menu-button-container {
          position: fixed;
          top: 0;
          left: 0;
          z-index: 1000;
          pointer-events: none;
        }
        
        .image-menu-button-group {
          display: flex;
          background-color: white;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
          pointer-events: auto;
        }
        
        .image-menu-button {
          padding: 5px 10px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          color: #4a5568;
        }
        
        .image-menu-button:hover {
          background-color: #f7fafc;
        }
        
        .image-menu-button.active {
          background-color: #ebf8ff;
          color: #3182ce;
        }
        
        .table-menu-button-container,
        .table-control-container {
          position: fixed;
          top: 0;
          left: 0;
          z-index: 999;
          pointer-events: none;
        }
        
        .table-control-container {
          display: flex;
          pointer-events: auto;
        }
      `}</style>
    </div>
  );
};

export default RichTextEditor;
