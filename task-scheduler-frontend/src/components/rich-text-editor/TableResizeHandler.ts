/**
 * TableResizeHandler - Xử lý chức năng resize cột trong bảng
 */
export class TableResizeHandler {
    editor: HTMLElement;
    currentTable: HTMLTableElement | null;
    currentResizer: HTMLElement | null;
    startX: number;
    startWidth: number;
    initialWidths: number[];
    resizing: boolean;

    constructor(editor: HTMLElement) {
        this.editor = editor;
        this.currentTable = null;
        this.currentResizer = null;
        this.startX = 0;
        this.startWidth = 0;
        this.initialWidths = [];
        this.resizing = false;

        // Khởi tạo event listeners
        this.initEvents();
    }

    initEvents() {
        // Theo dõi các bảng mới được thêm vào editor
        this.observeTablesInEditor();

        // Thêm event listeners cho mouse move và mouse up khi resize
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }

    observeTablesInEditor() {
        // Sử dụng MutationObserver để phát hiện khi table được thêm vào editor
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeName === 'TABLE' || (node.nodeType === Node.ELEMENT_NODE && (node as Element).querySelector('table'))) {
                            const tables = node.nodeName === 'TABLE' ? [node] : (node as Element).querySelectorAll('table');
                            tables.forEach(table => this.setupColumnResizers(table as HTMLTableElement));
                        }
                    });
                }
            });
        });
        
        observer.observe(this.editor, { childList: true, subtree: true });

        // Khởi tạo cho các table đã có sẵn
        this.editor.querySelectorAll('table').forEach(table => {
            this.setupColumnResizers(table);
        });
    }

    setupColumnResizers(table: HTMLTableElement) {
        // Xóa tất cả resize handles cũ nếu có
        const container = table.closest('.table-container');
        if (!container) return;
        
        const oldResizers = container.querySelectorAll('.col-resize-handle');
        oldResizers.forEach(resizer => resizer.remove());
        
        // Tìm số lượng cột trong bảng
        const firstRow = table.rows[0];
        if (!firstRow) return;
        
        const cells = firstRow.cells;
        const totalColumns = cells.length;
        
        // Thêm resizer cho mỗi cột (trừ cột cuối)
        for (let i = 0; i < totalColumns - 1; i++) {
            const cell = cells[i];
            const cellRect = cell.getBoundingClientRect();
            
            // Tạo resizer
            const resizer = document.createElement('div');
            resizer.className = 'col-resize-handle';
            resizer.dataset.column = i.toString();
            
            // Vị trí của resizer
            resizer.style.right = '-2px';
            resizer.style.top = '0';
            resizer.style.height = `${table.offsetHeight}px`;
            
            // Thêm sự kiện mousedown cho resizer
            resizer.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                this.startResize(table, resizer, i);
            });
            
            // Thêm resizer vào cell
            cell.style.position = 'relative';
            cell.appendChild(resizer);
        }
    }

    startResize(table: HTMLTableElement, resizer: HTMLElement, columnIndex: number) {
        // Lưu thông tin resize hiện tại
        this.currentTable = table;
        this.currentResizer = resizer;
        this.resizing = true;
        
        // Lấy vị trí chuột và độ rộng ban đầu của cột
        const cellToResize = table.rows[0].cells[columnIndex];
        this.startX = window.event ? (window.event as MouseEvent).clientX : 0;
        this.startWidth = cellToResize.offsetWidth;
        
        // Lưu độ rộng ban đầu của tất cả các cột
        this.initialWidths = [];
        Array.from(table.rows[0].cells).forEach(cell => {
            this.initialWidths.push(cell.offsetWidth);
        });
        
        // Thêm class active để hiển thị resizer rõ ràng khi đang resize
        resizer.classList.add('active');
        
        // Thêm class resizing cho table
        table.classList.add('resizing');
        
        // Ngăn user chọn text trong khi resize
        document.body.style.userSelect = 'none';
    }

    handleMouseMove(e: MouseEvent) {
        if (!this.resizing || !this.currentTable || !this.currentResizer) return;
        
        // Tính toán độ thay đổi
        const columnIndex = parseInt(this.currentResizer.dataset.column || '0');
        const dx = e.clientX - this.startX;
        
        // Tính toán độ rộng mới (không cho phép nhỏ hơn minWidth)
        const minWidth = 30; // Độ rộng tối thiểu của cột
        const newWidth = Math.max(this.startWidth + dx, minWidth);
        
        // Cập nhật độ rộng của cột
        const rows = this.currentTable.rows;
        for (let i = 0; i < rows.length; i++) {
            if (columnIndex < rows[i].cells.length) {
                const cell = rows[i].cells[columnIndex];
                cell.style.width = `${newWidth}px`;
            }
        }
        
        // Cập nhật lại độ rộng handle để phù hợp với chiều cao mới của bảng
        this.currentResizer.style.height = `${this.currentTable.offsetHeight}px`;
    }

    handleMouseUp() {
        if (!this.resizing) return;
        
        this.resizing = false;
        
        if (this.currentResizer) {
            this.currentResizer.classList.remove('active');
        }
        
        if (this.currentTable) {
            this.currentTable.classList.remove('resizing');
            
            // Cập nhật lại tất cả resizers
            this.setupColumnResizers(this.currentTable);
            
            // Kích hoạt sự kiện table-resize-complete
            const event = new CustomEvent('table-resize-complete', {
                detail: {
                    table: this.currentTable
                }
            });
            document.dispatchEvent(event);
        }
        
        // Xóa các tham chiếu
        this.currentTable = null;
        this.currentResizer = null;
        this.initialWidths = [];
        
        // Cho phép user chọn text lại
        document.body.style.userSelect = '';
    }

    updateResizers() {
        if (!this.currentTable) return;
        
        // Cập nhật lại tất cả resizers
        this.setupColumnResizers(this.currentTable);
    }
}
