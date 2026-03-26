import { TableHandler } from './TableHandler';
import { ImageHandler } from './ImageHandler';

interface EditorSetupOptions {
  editor: HTMLDivElement;
  tableDialog: HTMLDivElement | null;
  tableMenu: HTMLDivElement | null;
  imageMenu: HTMLDivElement | null;
  imageUpload: HTMLInputElement | null;
  tableRows: HTMLInputElement | null;
  tableCols: HTMLInputElement | null;
  headerRow: HTMLInputElement | null;
  headerColumn: HTMLInputElement | null;
  onContentChange: (content: string) => void;
  setTableHandler: (handler: TableHandler) => void;
  setImageHandler: (handler: ImageHandler) => void;
}

export const editorSetup = (options: EditorSetupOptions): (() => void) => {
  const {
    editor,
    tableDialog,
    tableMenu,
    imageMenu,
    imageUpload,
    tableRows,
    tableCols,
    headerRow,
    headerColumn,
    onContentChange,
    setTableHandler,
    setImageHandler
  } = options;

  // Khởi tạo handler cho table và image
  const tableHandler = new TableHandler(editor);
  const imageHandler = new ImageHandler(editor);

  // Đưa handlers vào state để React component có thể sử dụng
  setTableHandler(tableHandler);
  setImageHandler(imageHandler);

  // Lưu trữ vị trí của cursor
  let savedRange: Range | null = null;
  let lastFocusTime = 0;

  // Hàm lưu vị trí cursor hiện tại
  const saveCurrentCursorPosition = (): void => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        savedRange = range.cloneRange(); // Tạo bản sao để đảm bảo không bị thay đổi
        lastFocusTime = Date.now();
      }
    }
  };

  // Hàm khôi phục vị trí cursor đã lưu
  const restoreCursorPosition = (): void => {
    if (savedRange) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedRange);
        editor.focus();
      }
    }
  };

  // Execute document commands
  const execCommand = (command: string, value: string | null = null): void => {
    // Khôi phục vị trí trước khi thực hiện lệnh
    restoreCursorPosition();
    document.execCommand(command, false, value || undefined);
    editor.focus();
  };

  // Theo dõi thay đổi nội dung để gọi callback
  const handleContentChange = (): void => {
    if (onContentChange) {
      onContentChange(editor.innerHTML);
    }
  };

  // Lưu vị trí cursor khi focus vào editor
  editor.addEventListener('mouseup', saveCurrentCursorPosition);
  editor.addEventListener('keyup', saveCurrentCursorPosition);
  
  // Bắt sự kiện thay đổi nội dung
  editor.addEventListener('input', handleContentChange);
  
  // Lưu vị trí cursor khi có thay đổi selection trong editor
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && editor.contains(selection.anchorNode)) {
      savedRange = selection.getRangeAt(0).cloneRange();
      lastFocusTime = Date.now();
    }
  });

  // Table dialog confirm
  const handleInsertTableConfirm = () => {
    if (!tableRows || !tableCols || !headerRow || !headerColumn) return;
    
    const rows = parseInt(tableRows.value);
    const cols = parseInt(tableCols.value);
    const hasHeaderRow = headerRow.checked;
    const hasHeaderColumn = headerColumn.checked;
    
    if (rows && cols && tableDialog) {
      // Đóng dialog
      tableDialog.style.display = 'none';
      
      // Đảm bảo kết quả sẽ được insert vào vị trí cursor đã lưu
      setTimeout(() => {
        // Khôi phục range đã lưu trước khi chèn bảng
        if (savedRange) {
          try {
            const selection = window.getSelection();
            if (selection) {
              selection.removeAllRanges();
              selection.addRange(savedRange);
              editor.focus();
            }
          } catch (e) {
            console.error("Lỗi khi khôi phục vị trí cursor:", e);
          }
        } else {
          editor.focus(); // Focus vào editor để đảm bảo bảng được chèn
        }
        
        // Chèn bảng vào editor tại vị trí cursor
        tableHandler.insertTable(rows, cols, hasHeaderRow, hasHeaderColumn);
      }, 100);
    }
  };

  // Hide context menus when clicking elsewhere
  const handleDocumentClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    
    if (tableMenu && !tableMenu.contains(target) && target.className !== 'table-menu-btn') {
      tableMenu.style.display = 'none';
    }
    
    if (imageMenu && 
        !imageMenu.contains(target) && 
        !target.closest('.resizable-image') && 
        !target.closest('.image-menu-button-group')) {
      
      imageMenu.style.display = 'none';
      
      // Bỏ chọn tất cả hình ảnh và ẩn các menu button
      document.querySelectorAll('.selected-image').forEach(container => {
        container.classList.remove('selected-image');
        if (imageHandler && typeof imageHandler.updateMenuButtonVisibility === 'function') {
          imageHandler.updateMenuButtonVisibility(container as HTMLElement, false);
        }
      });
      
      // Reset currentImage
      if (imageHandler) {
        imageHandler.currentImage = null;
      }
    }
    
    if (!target.closest('table')) {
      document.querySelectorAll('table.focused').forEach(table => {
        table.classList.remove('focused');
      });
    }
  };

  // Prevent context menu on right-click
  editor.addEventListener('contextmenu', (e: Event) => {
    e.preventDefault();
  });

  // Add event listeners
  document.addEventListener('click', handleDocumentClick);

  // Handle image upload
  if (imageUpload) {
    imageUpload.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        const file = target.files[0];
        const reader = new FileReader();
        
        reader.onload = (event) => {
          if (event.target && event.target.result) {
            imageHandler.insertImage(event.target.result as string);
          }
        };
        
        reader.readAsDataURL(file);
      }
    });
  }

  // Cleanup function to remove event listeners when component unmounts
  return () => {
    editor.removeEventListener('mouseup', saveCurrentCursorPosition);
    editor.removeEventListener('keyup', saveCurrentCursorPosition);
    editor.removeEventListener('input', handleContentChange);
    editor.removeEventListener('contextmenu', (e: Event) => e.preventDefault());
    document.removeEventListener('click', handleDocumentClick);
    document.removeEventListener('selectionchange', () => {});
  };
};
