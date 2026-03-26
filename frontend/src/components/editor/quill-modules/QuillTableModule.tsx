import { MutableRefObject, useCallback } from 'react';

/**
 * Interface cho các tùy chọn của QuillTableModule
 */
export interface QuillTableOptions {
  // Tùy chọn khi khởi tạo module
  minRows?: number;
  maxRows?: number;
  minCols?: number;
  maxCols?: number;
  tableClassName?: string;
  cellClassName?: string;
  tableBorderColor?: string;
  tableBorderWidth?: number;
  tableCellPadding?: number;
  enablePicker?: boolean;
  enableResize?: boolean;
  enableContextMenu?: boolean;
  enableDrag?: boolean;
  enableDelete?: boolean;
}

/**
 * Module quản lý tất cả chức năng liên quan đến table trong Quill
 */
export class QuillTableModule {
  private quillRef: MutableRefObject<any>;
  private options: QuillTableOptions;
  private pickerUI: HTMLElement | null = null;
  private resizeHandlers: Map<HTMLElement, () => void> = new Map();
  private dragHandlers: Map<HTMLElement, () => void> = new Map();
  private contextMenus: Map<HTMLElement, HTMLElement> = new Map();

  constructor(quillRef: MutableRefObject<any>, options: QuillTableOptions = {}) {
    this.quillRef = quillRef;
    this.options = {
      minRows: 1,
      maxRows: 20,
      minCols: 1,
      maxCols: 20,
      tableClassName: 'quill-better-table',
      cellClassName: 'quill-better-table-cell',
      tableBorderColor: '#ccc',
      tableBorderWidth: 1,
      tableCellPadding: 5,
      enablePicker: true,
      enableResize: true,
      enableContextMenu: true,
      enableDrag: true,
      enableDelete: true,
      ...options,
    };
  }

  /**
   * Khởi tạo module
   */
  public initialize(): void {
    // Phải đảm bảo chạy phía client
    if (typeof window === 'undefined') return;
    
    this.setupTableInsertHandler();
  }

  /**
   * Thiết lập handler để thêm table
   */
  private setupTableInsertHandler(): void {
    // Nhận tham chiếu đến Quill
    const quillEditor = this.quillRef.current?.getEditor();
    if (!quillEditor) return;

    // Tìm toolbar button table và gán handler
    setTimeout(() => {
      const tableButton = document.querySelector('.ql-table');
      if (tableButton) {
        tableButton.addEventListener('click', (e: Event) => this.handleTableButtonClick(e as MouseEvent));
      }
    }, 100);
  }

  /**
   * Handler khi click vào nút table trong toolbar
   */
  private handleTableButtonClick(e: MouseEvent): void {
    e.preventDefault();
    
    const quillEditor = this.quillRef.current?.getEditor();
    if (!quillEditor) return;
    
    // Hiển thị UI cho phép chọn số hàng, số cột
    this.showTablePickerUI();
  }

  /**
   * Hiển thị giao diện chọn số hàng, số cột
   */
  private showTablePickerUI(): void {
    // Tạo popup chọn số hàng, số cột
    const tableUI = document.createElement('div');
    tableUI.className = 'table-picker-ui';
    tableUI.style.position = 'absolute';
    tableUI.style.backgroundColor = 'white';
    tableUI.style.borderRadius = '5px';
    tableUI.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
    tableUI.style.zIndex = '1000';
    tableUI.style.padding = '10px';
    
    // Thêm tiêu đề
    const title = document.createElement('div');
    title.textContent = 'Chèn bảng';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '10px';
    tableUI.appendChild(title);
    
    // Input cho số hàng
    const rowsLabel = document.createElement('label');
    rowsLabel.innerHTML = 'Số hàng: ';
    tableUI.appendChild(rowsLabel);
    
    const rowsInput = document.createElement('input');
    rowsInput.type = 'number';
    rowsInput.min = String(this.options.minRows || 1);
    rowsInput.max = String(this.options.maxRows || 10);
    rowsInput.value = '3';
    rowsInput.style.width = '50px';
    rowsInput.style.marginRight = '10px';
    tableUI.appendChild(rowsInput);
    
    // Input cho số cột
    const colsLabel = document.createElement('label');
    colsLabel.innerHTML = 'Số cột: ';
    tableUI.appendChild(colsLabel);
    
    const colsInput = document.createElement('input');
    colsInput.type = 'number';
    colsInput.min = String(this.options.minCols || 1);
    colsInput.max = String(this.options.maxCols || 10);
    colsInput.value = '3';
    colsInput.style.width = '50px';
    tableUI.appendChild(colsInput);
    
    // Thêm nút Insert
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.marginTop = '10px';
    
    const insertButton = document.createElement('button');
    insertButton.textContent = 'Chèn bảng';
    insertButton.style.backgroundColor = '#3b82f6';
    insertButton.style.color = 'white';
    insertButton.style.border = 'none';
    insertButton.style.borderRadius = '4px';
    insertButton.style.padding = '5px 10px';
    insertButton.style.cursor = 'pointer';
    insertButton.onclick = () => this.insertTable(
      parseInt(rowsInput.value, 10) || 3,
      parseInt(colsInput.value, 10) || 3
    );
    
    // Thêm nút Hủy
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Hủy';
    cancelButton.style.backgroundColor = '#e5e7eb';
    cancelButton.style.color = '#374151';
    cancelButton.style.border = 'none';
    cancelButton.style.borderRadius = '4px';
    cancelButton.style.padding = '5px 10px';
    cancelButton.style.marginRight = '5px';
    cancelButton.style.cursor = 'pointer';
    cancelButton.onclick = () => {
      document.body.removeChild(tableUI);
      this.pickerUI = null;
    };
    
    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(insertButton);
    tableUI.appendChild(buttonContainer);
    
    // Định vị popup gần toolbar
    const toolbar = document.querySelector('.ql-toolbar');
    if (toolbar) {
      const toolbarRect = toolbar.getBoundingClientRect();
      tableUI.style.top = `${toolbarRect.bottom + window.scrollY + 10}px`;
      tableUI.style.left = `${toolbarRect.left + window.scrollX}px`;
    }
    
    document.body.appendChild(tableUI);
    this.pickerUI = tableUI;
  }

  /**
   * Thêm bảng vào editor
   */
  public insertTable(rows: number, cols: number): void {
    const quillEditor = this.quillRef.current?.getEditor();
    if (!quillEditor) return;
    
    // Đảm bảo đóng UI chọn bảng nếu đang mở
    if (this.pickerUI) {
      document.body.removeChild(this.pickerUI);
      this.pickerUI = null;
    }
    
    // Sử dụng better-table module nếu có
    const betterTableModule = quillEditor.getModule('better-table');
    if (betterTableModule) {
      // Sử dụng better-table để thêm bảng
      betterTableModule.insertTable(rows, cols);
      
      // Thêm các tính năng mở rộng cho bảng
      this.enhanceTable();
    } else {
      // Fallback: tạo HTML table nếu không có better-table
      const range = quillEditor.getSelection(true);
      
      let tableHTML = '<table class="quill-table">';
      
      // Tạo hàng và cột
      for (let r = 0; r < rows; r++) {
        tableHTML += '<tr>';
        for (let c = 0; c < cols; c++) {
          tableHTML += '<td><p><br></p></td>';
        }
        tableHTML += '</tr>';
      }
      
      tableHTML += '</table>';
      
      // Chèn HTML vào editor
      quillEditor.clipboard.dangerouslyPasteHTML(range.index, tableHTML);
      
      // Đặt vị trí con trỏ vào ô đầu tiên
      quillEditor.setSelection(range.index + 1, 0);
      
      // Thêm các tính năng mở rộng cho bảng
      this.enhanceTable();
    }
  }

  /**
   * Thêm các tính năng nâng cao cho bảng mới chèn vào
   */
  private enhanceTable(): void {
    setTimeout(() => {
      // Tìm các bảng mới được thêm vào
      const tables = document.querySelectorAll('.ql-table, .quill-table, .quill-better-table');
      
      tables.forEach(table => {
        // Chỉ xử lý các bảng chưa được tăng cường
        if (!table.querySelector('.table-control-buttons')) {
          this.addTableControls(table as HTMLElement);
          
          // Thêm tính năng resize cho các ô
          if (this.options.enableResize) {
            this.addTableResizeHandlers(table as HTMLElement);
          }
          
          // Thêm menu context
          if (this.options.enableContextMenu) {
            this.addTableContextMenu(table as HTMLElement);
          }
        }
      });
    }, 100);
  }

  /**
   * Thêm các nút điều khiển cho bảng (drag, delete)
   */
  private addTableControls(table: HTMLElement): void {
    // Tạo container cho các nút điều khiển
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'table-control-buttons';
    controlsContainer.style.position = 'absolute';
    controlsContainer.style.top = '2px';
    controlsContainer.style.left = '2px';
    controlsContainer.style.display = 'flex';
    controlsContainer.style.background = 'white';
    controlsContainer.style.borderRadius = '3px';
    controlsContainer.style.boxShadow = '0 1px 2px rgba(0,0,0,0.2)';
    controlsContainer.style.zIndex = '100';
    controlsContainer.style.opacity = '0';
    controlsContainer.style.transition = 'opacity 0.2s';
    controlsContainer.style.pointerEvents = 'none'; // Bắt đầu với việc không bắt sự kiện chuột
    
    // Thêm sự kiện hover để hiển thị nút điều khiển
    table.addEventListener('mouseenter', () => {
      controlsContainer.style.opacity = '1';
      controlsContainer.style.pointerEvents = 'auto';
    });
    
    table.addEventListener('mouseleave', () => {
      // Chỉ ẩn nếu không đang kéo bảng
      if (!table.classList.contains('dragging')) {
        controlsContainer.style.opacity = '0';
        controlsContainer.style.pointerEvents = 'none';
      }
    });
    
    // Button kéo thả
    if (this.options.enableDrag) {
      const dragButton = document.createElement('button');
      dragButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 5H6V7H8V5Z" fill="currentColor" />
        <path d="M18 5H16V7H18V5Z" fill="currentColor" />
        <path d="M8 9H6V11H8V9Z" fill="currentColor" />
        <path d="M18 9H16V11H18V9Z" fill="currentColor" />
        <path d="M8 13H6V15H8V13Z" fill="currentColor" />
        <path d="M18 13H16V15H18V13Z" fill="currentColor" />
        <path d="M8 17H6V19H8V17Z" fill="currentColor" />
        <path d="M18 17H16V19H18V17Z" fill="currentColor" />
      </svg>`;
      dragButton.style.border = 'none';
      dragButton.style.background = 'none';
      dragButton.style.cursor = 'move';
      dragButton.style.padding = '3px';
      dragButton.title = 'Kéo để di chuyển bảng';
      
      controlsContainer.appendChild(dragButton);
      
      // Thêm chức năng kéo thả
      this.makeDraggable(table, dragButton);
    }
    
    // Button xóa bảng
    if (this.options.enableDelete) {
      const deleteButton = document.createElement('button');
      deleteButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/>
      </svg>`;
      deleteButton.style.border = 'none';
      deleteButton.style.background = 'none';
      deleteButton.style.cursor = 'pointer';
      deleteButton.style.padding = '3px';
      deleteButton.style.color = '#f56565';
      deleteButton.title = 'Xóa bảng';
      
      deleteButton.addEventListener('click', () => this.deleteTable(table));
      
      controlsContainer.appendChild(deleteButton);
    }
    
    // Thêm vào bảng
    table.style.position = 'relative';
    table.appendChild(controlsContainer);
  }

  /**
   * Thêm chức năng kéo thả cho bảng
   */
  private makeDraggable(element: HTMLElement, handle: HTMLElement): void {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    const dragMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Thêm class để đánh dấu đang kéo
      element.classList.add('dragging');
      
      // Lấy vị trí chuột khi bắt đầu
      pos3 = e.clientX;
      pos4 = e.clientY;
      
      // Gán các sự kiện
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    };
    
    const elementDrag = (e: MouseEvent) => {
      e.preventDefault();
      
      // Tính toán vị trí mới
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      
      // Cập nhật vị trí của element
      element.style.top = (element.offsetTop - pos2) + "px";
      element.style.left = (element.offsetLeft - pos1) + "px";
    };
    
    const closeDragElement = () => {
      // Xóa class dragging
      element.classList.remove('dragging');
      
      // Hủy đăng ký sự kiện
      document.onmouseup = null;
      document.onmousemove = null;
    };
    
    // Đăng ký sự kiện mousedown cho handle
    handle.onmousedown = dragMouseDown;
    
    // Lưu handler để có thể xóa nếu cần
    this.dragHandlers.set(element, () => {
      handle.onmousedown = null;
    });
  }

  /**
   * Xóa bảng khỏi editor
   */
  private deleteTable(table: HTMLElement): void {
    const quillEditor = this.quillRef.current?.getEditor();
    if (!quillEditor) return;
    
    // Tìm vị trí của bảng trong editor
    const tableNode = table.closest('.quill-better-table, .ql-table, .quill-table');
    if (tableNode) {
      // Xóa bảng khỏi DOM
      const index = quillEditor.getIndex(tableNode);
      
      if (typeof index === 'number' && index >= 0) {
        quillEditor.deleteText(index, 1);
      } else {
        // Fallback nếu không tìm được index
        tableNode.parentNode?.removeChild(tableNode);
      }
    }
  }

  /**
   * Thêm handlers cho phép resize bảng
   */
  private addTableResizeHandlers(table: HTMLElement): void {
    // Thêm CSS cho cell để hiển thị đường resize
    const style = document.createElement('style');
    style.textContent = `
      .quill-table td, .quill-better-table td, .ql-table td {
        position: relative;
      }
      
      .quill-table td:not(:last-child)::after,
      .quill-better-table td:not(:last-child)::after,
      .ql-table td:not(:last-child)::after {
        content: '';
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        width: 5px;
        cursor: col-resize;
        background-color: transparent;
      }
      
      .quill-table tr:not(:last-child) td::before,
      .quill-better-table tr:not(:last-child) td::before,
      .ql-table tr:not(:last-child) td::before {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 5px;
        cursor: row-resize;
        background-color: transparent;
      }
      
      .quill-table td:not(:last-child):hover::after,
      .quill-better-table td:not(:last-child):hover::after,
      .ql-table td:not(:last-child):hover::after {
        background-color: rgba(0, 123, 255, 0.2);
      }
      
      .quill-table tr:not(:last-child) td:hover::before,
      .quill-better-table tr:not(:last-child) td:hover::before,
      .ql-table tr:not(:last-child) td:hover::before {
        background-color: rgba(0, 123, 255, 0.2);
      }
    `;
    document.head.appendChild(style);
    
    // Thêm sự kiện resize cho các cột
    const cells = table.querySelectorAll('td');
    cells.forEach(cell => {
      // Resize theo chiều ngang (column)
      cell.addEventListener('mousedown', (e) => {
        const target = e.target as HTMLElement;
        
        // Kiểm tra nếu click vào vùng resize cột (bên phải của cell)
        if (
          target.tagName.toLowerCase() === 'td' && 
          e.offsetX > target.offsetWidth - 5 &&
          !cell.matches(':last-child')
        ) {
          this.startColumnResize(cell as HTMLElement, e);
        }
        
        // Kiểm tra nếu click vào vùng resize hàng (dưới của cell)
        if (
          target.tagName.toLowerCase() === 'td' && 
          e.offsetY > target.offsetHeight - 5 &&
          !cell.closest('tr')?.matches(':last-child')
        ) {
          this.startRowResize(cell as HTMLElement, e);
        }
      });
    });
  }

  /**
   * Bắt đầu resize cột
   */
  private startColumnResize(cell: HTMLElement, e: MouseEvent): void {
    e.preventDefault();
    
    const initialX = e.clientX;
    const initialWidth = cell.offsetWidth;
    
    // Tạo overlay để capture mouse
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.zIndex = '1000';
    overlay.style.cursor = 'col-resize';
    document.body.appendChild(overlay);
    
    const onMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - initialX;
      const newWidth = Math.max(20, initialWidth + deltaX); // Tối thiểu 20px
      
      cell.style.width = `${newWidth}px`;
    };
    
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.removeChild(overlay);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Bắt đầu resize hàng
   */
  private startRowResize(cell: HTMLElement, e: MouseEvent): void {
    e.preventDefault();
    
    const row = cell.closest('tr') as HTMLElement;
    const initialY = e.clientY;
    const initialHeight = row.offsetHeight;
    
    // Tạo overlay để capture mouse
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.zIndex = '1000';
    overlay.style.cursor = 'row-resize';
    document.body.appendChild(overlay);
    
    const onMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - initialY;
      const newHeight = Math.max(20, initialHeight + deltaY); // Tối thiểu 20px
      
      row.style.height = `${newHeight}px`;
    };
    
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.removeChild(overlay);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Thêm menu context cho các ô trong bảng
   */
  private addTableContextMenu(table: HTMLElement): void {
    const cells = table.querySelectorAll('td');
    
    cells.forEach(cell => {
      cell.addEventListener('click', (e) => {
        // Chỉ xử lý left click
        if (e.button !== 0) return;
        
        // Hiển thị menu context
        this.showTableContextMenu(cell as HTMLElement, e);
      });
    });
  }

  /**
   * Hiển thị menu context cho các thao tác với bảng
   */
  private showTableContextMenu(cell: HTMLElement, e: MouseEvent): void {
    e.stopPropagation(); // Ngăn bubble lên các phần tử khác
    
    // Xóa menu context cũ nếu có
    this.contextMenus.forEach((menu) => {
      menu.parentNode?.removeChild(menu);
    });
    this.contextMenus.clear();
    
    // Tìm table chứa cell
    const parentTable = cell.closest('table') as HTMLElement;
    if (!parentTable) return;
    
    // Tạo menu context mới
    const contextMenu = document.createElement('div');
    contextMenu.className = 'table-context-menu';
    contextMenu.style.position = 'absolute';
    contextMenu.style.zIndex = '1000';
    contextMenu.style.backgroundColor = 'white';
    contextMenu.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
    contextMenu.style.borderRadius = '4px';
    contextMenu.style.padding = '5px 0';
    contextMenu.style.minWidth = '180px';
    
    // Tạo các mục menu
    const createMenuItem = (text: string, onClick: () => void) => {
      const item = document.createElement('div');
      item.className = 'table-context-menu-item';
      item.textContent = text;
      item.style.padding = '8px 12px';
      item.style.cursor = 'pointer';
      item.style.transition = 'background-color 0.2s';
      
      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = '#f0f0f0';
      });
      
      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = 'transparent';
      });
      
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
        // Đóng menu sau khi click
        if (contextMenu.parentNode) {
          contextMenu.parentNode.removeChild(contextMenu);
          this.contextMenus.delete(cell);
        }
      });
      
      return item;
    };
    
    // Thêm các mục menu cho hàng
    const rowGroup = document.createElement('div');
    rowGroup.style.borderBottom = '1px solid #eee';
    rowGroup.style.paddingBottom = '5px';
    rowGroup.style.marginBottom = '5px';
    
    rowGroup.appendChild(createMenuItem('Thêm hàng phía trên', () => this.insertRowAbove(cell)));
    rowGroup.appendChild(createMenuItem('Thêm hàng phía dưới', () => this.insertRowBelow(cell)));
    rowGroup.appendChild(createMenuItem('Xóa hàng', () => this.deleteRow(cell)));
    
    // Thêm các mục menu cho cột
    const colGroup = document.createElement('div');
    colGroup.style.borderBottom = '1px solid #eee';
    colGroup.style.paddingBottom = '5px';
    colGroup.style.marginBottom = '5px';
    
    colGroup.appendChild(createMenuItem('Thêm cột bên trái', () => this.insertColumnLeft(cell)));
    colGroup.appendChild(createMenuItem('Thêm cột bên phải', () => this.insertColumnRight(cell)));
    colGroup.appendChild(createMenuItem('Xóa cột', () => this.deleteColumn(cell)));
    
    // Thêm các mục menu cho bảng
    const tableGroup = document.createElement('div');
    tableGroup.appendChild(createMenuItem('Xóa bảng', () => this.deleteTable(parentTable)));
    
    // Thêm các nhóm vào menu
    contextMenu.appendChild(rowGroup);
    contextMenu.appendChild(colGroup);
    contextMenu.appendChild(tableGroup);
    
    // Định vị menu gần vị trí click
    const rect = cell.getBoundingClientRect();
    contextMenu.style.top = `${rect.bottom + window.scrollY}px`;
    contextMenu.style.left = `${rect.left + window.scrollX}px`;
    
    // Thêm sự kiện click bên ngoài để đóng menu
    const closeOnClickOutside = (e: MouseEvent) => {
      if (!contextMenu.contains(e.target as Node)) {
        document.removeEventListener('click', closeOnClickOutside);
        if (contextMenu.parentNode) {
          contextMenu.parentNode.removeChild(contextMenu);
          this.contextMenus.delete(cell);
        }
      }
    };
    
    // Thêm vào body
    document.body.appendChild(contextMenu);
    this.contextMenus.set(cell, contextMenu);
    
    // Đăng ký sự kiện đóng
    setTimeout(() => {
      document.addEventListener('click', closeOnClickOutside);
    }, 0);
  }

  /**
   * Thêm hàng phía trên
   */
  private insertRowAbove(cell: HTMLElement): void {
    const row = cell.closest('tr');
    const table = cell.closest('table');
    
    if (row && table) {
      const newRow = document.createElement('tr');
      const colCount = (row as HTMLTableRowElement).cells.length;
      
      // Tạo các ô mới
      for (let i = 0; i < colCount; i++) {
        const newCell = document.createElement('td');
        newCell.innerHTML = '<p><br></p>';
        newRow.appendChild(newCell);
      }
      
      // Chèn hàng mới vào trước hàng hiện tại
      row.parentNode?.insertBefore(newRow, row);
      
      // Cập nhật lại các tính năng
      this.enhanceTable();
    }
  }

  /**
   * Thêm hàng phía dưới
   */
  private insertRowBelow(cell: HTMLElement): void {
    const row = cell.closest('tr');
    const table = cell.closest('table');
    
    if (row && table) {
      const newRow = document.createElement('tr');
      const colCount = (row as HTMLTableRowElement).cells.length;
      
      // Tạo các ô mới
      for (let i = 0; i < colCount; i++) {
        const newCell = document.createElement('td');
        newCell.innerHTML = '<p><br></p>';
        newRow.appendChild(newCell);
      }
      
      // Chèn hàng mới vào sau hàng hiện tại
      if (row.nextSibling) {
        row.parentNode?.insertBefore(newRow, row.nextSibling);
      } else {
        row.parentNode?.appendChild(newRow);
      }
      
      // Cập nhật lại các tính năng
      this.enhanceTable();
    }
  }

  /**
   * Xóa hàng
   */
  private deleteRow(cell: HTMLElement): void {
    const row = cell.closest('tr');
    const table = cell.closest('table');
    
    if (row && table) {
      // Kiểm tra nếu đây là hàng cuối cùng thì xóa cả bảng
      if (table.querySelectorAll('tr').length <= 1) {
        this.deleteTable(table as HTMLElement);
        return;
      }
      
      // Xóa hàng
      row.parentNode?.removeChild(row);
    }
  }

  /**
   * Thêm cột bên trái
   */
  private insertColumnLeft(cell: HTMLElement): void {
    const table = cell.closest('table');
    
    if (table) {
      const rows = table.querySelectorAll('tr');
      const cellIndex = this.getCellIndex(cell);
      
      // Thêm ô mới vào mỗi hàng
      rows.forEach(row => {
        const newCell = document.createElement('td');
        newCell.innerHTML = '<p><br></p>';
        
        // Chèn ô mới vào trước ô hiện tại
        const targetCell = row.cells[cellIndex];
        if (targetCell) {
          row.insertBefore(newCell, targetCell);
        } else {
          row.appendChild(newCell);
        }
      });
      
      // Cập nhật lại các tính năng
      this.enhanceTable();
    }
  }

  /**
   * Thêm cột bên phải
   */
  private insertColumnRight(cell: HTMLElement): void {
    const table = cell.closest('table');
    
    if (table) {
      const rows = table.querySelectorAll('tr');
      const cellIndex = this.getCellIndex(cell);
      
      // Thêm ô mới vào mỗi hàng
      rows.forEach(row => {
        const newCell = document.createElement('td');
        newCell.innerHTML = '<p><br></p>';
        
        // Chèn ô mới vào sau ô hiện tại
        const targetCell = row.cells[cellIndex];
        if (targetCell && targetCell.nextSibling) {
          row.insertBefore(newCell, targetCell.nextSibling);
        } else {
          row.appendChild(newCell);
        }
      });
      
      // Cập nhật lại các tính năng
      this.enhanceTable();
    }
  }

  /**
   * Xóa cột
   */
  private deleteColumn(cell: HTMLElement): void {
    const table = cell.closest('table');
    
    if (table) {
      const rows = table.querySelectorAll('tr');
      const cellIndex = this.getCellIndex(cell);
      
      // Kiểm tra nếu đây là cột cuối cùng thì xóa cả bảng
      if (rows[0]?.cells.length <= 1) {
        this.deleteTable(table as HTMLElement);
        return;
      }
      
      // Xóa ô ở mỗi hàng
      rows.forEach(row => {
        if (row.cells[cellIndex]) {
          row.removeChild(row.cells[cellIndex]);
        }
      });
    }
  }

  /**
   * Lấy vị trí của ô trong hàng
   */
  private getCellIndex(cell: HTMLElement): number {
    const row = cell.closest('tr');
    if (!row) return -1;
    
    const cells = Array.from(row.cells);
    return cells.indexOf(cell as HTMLTableCellElement);
  }

  /**
   * Dọn dẹp - gỡ bỏ các sự kiện và tham chiếu
   */
  public destroy(): void {
    // Đóng UI picker nếu đang mở
    if (this.pickerUI && this.pickerUI.parentNode) {
      this.pickerUI.parentNode.removeChild(this.pickerUI);
      this.pickerUI = null;
    }
    
    // Gỡ bỏ các event handlers
    this.resizeHandlers.forEach((handler) => {
      handler();
    });
    this.resizeHandlers.clear();
    
    this.dragHandlers.forEach((handler) => {
      handler();
    });
    this.dragHandlers.clear();
    
    // Đóng tất cả context menu
    this.contextMenus.forEach((menu) => {
      if (menu.parentNode) {
        menu.parentNode.removeChild(menu);
      }
    });
    this.contextMenus.clear();
  }
}

/**
 * Hook để sử dụng QuillTableModule trong React
 */
export function useQuillTable(
  quillRef: MutableRefObject<any>,
  options: QuillTableOptions = {}
) {
  const {
    enableResize = true,
    enableContextMenu = true,
    enableDrag = true,
    enableDelete = true,
  } = options;
  
  /**
   * Khởi tạo module table
   */
  const initialize = useCallback(async () => {
    try {
      // Đảm bảo quill đã được khởi tạo
      const quill = quillRef.current;
      if (!quill || !quill.getEditor) return;
      
      const editor = quill.getEditor();
      if (!editor) return;

      // Tạo các tùy chọn cho module table
      const betterTableOptions = {
        operationMenu: {
          items: {
            insertColumnRight: {
              text: 'Thêm cột phải',
            },
            insertColumnLeft: {
              text: 'Thêm cột trái',
            },
            insertRowUp: {
              text: 'Thêm hàng trên',
            },
            insertRowDown: {
              text: 'Thêm hàng dưới',
            },
            ...(enableDelete && {
              deleteColumn: {
                text: 'Xóa cột',
              },
              deleteRow: {
                text: 'Xóa hàng',
              },
              deleteTable: {
                text: 'Xóa bảng',
              },
            }),
          },
        },
        // Tăng cường độ ổn định
        menuKey: {
          operationMenu: {
            key: 'Better-Table-operationMenu',
          },
          headerDropdown: {
            key: 'Better-Table-headerDropdown',
          },
          cellDropdown: {
            key: 'Better-Table-cellDropdown',
          },
        },
        // Ẩn các menu không cần thiết
        backgroundColors: {
          colors: ['white'],
          palette: [/* Không hiển thị palette */],
        },
        cellColors: {
          colors: ['transparent'],
          palette: [/* Không hiển thị palette */],
        },
        toolbarAfterMoreText: 'Thêm tùy chọn',
        tableToolbarOptions: ['background', 'border'],
        useTableToolbar: true,
        draggable: !!enableDrag,
        resizable: !!enableResize,
      };

      // Khởi tạo module better-table bằng cách sử dụng try-catch
      try {
        // Thử sử dụng module đã đăng ký
        const tableModule = editor.getModule('better-table');
        if (tableModule) {
          console.log('Đã tìm thấy module better-table');
          return;
        }
      } catch (e) {
        console.log('Không tìm thấy module better-table, đang thử thêm module');
      }

      // Nếu module chưa được khởi tạo, thử thêm module
      try {
        editor.options.modules['better-table'] = betterTableOptions;
        editor.theme.addModule('better-table');
        console.log('Đã thêm module better-table');
      } catch (error) {
        console.error('Lỗi khi thêm module better-table:', error);
      }
    } catch (error) {
      console.error('Lỗi khi khởi tạo module table:', error);
    }
  }, [quillRef, enableResize, enableContextMenu, enableDrag, enableDelete]);

  /**
   * Phương pháp dự phòng để chèn bảng khi module better-table không hoạt động
   */
  const insertTableHTML = (quill: any, rows: number, cols: number) => {
    try {
      if (!quill) return;
      
      // Tạo HTML cho bảng có biên
      let tableHTML = `<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">`;
      
      // Tạo hàng đầu tiên (header)
      tableHTML += '<thead><tr>';
      for (let j = 0; j < cols; j++) {
        tableHTML += `<th style="border: 1px solid #ccc; padding: 8px; min-width: 60px; background-color: #f5f5f5; font-weight: bold; text-align: center;">Cột ${j+1}</th>`;
      }
      tableHTML += '</tr></thead>';
      
      // Tạo các hàng dữ liệu
      tableHTML += '<tbody>';
      for (let i = 0; i < rows-1; i++) { // -1 vì đã có header
        tableHTML += '<tr>';
        for (let j = 0; j < cols; j++) {
          tableHTML += `<td style="border: 1px solid #ccc; padding: 8px; min-width: 60px; height: 24px;">`;
          // Thêm một không gian trống để đảm bảo cell có nội dung
          tableHTML += '&nbsp;';
          tableHTML += '</td>';
        }
        tableHTML += '</tr>';
      }
      tableHTML += '</tbody>';
      
      tableHTML += '</table><p><br></p>';
      
      // Chèn bảng vào vị trí hiện tại
      const range = quill.getSelection();
      if (range) {
        quill.clipboard.dangerouslyPasteHTML(range.index, tableHTML);
      } else {
        quill.clipboard.dangerouslyPasteHTML(quill.getLength(), tableHTML);
      }
      
      console.log('Đã sử dụng phương pháp fallback để chèn bảng HTML');
    } catch (error) {
      console.error('Lỗi khi sử dụng phương pháp dự phòng để chèn bảng:', error);
    }
  };

  /**
   * Hàm thêm bảng vào Quill
   * @param rows Số hàng
   * @param cols Số cột
   */
  const insertTable = useCallback((rows: number, cols: number) => {
    if (!quillRef.current || !quillRef.current.getEditor) return;
    
    const quill = quillRef.current.getEditor();
    if (!quill) return;
    
    try {
      // Sử dụng phương pháp fallback an toàn hơn
      insertTableHTML(quill, rows, cols);
    } catch (error) {
      console.error('Lỗi khi thêm bảng:', error);
      
      // Sử dụng phương pháp dự phòng khi không thể sử dụng module
      if (quillRef.current && quillRef.current.getEditor) {
        const quill = quillRef.current.getEditor();
        insertTableHTML(quill, rows, cols);
      }
    }
  }, [quillRef]);

  /**
   * Hủy module table
   */
  const destroy = useCallback(() => {
    // Dọn dẹp module nếu cần
  }, []);

  return { insertTable, initialize, destroy };
} 