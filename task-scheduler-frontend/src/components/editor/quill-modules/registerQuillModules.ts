/**
 * Module để đăng ký các modules Quill một cách tự động
 * Gọi hàm registerQuillModules() trong useEffect để đăng ký tất cả các modules cần thiết
 */

// Đảm bảo các imports chỉ được sử dụng ở phía client
let Quill: any;

// Đảm bảo các imports chỉ xảy ra ở phía client
if (typeof window !== 'undefined') {
  try {
    Quill = require('quill');
  } catch (error) {
    console.error('Lỗi khi import Quill:', error);
  }
}

interface QuillInstance {
  theme: {
    modules: {
      [key: string]: any;
    };
  };
  root: HTMLElement;
  getModule: (name: string) => any;
  getSelection: (focus?: boolean) => any;
  insertEmbed: (index: number, type: string, value: any) => void;
  formatLine: (index: number, length: number, format: string, value: any, source?: string) => void;
  formatText: (index: number, length: number, format: string, value: any, source?: string) => void;
  clipboard: {
    dangerouslyPasteHTML: (index: number, html: string, source?: string) => void;
  };
  setSelection: (index: number, length: number, source?: string) => void;
}

interface QuillToolbar {
  quill: QuillInstance;
}

// Biến để theo dõi xem modules đã được đăng ký chưa
let modulesRegistered = false;

// Quill Table Module - Cải tiến với giao diện hiện đại và xử lý hoàn chỉnh
class QuillTableModule {
  quill: QuillInstance;
  options: any;
  contextMenu: HTMLDivElement | null = null;

  constructor(quill: any, options: any) {
    this.quill = quill;
    this.options = options || {};
    
    // Khởi tạo context menu
    this.initContextMenu();
    
    // Đăng ký các xử lý cho table
    this.registerTableHandlers();
  }

  initContextMenu() {
    if (typeof document === 'undefined') return;
    
    // Tạo context menu element
    this.contextMenu = document.createElement('div');
    this.contextMenu.className = 'quill-table-context-menu';
    this.contextMenu.style.display = 'none';
    document.body.appendChild(this.contextMenu);
    
    // Đóng context menu khi click ngoài
    document.addEventListener('click', (e: MouseEvent) => {
      if (this.contextMenu && this.contextMenu.style.display === 'block') {
        if (!this.contextMenu.contains(e.target as Node)) {
          this.contextMenu.style.display = 'none';
        }
      }
    });
  }

  registerTableHandlers() {
    if (typeof document === 'undefined') return;
    
    // Right click trên table
    this.quill.root.addEventListener('contextmenu', (e: MouseEvent) => {
      const tableCell = this.findTableCell(e.target as HTMLElement);
      if (tableCell && this.contextMenu) {
        e.preventDefault();
        
        // Vị trí context menu
        this.contextMenu.style.left = `${e.pageX}px`;
        this.contextMenu.style.top = `${e.pageY}px`;
        
        // Tạo menu items với icons
        this.contextMenu.innerHTML = `
          <div class="quill-table-context-menu-item" data-action="insert-row-above">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="mr-2">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10h14M5 14h14M5 18h14M5 6h14" />
            </svg>
            Thêm hàng phía trên
          </div>
          <div class="quill-table-context-menu-item" data-action="insert-row-below">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="mr-2">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10h14M5 14h14M5 18h14M5 6h14" />
            </svg>
            Thêm hàng phía dưới
          </div>
          <div class="quill-table-context-menu-item" data-action="insert-column-left">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="mr-2">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5v14M15 5v14M5 9h14M5 15h14" />
            </svg>
            Thêm cột bên trái
          </div>
          <div class="quill-table-context-menu-item" data-action="insert-column-right">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="mr-2">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5v14M15 5v14M5 9h14M5 15h14" />
            </svg>
            Thêm cột bên phải
          </div>
          <div class="quill-table-context-menu-item" data-action="delete-row">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="mr-2">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Xóa hàng
          </div>
          <div class="quill-table-context-menu-item" data-action="delete-column">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="mr-2">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Xóa cột
          </div>
          <div class="quill-table-context-menu-item" data-action="delete-table">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="mr-2">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Xóa bảng
          </div>
        `;
        
        // Hiện context menu
        this.contextMenu.style.display = 'block';
        
        // Đăng ký xự kiện click cho menu items
        const menuItems = this.contextMenu.querySelectorAll('.quill-table-context-menu-item');
        menuItems.forEach(item => {
          item.addEventListener('click', (event) => {
            const action = (event.currentTarget as HTMLElement).getAttribute('data-action');
            this.handleContextMenuAction(action, tableCell);
            this.contextMenu!.style.display = 'none';
          });
        });
      }
    });
  }

  findTableCell(element: HTMLElement): HTMLTableCellElement | null {
    let current: HTMLElement | null = element;
    while (current && current !== this.quill.root) {
      if (current.tagName === 'TD' || current.tagName === 'TH') {
        return current as HTMLTableCellElement;
      }
      current = current.parentElement;
    }
    return null;
  }

  handleContextMenuAction(action: string | null, cell: HTMLTableCellElement) {
    if (!action) return;
    
    const tableRow = cell.parentElement as HTMLTableRowElement;
    const table = tableRow.closest('table') as HTMLTableElement;
    
    if (!table) return;
    
    const rowIndex = tableRow.rowIndex;
    const cellIndex = cell.cellIndex;
    
    switch (action) {
      case 'insert-row-above':
        this.insertRow(table, rowIndex);
        break;
      case 'insert-row-below':
        this.insertRow(table, rowIndex + 1);
        break;
      case 'insert-column-left':
        this.insertColumn(table, cellIndex);
        break;
      case 'insert-column-right':
        this.insertColumn(table, cellIndex + 1);
        break;
      case 'delete-row':
        this.deleteRow(table, rowIndex);
        break;
      case 'delete-column':
        this.deleteColumn(table, cellIndex);
        break;
      case 'delete-table':
        this.deleteTable(table);
        break;
    }
  }

  insertRow(table: HTMLTableElement, rowIndex: number) {
    const newRow = table.insertRow(rowIndex);
    const cellsCount = table.rows[0].cells.length;
    
    for (let i = 0; i < cellsCount; i++) {
      const newCell = newRow.insertCell(i);
      newCell.innerHTML = '<br>';
    }
  }

  insertColumn(table: HTMLTableElement, columnIndex: number) {
    for (let i = 0; i < table.rows.length; i++) {
      const newCell = table.rows[i].insertCell(columnIndex);
      newCell.innerHTML = '<br>';
    }
  }

  deleteRow(table: HTMLTableElement, rowIndex: number) {
    table.deleteRow(rowIndex);
  }

  deleteColumn(table: HTMLTableElement, columnIndex: number) {
    for (let i = 0; i < table.rows.length; i++) {
      table.rows[i].deleteCell(columnIndex);
    }
  }

  deleteTable(table: HTMLTableElement) {
    table.parentElement?.removeChild(table);
  }

  // Thêm bảng vào editor
  insertTable(rows: number = 3, cols: number = 3) {
    const range = this.quill.getSelection(true);
    if (!range) return;
    
    // Chèn một dòng trống trước bảng để tránh vấn đề định dạng
    this.quill.insertText(range.index, '\n', 'user');
    
    // Chèn bảng với định dạng rõ ràng
    const tableIndex = range.index + 1;
    let tableHTML = '<table style="width: 100%; border-collapse: collapse; border: 2px solid #ccc; margin: 10px 0;">';
    tableHTML += '<tbody>';
    
    // Tạo header
    tableHTML += '<tr>';
    for (let j = 0; j < cols; j++) {
      tableHTML += '<th style="border: 2px solid #ccc; background-color: #f3f4f6; padding: 8px; font-weight: bold; text-align: center;">Header ' + (j+1) + '</th>';
    }
    tableHTML += '</tr>';
    
    // Tạo các hàng dữ liệu
    for (let i = 0; i < rows - 1; i++) {
      tableHTML += '<tr>';
      for (let j = 0; j < cols; j++) {
        tableHTML += '<td style="border: 2px solid #ccc; padding: 8px; min-height: 24px;">Cell ' + (i+1) + '-' + (j+1) + '</td>';
      }
      tableHTML += '</tr>';
    }
    
    tableHTML += '</tbody></table>';
    
    // Sử dụng dangerouslyPasteHTML để đảm bảo bảng được chèn đúng cách
    this.quill.clipboard.dangerouslyPasteHTML(tableIndex, tableHTML, 'user');
    
    // Chèn một dòng trống sau bảng
    this.quill.insertText(tableIndex + 1, '\n', 'user');
    
    // Di chuyển con trỏ đến đầu bảng
    this.quill.setSelection(tableIndex, 0, 'silent');
  }

  // Mở dialog để tạo bảng với giao diện hiện đại
  showTableDialog() {
    if (typeof document === 'undefined') return;
    
    // Tạo dialog container
    const dialogContainer = document.createElement('div');
    dialogContainer.className = 'quill-table-dialog';
    
    // Tạo dialog content
    dialogContainer.innerHTML = `
      <div class="quill-table-dialog-content">
        <h3>Chèn bảng</h3>
        <div class="quill-table-dialog-field">
          <label for="table-rows">Số hàng:</label>
          <input type="number" id="table-rows" value="3" min="1" max="20">
        </div>
        <div class="quill-table-dialog-field">
          <label for="table-cols">Số cột:</label>
          <input type="number" id="table-cols" value="3" min="1" max="10">
        </div>
        <div class="quill-table-dialog-buttons">
          <button id="table-cancel" class="quill-table-dialog-button cancel">Hủy</button>
          <button id="table-insert" class="quill-table-dialog-button insert">Chèn bảng</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialogContainer);
    
    // Xử lý các events
    const insertBtn = document.getElementById('table-insert');
    const cancelBtn = document.getElementById('table-cancel');
    const rowsInput = document.getElementById('table-rows') as HTMLInputElement;
    const colsInput = document.getElementById('table-cols') as HTMLInputElement;
    
    if (insertBtn && cancelBtn && rowsInput && colsInput) {
      // Focus vào input đầu tiên
      rowsInput.focus();
      
      // Xử lý click nút chèn bảng
      insertBtn.addEventListener('click', () => {
        const rows = parseInt(rowsInput.value, 10) || 3;
        const cols = parseInt(colsInput.value, 10) || 3;
        this.insertTable(rows, cols);
        document.body.removeChild(dialogContainer);
      });
      
      // Xử lý click nút hủy
      cancelBtn.addEventListener('click', () => {
        document.body.removeChild(dialogContainer);
      });
      
      // Xử lý phím tắt
      dialogContainer.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          insertBtn.click();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelBtn.click();
        }
      });
    }
  }
}

export function registerQuillModules() {
  // Đảm bảo chỉ đăng ký một lần
  if (modulesRegistered) {
    console.log('✅ Các module Quill đã được đăng ký trước đó');
    return;
  }

  if (typeof window === 'undefined' || !window.Quill) {
    console.log('❌ Quill chưa được khởi tạo trong window');
    return;
  }

  try {
    // Import các module ở phía client
    const BlotFormatter = require('quill-blot-formatter').default;
    // Tạm thời loại bỏ ImageResize để khắc phục lỗi
    // const ImageResize = require('quill-image-resize-module-react').default;
    const MagicUrl = require('quill-magic-url').default;

    // Đăng ký các module một cách rõ ràng
    if (BlotFormatter) {
      window.Quill.register({
        'modules/blotFormatter': BlotFormatter
      });
      console.log('✅ Đã đăng ký thành công module BlotFormatter');
    }

    // Tạm thời loại bỏ ImageResize để khắc phục lỗi
    // if (ImageResize) {
    //   window.Quill.register({
    //     'modules/imageResize': ImageResize
    //   });
    //   console.log('✅ Đã đăng ký thành công module ImageResize');
    // }

    if (MagicUrl) {
      window.Quill.register({
        'modules/magicUrl': MagicUrl
      });
      console.log('✅ Đã đăng ký thành công module MagicUrl');
    }

    // Đăng ký module table
    window.Quill.register('modules/table', QuillTableModule);
    console.log('✅ Đã đăng ký thành công module Table');

    // Đánh dấu là đã đăng ký
    modulesRegistered = true;
    console.log('✅ Tất cả các module Quill đã được đăng ký thành công');
  } catch (error) {
    console.error('❌ Lỗi khi đăng ký các module Quill:', error);
  }
}

/**
 * Tạo cấu hình Quill modules chuẩn với tùy chọn
 */
export function createQuillModulesConfig() {
  // Nếu chưa đăng ký, thử đăng ký các module
  if (!modulesRegistered && typeof window !== 'undefined' && window.Quill) {
    registerQuillModules();
  }

  // Đăng ký icon cho table button
  if (typeof window !== 'undefined' && window.Quill) {
    const icons = window.Quill.import('ui/icons');
    icons['table'] = `
      <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="3" y1="9" x2="21" y2="9"></line>
        <line x1="3" y1="15" x2="21" y2="15"></line>
        <line x1="9" y1="3" x2="9" y2="21"></line>
        <line x1="15" y1="3" x2="15" y2="21"></line>
      </svg>
    `;
  }

  return {
    toolbar: {
      container: [
        [{ 'font': [] }],
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'script': 'super' }, { 'script': 'sub' }],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
        [{ 'direction': 'rtl' }, { 'align': [] }],
        ['link', 'image', 'table'],
        ['blockquote', 'code-block'],
        ['clean']
      ],
      handlers: {
        image: function(this: QuillToolbar) {
          if (typeof window === 'undefined') return;
          
          try {
            const input = document.createElement('input');
            input.setAttribute('type', 'file');
            input.setAttribute('accept', 'image/*');
            input.click();
            
            input.onchange = async () => {
              const file = input.files?.[0];
              if (file) {
                try {
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    const range = this.quill.getSelection(true);
                    this.quill.insertEmbed(range.index, 'image', e.target?.result);
                  };
                  reader.readAsDataURL(file);
                } catch (error) {
                  console.error('Lỗi khi tải lên ảnh:', error);
                }
              }
            };
          } catch (error) {
            console.error('Lỗi khi xử lý upload ảnh:', error);
          }
        },
        table: function(this: QuillToolbar) {
          if (typeof window === 'undefined') return;
          
          try {
            // Lấy module table từ quill
            const tableModule = this.quill.getModule('table');
            if (tableModule) {
              tableModule.showTableDialog();
            } else {
              console.error('Module table không tồn tại');
              alert('Module table không được đăng ký. Vui lòng tải lại trang.');
            }
          } catch (error) {
            console.error('Lỗi khi xử lý insert table:', error);
          }
        }
      }
    },
    table: true,
    blotFormatter: {},
    // Tạm thời loại bỏ ImageResize để khắc phục lỗi
    // imageResize: {
    //   modules: ['Resize', 'DisplaySize']
    // },
    magicUrl: true,
    clipboard: {
      matchVisual: false
    },
    history: {
      delay: 1000,
      maxStack: 500,
      userOnly: true
    }
  };
}

/**
 * Tạo cấu hình Quill modules đơn giản hơn cho comment
 */
export function createSimpleQuillModulesConfig() {
  return {
    toolbar: {
      container: [
        ['bold', 'italic', 'underline'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        [{ 'color': [] }, { 'background': [] }],
        ['link', 'table'],
        ['clean']
      ],
      handlers: {
        table: function(this: QuillToolbar) {
          if (typeof window === 'undefined') return;
          
          try {
            // Lấy module table từ quill
            const tableModule = this.quill.getModule('table');
            if (tableModule) {
              tableModule.showTableDialog();
            } else {
              console.error('Module table không tồn tại');
              alert('Module table không được đăng ký. Vui lòng tải lại trang.');
            }
          } catch (error) {
            console.error('Lỗi khi xử lý insert table:', error);
          }
        }
      }
    },
    table: true,
    clipboard: {
      matchVisual: false
    },
    history: {
      delay: 1000,
      maxStack: 500,
      userOnly: true
    }
  };
} 