/**
 * TableResizeHandler - Xử lý chức năng resize column trong bảng
 * 
 * @version 1.0
 * @author Rich Text Editor
 * 
 * CHỨC NĂNG ĐÃ HOÀN THIỆN - KHÔNG SỬA ĐỔI SAU NÀY
 * Xử lý việc resize cột trong bảng, đảm bảo chỉ cột được chọn thay đổi kích thước
 * và các cột khác giữ nguyên kích thước ban đầu.
 */

class TableResizeHandler {
    constructor(editor) {
        this.editor = editor;
        this.resizingColumn = false;
        this.startX = 0;
        this.targetCell = null;
        this.targetColumnIndex = null;
        this.targetTable = null;
        this.columnWidths = null;
        
        // Tạo visual resizer element
        this.tableResizer = document.createElement('div');
        this.tableResizer.className = 'table-column-resizer';
        document.body.appendChild(this.tableResizer);
        
        // Khởi tạo event listeners
        this.initEvents();
    }
    
    /**
     * Khởi tạo event listeners toàn cục
     */
    initEvents() {
        // Theo dõi sự kiện chuột toàn cục cho resize
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }
    
    /**
     * Thiết lập khởi tạo chiều rộng cột cho bảng
     */
    initializeColumnWidths(table) {
        if (table.rows.length === 0) return;
        
        // Đặt table-layout: fixed để cột giữ nguyên kích thước khi resize
        table.style.tableLayout = 'fixed';
        
        const firstRow = table.rows[0];
        const totalCols = firstRow.cells.length;
        const defaultWidth = Math.floor(100 / totalCols);
        
        // Thiết lập chiều rộng ban đầu cho mỗi cột
        for (let i = 0; i < totalCols; i++) {
            // Duyệt qua tất cả các hàng và cập nhật chiều rộng cho cột thứ i
            Array.from(table.rows).forEach(row => {
                if (row.cells[i]) {
                    row.cells[i].style.width = `${defaultWidth}%`;
                }
            });
        }
    }
    
    /**
     * Thiết lập sự kiện resize column
     */
    setupColumnResizeListeners(table) {
        const cells = table.querySelectorAll('td');
        
        cells.forEach(cell => {
            // Sự kiện cho resize column
            cell.addEventListener('mousemove', (e) => {
                if (this.resizingColumn) return;

                const cellRect = cell.getBoundingClientRect();
                const mouseX = e.clientX;
                
                // Kiểm tra nếu chuột ở gần cạnh phải của cell (5px)
                if (Math.abs(mouseX - (cellRect.right)) <= 5) {
                    cell.style.cursor = 'col-resize';
                    
                    // Lưu trữ thông tin cell và cột để resize
                    cell.dataset.canResize = 'right';
                } else {
                    cell.style.cursor = '';
                    delete cell.dataset.canResize;
                }
            });

            // Bắt đầu resize khi mousedown
            cell.addEventListener('mousedown', (e) => {
                if (cell.dataset.canResize) {
                    const cellRect = cell.getBoundingClientRect();
                    
                    this.resizingColumn = true;
                    this.startX = e.clientX;
                    this.targetCell = cell;
                    this.targetColumnIndex = cell.cellIndex;
                    this.targetTable = cell.closest('table');
                    
                    // Thêm class vào table để đánh dấu đang resize
                    this.targetTable.classList.add('resizing-column');
                    
                    // Lưu trữ chiều rộng ban đầu của tất cả các cột
                    this.columnWidths = [];
                    const firstRow = this.targetTable.rows[0];
                    for (let i = 0; i < firstRow.cells.length; i++) {
                        this.columnWidths.push(firstRow.cells[i].getBoundingClientRect().width);
                    }
                    
                    // Hiển thị visual resizer
                    this.tableResizer.style.display = 'block';
                    this.tableResizer.style.height = `${this.targetTable.offsetHeight}px`;
                    this.tableResizer.style.top = `${this.targetTable.getBoundingClientRect().top + window.scrollY}px`;
                    this.tableResizer.style.left = `${cellRect.right + window.scrollX}px`;

                    e.preventDefault();
                    e.stopPropagation(); // Ngăn chặn sự kiện lan truyền để tránh kích hoạt các xử lý khác
                }
            });
        });
    }
    
    /**
     * Xử lý sự kiện di chuyển chuột để resize
     */
    handleMouseMove(e) {
        if (this.resizingColumn && this.targetCell) {
            const diffX = e.clientX - this.startX;
            const table = this.targetTable;
            const colIndex = this.targetColumnIndex;
            
            // Đảm bảo không resize nhỏ hơn kích thước tối thiểu
            const minWidth = 30;
            const newWidth = Math.max(minWidth, this.columnWidths[colIndex] + diffX);
            
            // Cập nhật vị trí của visual resizer
            this.tableResizer.style.left = `${this.targetCell.getBoundingClientRect().left + newWidth + window.scrollX}px`;
            
            // Đặt chiều rộng cụ thể cho tất cả các cột để đảm bảo chúng không thay đổi
            const firstRow = table.rows[0];
            for (let i = 0; i < firstRow.cells.length; i++) {
                // Với tất cả các cột khác, đặt pixelWidth cố định để đảm bảo chúng không thay đổi
                if (i !== colIndex) {
                    const pixelWidth = this.columnWidths[i];
                    Array.from(table.rows).forEach(row => {
                        if (row.cells[i]) {
                            row.cells[i].style.width = `${pixelWidth}px`;
                        }
                    });
                }
            }
            
            // Chỉ áp dụng width mới cho cột đang được resize
            Array.from(table.rows).forEach(row => {
                if (row.cells[colIndex]) {
                    row.cells[colIndex].style.width = `${newWidth}px`;
                }
            });
            
            // Đặt table width là tổng của tất cả các cột
            let totalWidth = 0;
            for (let i = 0; i < firstRow.cells.length; i++) {
                if (i === colIndex) {
                    totalWidth += newWidth;
                } else {
                    totalWidth += this.columnWidths[i];
                }
            }
            
            table.style.width = `${totalWidth}px`;
            
            // Ngăn chặn sự kiện lan truyền và hành vi mặc định
            e.preventDefault();
            e.stopPropagation();
        }
    }
    
    /**
     * Xử lý sự kiện thả chuột
     */
    handleMouseUp() {
        if (this.resizingColumn) {
            if (this.targetTable) {
                this.targetTable.classList.remove('resizing-column');
                
                // Thông báo cho các handler khác biết việc resize đã hoàn tất
                const event = new CustomEvent('table-resize-complete', {
                    detail: { table: this.targetTable }
                });
                document.dispatchEvent(event);
            }
            
            this.resizingColumn = false;
            this.targetCell = null;
            this.targetTable = null;
            this.columnWidths = null;
            this.tableResizer.style.display = 'none';
        }
    }
    
    /**
     * Áp dụng tất cả các xử lý resize cho bảng mới
     */
    applyToTable(table) {
        // Đảm bảo tất cả các cột có width cụ thể
        this.initializeColumnWidths(table);
        
        // Thiết lập resize column
        this.setupColumnResizeListeners(table);
    }
}

// Export class
window.TableResizeHandler = TableResizeHandler; 