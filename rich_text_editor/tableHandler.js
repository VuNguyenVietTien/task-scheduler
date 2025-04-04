/**
 * TableHandler - Xử lý chức năng bảng trong rich text editor
 */
class TableHandler {
    constructor(editor) {
        this.editor = editor;
        this.currentTable = null;
        this.currentTableCell = null;
        this.tableMenu = document.getElementById('table-menu');
        
        // Khởi tạo TableResizeHandler để xử lý resize cột
        this.resizeHandler = new TableResizeHandler(editor);
        
        // Khởi tạo TableMenuHandler để xử lý menu button
        this.menuHandler = new TableMenuHandler(editor);

        // Thêm CSS cho table container
        this.addTableContainerStyles();
        
        // State cho cell selection
        this.selectedCells = [];
        this.isSelecting = false;
        this.selectionStartCell = null;
        this.selectionEndCell = null;

        // Khởi tạo event listeners
        this.initEvents();
    }

    initEvents() {
        // Theo dõi tất cả table trong editor
        this.observeTablesInEditor();

        // Xử lý các nút trong menu
        this.setupTableMenuHandlers();
        
        // Lắng nghe sự kiện resize table hoàn tất
        document.addEventListener('table-resize-complete', (e) => {
            const table = e.detail.table;
            if (table) {
                // Cập nhật vị trí menu button
                this.menuHandler.updateAllMenuButtonPositions();
                
                // Đảm bảo table vẫn được focus sau khi resize
                if (!table.classList.contains('focused')) {
                    table.classList.add('focused');
                }
                
                // Hiển thị lại menu button nếu cần
                this.menuHandler.updateMenuButtonVisibility(table, true);
            }
        });

        // Khởi tạo sự kiện click cho menu items
        this.setupEvents();
        
        // Lắng nghe sự kiện resize cửa sổ để cập nhật kích thước các container
        window.addEventListener('resize', () => {
            // Cập nhật tất cả các container
            this.updateAllTableContainers();
        });
    }

    setupEvents() {
        document.addEventListener('click', (event) => {
            const target = event.target;
            
            // Xử lý các sự kiện của bảng
            if (target.classList.contains('dropdown-item') && target.dataset.tableAction) {
                const action = target.dataset.tableAction;
                
                if (this.currentTable) {
                    switch (action) {
                        case 'insert-row-above':
                            this.insertRow(this.currentTable, true);
                            break;
                        case 'insert-row-below':
                            this.insertRow(this.currentTable, false);
                            break;
                        case 'delete-row':
                            this.deleteRow(this.currentTable);
                            break;
                        case 'insert-column-left':
                            this.insertColumn(this.currentTable, true);
                            break;
                        case 'insert-column-right':
                            this.insertColumn(this.currentTable, false);
                            break;
                        case 'delete-column':
                            this.deleteColumn(this.currentTable);
                            break;
                        case 'delete-table':
                            this.deleteTable(this.currentTable);
                            break;
                        case 'merge-cells':
                            this.mergeCells(this.currentTable);
                            break;
                        case 'unmerge-cells':
                            this.unmergeCells(this.currentTable);
                            break;
                    }
                }
                
                // Đóng dropdown menu sau khi thực hiện hành động
                const dropdownMenu = target.closest('.dropdown-menu');
                if (dropdownMenu) {
                    dropdownMenu.classList.remove('show');
                    const dropdownToggle = document.querySelector(`[data-bs-toggle="dropdown"][aria-expanded="true"]`);
                    if (dropdownToggle) {
                        dropdownToggle.setAttribute('aria-expanded', 'false');
                    }
                }
            }
        });
    }

    observeTablesInEditor() {
        // Sử dụng MutationObserver để phát hiện khi table được thêm vào editor
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeName === 'TABLE' || (node.nodeType === Node.ELEMENT_NODE && node.querySelector('table'))) {
                            const tables = node.nodeName === 'TABLE' ? [node] : node.querySelectorAll('table');
                            tables.forEach(table => this.setupTableListeners(table));
                        }
                    });
                }
            });
        });
        
        observer.observe(this.editor, { childList: true, subtree: true });

        // Khởi tạo cho các table đã có sẵn
        this.editor.querySelectorAll('table').forEach(table => {
            this.setupTableListeners(table);
        });
        
        // Để menuHandler theo dõi các table mới
        this.menuHandler.observeTablesInEditor();
    }

    setupTableListeners(table) {
        // Thêm hướng dẫn sử dụng cho người dùng khi hover vào bảng
        table.title = "Click + kéo để chọn nhiều ô, Ctrl+Click để chọn ô rời rạc, sau đó dùng menu để gộp ô";
        
        // Đặt mode mặc định là edit
        table.dataset.mode = 'edit';
        
        // Theo dõi sự thay đổi mode
        document.addEventListener('table-mode-change', (e) => {
            if (e.detail && e.detail.table === table) {
                const mode = e.detail.mode;
                table.dataset.mode = mode;
                
                // Cập nhật lại behavior của các cell dựa trên mode
                if (mode === 'edit') {
                    // Xóa tất cả cell đang được chọn
                    this.clearCellSelection();
                }
            }
        });
        
        // Sự kiện click vào cell
        table.querySelectorAll('td, th').forEach(cell => {
            // Sự kiện mousedown để bắt đầu chọn ô
            cell.addEventListener('mousedown', (e) => {
                // Nếu không phải là nút chuột trái thì bỏ qua
                if (e.button !== 0) return;
                
                // Xác định mode hiện tại
                const mode = table.dataset.mode || 'edit';
                
                // Lưu giá trị currentTable và currentTableCell
                this.currentTable = table;
                this.currentTableCell = cell;
                
                // Nếu đang ở chế độ edit
                if (mode === 'edit') {
                    // Bỏ qua xử lý selection, cho phép editing nội dung
                    return;
                }
                
                // Nếu đang ở chế độ merge
                if (mode === 'merge') {
                    // Nếu giữ phím Ctrl và đã có selection, thêm/xóa ô khỏi selection
                    if (e.ctrlKey && this.selectedCells.length > 0) {
                        // Toggle selection của ô hiện tại
                        const index = this.selectedCells.indexOf(cell);
                        if (index > -1) {
                            this.selectedCells.splice(index, 1);
                            cell.classList.remove('selected-cell');
                        } else {
                            this.selectedCells.push(cell);
                            cell.classList.add('selected-cell');
                        }
                    } else {
                        // Nếu không giữ Ctrl, bắt đầu selection mới
                        this.clearCellSelection();
                        this.isSelecting = true;
                        this.selectionStartCell = cell;
                        this.selectedCells = [cell];
                        cell.classList.add('selected-cell');
                    }
                    
                    // Ngăn chặn mặc định để tránh chọn text
                    e.preventDefault();
                }
            });
            
            // Sự kiện mouseenter để mở rộng selection
            cell.addEventListener('mouseenter', (e) => {
                const mode = table.dataset.mode || 'edit';
                
                // Chỉ xử lý nếu đang ở chế độ merge
                if (mode === 'merge' && this.isSelecting && this.selectionStartCell) {
                    // Cập nhật ô kết thúc selection
                    this.selectionEndCell = cell;
                    
                    // Làm mới selection dựa trên ô bắt đầu và kết thúc
                    this.updateCellSelection();
                }
            });
            
            // Sự kiện click để xử lý khi người dùng chỉ click đơn giản
            cell.addEventListener('click', (e) => {
                const mode = table.dataset.mode || 'edit';
                
                // Lưu giá trị currentTable và currentTableCell
                this.currentTable = table;
                this.currentTableCell = cell;
                
                // Nếu đang ở chế độ edit, cho phép click vào cell để edit
                if (mode === 'edit') {
                    // Không làm gì đặc biệt, để sự kiện mặc định xảy ra
                } else if (mode === 'merge') {
                    // Ngăn chặn bubble để tránh ảnh hưởng đến sự kiện khác
                    e.stopPropagation();
                }
            });
        });
        
        // Sự kiện mouseup để kết thúc selection
        document.addEventListener('mouseup', (e) => {
            const mode = table.dataset.mode || 'edit';
            
            // Chỉ xử lý nếu đang ở chế độ merge
            if (mode === 'merge' && this.isSelecting) {
                this.isSelecting = false;
                console.log(`Đã chọn ${this.selectedCells.length} ô`);
            }
        });

        // Áp dụng xử lý resize từ TableResizeHandler
        this.resizeHandler.applyToTable(table);
        
        // Áp dụng xử lý menu từ TableMenuHandler
        this.menuHandler.applyToTable(table);
        
        // Xử lý khi table resize vượt quá container
        table.addEventListener('table-resize-start', () => {
            // Lưu chiều rộng hiện tại của table để so sánh sau khi resize
            table.dataset.initialWidth = table.offsetWidth;
        });
        
        table.addEventListener('table-resize-complete', (e) => {
            // Kiểm tra nếu table nằm trong container
            const container = table.closest('.table-container');
            if (container) {
                // Cập nhật lại container khi table thay đổi kích thước
                this.updateTableContainer(table, container);
            }
        });
    }

    /**
     * Xóa hết tất cả các cell đã chọn
     */
    clearCellSelection() {
        if (this.selectedCells && this.selectedCells.length > 0) {
            this.selectedCells.forEach(cell => {
                cell.classList.remove('selected-cell');
            });
            this.selectedCells = [];
        }
        this.selectionStartCell = null;
        this.selectionEndCell = null;
    }
    
    /**
     * Cập nhật selection dựa trên ô bắt đầu và kết thúc
     */
    updateCellSelection() {
        if (!this.selectionStartCell || !this.selectionEndCell || !this.currentTable) return;
        
        // Xóa selection cũ
        this.selectedCells.forEach(cell => {
            cell.classList.remove('selected-cell');
        });
        this.selectedCells = [];
        
        // Lấy vị trí của ô bắt đầu và kết thúc
        const startRowIndex = this.selectionStartCell.parentElement.rowIndex;
        const startCellIndex = this.selectionStartCell.cellIndex;
        const endRowIndex = this.selectionEndCell.parentElement.rowIndex;
        const endCellIndex = this.selectionEndCell.cellIndex;
        
        // Xác định phạm vi selection
        const minRowIndex = Math.min(startRowIndex, endRowIndex);
        const maxRowIndex = Math.max(startRowIndex, endRowIndex);
        const minCellIndex = Math.min(startCellIndex, endCellIndex);
        const maxCellIndex = Math.max(startCellIndex, endCellIndex);
        
        // Chọn tất cả các ô trong phạm vi
        for (let i = minRowIndex; i <= maxRowIndex; i++) {
            const row = this.currentTable.rows[i];
            for (let j = minCellIndex; j <= maxCellIndex; j++) {
                // Đảm bảo rằng ô tồn tại
                if (row.cells[j]) {
                    const cell = row.cells[j];
                    cell.classList.add('selected-cell');
                    this.selectedCells.push(cell);
                }
            }
        }
    }

    insertTable(rows, cols) {
        // Đảm bảo editor được focus trước khi chèn bảng
        this.editor.focus();
        
        // Lấy vị trí selection hiện tại
        const selection = window.getSelection();
        let range;
        
        try {
            // Kiểm tra xem có selection không
            if (selection.rangeCount > 0) {
                range = selection.getRangeAt(0);
                
                // Kiểm tra range có thuộc editor không
                if (!this.editor.contains(range.commonAncestorContainer)) {
                    console.log("Range không thuộc editor, tạo range mới");
                    // Đây là trường hợp đặc biệt - range không thuộc editor
                    // Trong trường hợp này, ta sẽ chèn vào vị trí cuối editor
                    range = document.createRange();
                    let lastNode = this.editor.lastChild;
                    if (!lastNode || lastNode.nodeName.toLowerCase() !== 'p') {
                        lastNode = document.createElement('p');
                        lastNode.innerHTML = '<br>';
                        this.editor.appendChild(lastNode);
                    }
                    range.setStart(lastNode, lastNode.childNodes.length || 0);
                    range.collapse(true);
                    
                    // Áp dụng range mới cho selection
                    selection.removeAllRanges();
                    selection.addRange(range);
                } else {
                    console.log("Range thuộc editor, sử dụng vị trí hiện tại");
                }
            } else {
                console.log("Không có range, tạo range mới");
                // Tạo range mới tại vị trí cuối editor nếu không có range
                range = document.createRange();
                let lastNode = this.editor.lastChild;
                if (!lastNode || lastNode.nodeName.toLowerCase() !== 'p') {
                    lastNode = document.createElement('p');
                    lastNode.innerHTML = '<br>';
                    this.editor.appendChild(lastNode);
                }
                range.setStart(lastNode, lastNode.childNodes.length || 0);
                range.collapse(true);
                
                // Áp dụng range mới
                selection.removeAllRanges();
                selection.addRange(range);
            }
        } catch (e) {
            console.error("Lỗi khi xử lý range:", e);
            // Xử lý lỗi - tạo range mới tại vị trí cuối editor
            range = document.createRange();
            let lastNode = this.editor.lastChild;
            if (!lastNode || lastNode.nodeName.toLowerCase() !== 'p') {
                lastNode = document.createElement('p');
                lastNode.innerHTML = '<br>';
                this.editor.appendChild(lastNode);
            }
            range.setStart(lastNode, lastNode.childNodes.length || 0);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        }
        
        // Lấy range hiện tại (đã xác thực)
        range = selection.getRangeAt(0);
        console.log("Range chèn bảng:", range.startContainer, range.startOffset);
        
        // Tính toán kích thước ban đầu cho bảng
        const defaultTableWidth = 600; // Chiều rộng mặc định cho bảng mới là 600px
        const colWidth = Math.floor(defaultTableWidth / cols);
        
        // Lấy tùy chọn header
        const hasHeaderRow = document.getElementById('header-row').checked;
        const hasHeaderColumn = document.getElementById('header-column').checked;
        
        // Tạo HTML cho table với kích thước cố định
        let tableHTML = `<table style="width:${defaultTableWidth}px; table-layout:fixed;">`;
        
        // Tạo các hàng và cột
        for (let i = 0; i < rows; i++) {
            tableHTML += '<tr' + (i === 0 && hasHeaderRow ? ' class="header-row"' : '') + '>';
            
            for (let j = 0; j < cols; j++) {
                // Xác định nếu cell này là header
                const isHeader = (i === 0 && hasHeaderRow) || (j === 0 && hasHeaderColumn);
                // Sử dụng th cho header và td cho các cell thông thường
                const cellTag = isHeader ? 'th' : 'td';
                
                // Thêm class header-column cho cột đầu tiên nếu được chọn
                const headerColumnClass = (j === 0 && hasHeaderColumn) ? ' class="header-column"' : '';
                
                // Thiết lập chiều rộng ban đầu cho mỗi cột (pixel cố định)
                // Không thêm text "Tiêu đề" cho header, chỉ dùng khoảng trắng như các cell khác
                tableHTML += `<${cellTag}${headerColumnClass} style="width:${colWidth}px;">&nbsp;</${cellTag}>`;
            }
            
            tableHTML += '</tr>';
        }
        tableHTML += '</table>';
        
        // Tạo div tạm để chứa table
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = tableHTML;
        const table = tempDiv.firstChild;
        
        // Tạo container cho table
        const tableContainer = document.createElement('div');
        tableContainer.className = 'table-container';
        
        // Thêm class cho container nếu có header
        if (hasHeaderRow) {
            tableContainer.classList.add('has-sticky-header');
        }
        if (hasHeaderColumn) {
            tableContainer.classList.add('has-sticky-first-column');
        }
        
        // Tính toán chiều rộng tối đa dựa trên chiều rộng của editor trừ đi một khoảng lề
        const editorWidth = this.editor.offsetWidth;
        const margin = 20; // 20px margin từ mỗi bên
        const maxWidth = editorWidth - (margin * 2);
        tableContainer.style.maxWidth = `${maxWidth}px`;
        
        // Thêm table vào container
        tableContainer.appendChild(table);
        
        // Chèn container vào editor tại vị trí selection hiện tại
        try {
            console.log("Đang chèn bảng tại vị trí selection...");
            // Xóa nội dung cũ trong range nếu có
            range.deleteContents();
            
            // Chèn container vào vị trí hiện tại
            range.insertNode(tableContainer);
            
            // Tạo một paragraph mới sau bảng nếu bảng được chèn ở cuối
            const isAtEnd = !tableContainer.nextSibling || 
                           (tableContainer.nextSibling.nodeType === Node.TEXT_NODE && 
                            !tableContainer.nextSibling.textContent.trim());
            
            if (isAtEnd) {
                const paragraph = document.createElement('p');
                paragraph.innerHTML = '<br>';
                this.editor.appendChild(paragraph);
                
                // Di chuyển con trỏ đến paragraph mới
                const newRange = document.createRange();
                newRange.setStart(paragraph, 0);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
            } else {
                // Nếu bảng được chèn ở giữa văn bản, đặt con trỏ sau bảng
                const newRange = document.createRange();
                newRange.setStartAfter(tableContainer);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        } catch (e) {
            console.error('Lỗi khi chèn bảng:', e);
            // Nếu có lỗi, thêm container vào cuối editor
            this.editor.appendChild(tableContainer);
            
            // Tạo paragraph mới sau bảng
            const paragraph = document.createElement('p');
            paragraph.innerHTML = '<br>';
            this.editor.appendChild(paragraph);
            
            // Di chuyển con trỏ đến paragraph mới
            const newRange = document.createRange();
            newRange.setStart(paragraph, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }
        
        // Thiết lập các event listener cho table
        this.setupTableListeners(table);
        
        // Đặt focus cho table
        setTimeout(() => {
            // Di chuyển con trỏ đến ô đầu tiên (không phải header) sau khi table được thêm vào DOM
            let firstCell;
            if (hasHeaderRow && hasHeaderColumn) {
                // Nếu có cả header hàng và cột, di chuyển đến ô đầu tiên không phải header (hàng 2, cột 2)
                firstCell = table.rows[1]?.cells[1] || table.querySelector('td');
            } else if (hasHeaderRow) {
                // Nếu chỉ có header hàng, di chuyển đến ô đầu tiên của hàng thứ 2
                firstCell = table.rows[1]?.cells[0] || table.querySelector('td');
            } else if (hasHeaderColumn) {
                // Nếu chỉ có header cột, di chuyển đến ô đầu tiên không phải header trong hàng đầu tiên
                firstCell = table.rows[0]?.cells[1] || table.querySelector('td');
            } else {
                // Không có header, di chuyển đến ô đầu tiên
                firstCell = table.querySelector('td');
            }
            
            if (firstCell) {
                const cellRange = document.createRange();
                cellRange.selectNodeContents(firstCell);
                cellRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(cellRange);
                firstCell.focus();
            }
        }, 10);
        
        // Cập nhật container để đảm bảo kích thước phù hợp
        this.updateTableContainer(table, tableContainer);
    }

    setupTableMenuHandlers() {
        // Chèn hàng phía trên
        document.getElementById('insert-row-above').addEventListener('click', () => {
            if (!this.currentTableCell) return;
            
            const row = this.currentTableCell.parentElement;
            const newRow = document.createElement('tr');
            const cellCount = row.cells.length;
            
            for (let i = 0; i < cellCount; i++) {
                const newCell = document.createElement('td');
                newCell.innerHTML = '&nbsp;';
                // Sao chép style width từ ô tương ứng ở hàng hiện tại
                if (row.cells[i]) {
                    newCell.style.width = row.cells[i].style.width;
                }
                newCell.addEventListener('click', () => {
                    this.currentTableCell = newCell;
                });
                newRow.appendChild(newCell);
            }
            
            row.parentElement.insertBefore(newRow, row);
            this.tableMenu.style.display = 'none';
        });

        // Chèn hàng phía dưới
        document.getElementById('insert-row-below').addEventListener('click', () => {
            if (!this.currentTableCell) return;
            
            const row = this.currentTableCell.parentElement;
            const newRow = document.createElement('tr');
            const cellCount = row.cells.length;
            
            for (let i = 0; i < cellCount; i++) {
                const newCell = document.createElement('td');
                newCell.innerHTML = '&nbsp;';
                // Sao chép style width từ ô tương ứng ở hàng hiện tại
                if (row.cells[i]) {
                    newCell.style.width = row.cells[i].style.width;
                }
                newCell.addEventListener('click', () => {
                    this.currentTableCell = newCell;
                });
                newRow.appendChild(newCell);
            }
            
            if (row.nextElementSibling) {
                row.parentElement.insertBefore(newRow, row.nextElementSibling);
            } else {
                row.parentElement.appendChild(newRow);
            }
            
            this.tableMenu.style.display = 'none';
        });

        // Chèn cột bên trái
        document.getElementById('insert-column-left').addEventListener('click', () => {
            if (!this.currentTableCell) return;
            
            const cellIndex = this.currentTableCell.cellIndex;
            const table = this.getCurrentTable();
            
            // Kích thước cố định cho cột mới bằng pixel
            const newColWidth = 80; // 80px
            
            // Tính tổng chiều rộng hiện tại của bảng
            const currentTableWidth = table.offsetWidth;
            // Chiều rộng mới = chiều rộng hiện tại + chiều rộng cột mới
            const newTableWidth = currentTableWidth + newColWidth;
            
            table.querySelectorAll('tr').forEach(row => {
                const newCell = document.createElement('td');
                newCell.innerHTML = '&nbsp;';
                newCell.style.width = `${newColWidth}px`;
                
                newCell.addEventListener('click', () => {
                    this.currentTableCell = newCell;
                });
                row.insertBefore(newCell, row.cells[cellIndex]);
            });
            
            // Cập nhật chiều rộng bảng
            table.style.width = `${newTableWidth}px`;
            
            this.tableMenu.style.display = 'none';
            
            // Cập nhật lại event listeners resize sau khi thêm cột mới
            this.resizeHandler.setupColumnResizeListeners(table);
            
            // Cập nhật lại vị trí button menu sau khi thay đổi table
            this.menuHandler.updateAllMenuButtonPositions();
        });

        // Chèn cột bên phải
        document.getElementById('insert-column-right').addEventListener('click', () => {
            if (!this.currentTableCell) return;
            
            const cellIndex = this.currentTableCell.cellIndex;
            const table = this.getCurrentTable();
            
            // Kích thước cố định cho cột mới bằng pixel
            const newColWidth = 80; // 80px
            
            // Tính tổng chiều rộng hiện tại của bảng
            const currentTableWidth = table.offsetWidth;
            // Chiều rộng mới = chiều rộng hiện tại + chiều rộng cột mới
            const newTableWidth = currentTableWidth + newColWidth;
            
            table.querySelectorAll('tr').forEach(row => {
                const newCell = document.createElement('td');
                newCell.innerHTML = '&nbsp;';
                newCell.style.width = `${newColWidth}px`;
                
                newCell.addEventListener('click', () => {
                    this.currentTableCell = newCell;
                });
                
                if (cellIndex === row.cells.length - 1) {
                    row.appendChild(newCell);
                } else {
                    row.insertBefore(newCell, row.cells[cellIndex + 1]);
                }
            });
            
            // Cập nhật chiều rộng bảng
            table.style.width = `${newTableWidth}px`;
            
            this.tableMenu.style.display = 'none';
            
            // Cập nhật lại event listeners resize sau khi thêm cột mới
            this.resizeHandler.setupColumnResizeListeners(table);
            
            // Cập nhật lại vị trí button menu sau khi thay đổi table
            this.menuHandler.updateAllMenuButtonPositions();
        });

        // Xóa hàng
        document.getElementById('delete-row').addEventListener('click', () => {
            if (!this.currentTableCell) return;
            
            const row = this.currentTableCell.parentElement;
            const table = this.getCurrentTable();
            
            // Không xóa nếu đây là hàng duy nhất
            if (table.rows.length > 1) {
                row.remove();
            }
            
            this.tableMenu.style.display = 'none';
            
            // Cập nhật lại vị trí button menu sau khi thay đổi table
            this.menuHandler.updateAllMenuButtonPositions();
        });

        // Xóa cột
        document.getElementById('delete-column').addEventListener('click', () => {
            if (!this.currentTableCell) return;
            
            const cellIndex = this.currentTableCell.cellIndex;
            const table = this.getCurrentTable();
            
            // Không xóa nếu đây là cột duy nhất
            if (table.rows[0].cells.length > 1) {
                // Lấy chiều rộng của cột sẽ bị xóa trước khi xóa
                const colWidth = table.rows[0].cells[cellIndex].offsetWidth;
                
                // Tính chiều rộng hiện tại của bảng
                const currentTableWidth = table.offsetWidth;
                
                // Xóa cột từ tất cả các hàng
                table.querySelectorAll('tr').forEach(row => {
                    row.deleteCell(cellIndex);
                });
                
                // Cập nhật chiều rộng bảng sau khi xóa cột
                const newTableWidth = currentTableWidth - colWidth;
                table.style.width = `${newTableWidth}px`;
            }
            
            this.tableMenu.style.display = 'none';
            
            // Cập nhật lại vị trí button menu sau khi thay đổi table
            this.menuHandler.updateAllMenuButtonPositions();
        });

        // Xóa bảng
        document.getElementById('delete-table').addEventListener('click', () => {
            const table = this.getCurrentTable();
            
            if (table) {
                // Xóa button menu trước khi xóa bảng
                if (table.menuButton) {
                    table.menuButton.remove();
                    table.menuButton = null;
                }
                
                // Xóa container nếu có, nếu không thì xóa table
                const container = table.closest('.table-container');
                if (container) {
                    container.remove();
                } else {
                    table.remove();
                }
                
                this.currentTable = null;
                this.currentTableCell = null;
            }
            
            this.tableMenu.style.display = 'none';
        });

        // Xử lý chuyển đổi hàng tiêu đề
        document.getElementById('toggle-header-row').addEventListener('click', () => {
            const table = this.getCurrentTable();
            if (table) {
                this.toggleHeaderRow(table);
            }
            this.tableMenu.style.display = 'none';
        });

        // Xử lý chuyển đổi cột tiêu đề
        document.getElementById('toggle-header-column').addEventListener('click', () => {
            const table = this.getCurrentTable();
            if (table) {
                this.toggleHeaderColumn(table);
            }
            this.tableMenu.style.display = 'none';
        });

        // Xử lý cố định hàng
        document.getElementById('freeze-row').addEventListener('click', () => {
            const table = this.getCurrentTable();
            if (table) {
                this.freezeRow(table);
            }
            this.tableMenu.style.display = 'none';
        });

        // Xử lý cố định cột
        document.getElementById('freeze-column').addEventListener('click', () => {
            const table = this.getCurrentTable();
            if (table) {
                this.freezeColumn(table);
            }
            this.tableMenu.style.display = 'none';
        });

        // Xử lý bỏ cố định tất cả
        document.getElementById('unfreeze-all').addEventListener('click', () => {
            const table = this.getCurrentTable();
            if (table) {
                this.unfreezeAll(table);
            }
            this.tableMenu.style.display = 'none';
        });

        // Gộp ô
        document.getElementById('merge-cells').addEventListener('click', () => {
            const table = this.getCurrentTable();
            if (table) {
                this.mergeCells(table);
            }
            this.tableMenu.style.display = 'none';
        });

        // Tách ô
        document.getElementById('unmerge-cells').addEventListener('click', () => {
            const table = this.getCurrentTable();
            if (table) {
                this.unmergeCells(table);
            }
            this.tableMenu.style.display = 'none';
        });
    }
    
    /**
     * Lấy table hiện tại - ưu tiên từ menuHandler nếu có
     */
    getCurrentTable() {
        // Ưu tiên lấy table từ menuHandler vì nó luôn cập nhật khi table được focus
        const menuHandlerTable = this.menuHandler.getCurrentTable();
        if (menuHandlerTable) {
            return menuHandlerTable;
        }
        return this.currentTable;
    }

    /**
     * Chèn cột mới vào bảng
     * @param {HTMLTableElement} table - Bảng cần thêm cột
     * @param {string} position - Vị trí thêm cột ('left' hoặc 'right')
     */
    insertColumn(table, position) {
        if (!this.currentTableCell || !table) return;
        
        const cellIndex = this.currentTableCell.cellIndex;
        const insertIndex = position === 'left' ? cellIndex : cellIndex + 1;
        
        // Kích thước cố định cho cột mới bằng pixel
        const newColWidth = 80; // 80px
        
        // Tính tổng chiều rộng hiện tại của bảng
        const currentTableWidth = table.offsetWidth;
        // Chiều rộng mới = chiều rộng hiện tại + chiều rộng cột mới
        const newTableWidth = currentTableWidth + newColWidth;
        
        table.querySelectorAll('tr').forEach(row => {
            const newCell = document.createElement('td');
            newCell.innerHTML = '&nbsp;';
            newCell.style.width = `${newColWidth}px`;
            
            newCell.addEventListener('click', () => {
                this.currentTableCell = newCell;
            });
            
            if (position === 'left' || insertIndex < row.cells.length) {
                row.insertBefore(newCell, row.cells[insertIndex]);
            } else {
                row.appendChild(newCell);
            }
        });
        
        // Cập nhật chiều rộng bảng
        table.style.width = `${newTableWidth}px`;
        
        // Cập nhật lại vị trí button menu sau khi thay đổi table
        this.menuHandler.updateAllMenuButtonPositions();
        
        // Ẩn menu
        if (this.tableMenu) {
            this.tableMenu.style.display = 'none';
        }
    }

    /**
     * Thêm CSS cho table container vào document
     */
    addTableContainerStyles() {
        const styleElement = document.createElement('style');
        styleElement.textContent = this.getCSSForTableContainer();
        document.head.appendChild(styleElement);
    }

    /**
     * Tạo CSS cho table container
     */
    getCSSForTableContainer() {
        return `
            .table-container {
                overflow: auto;
                max-width: 100%;
                margin: 10px 0;
                border: none;
                position: relative;
                /* Đảm bảo không chiếm quá nhiều không gian */
                max-height: calc(80vh - 100px);
            }
            
            .table-container table {
                width: auto;
                table-layout: fixed;
                border-collapse: separate;
                border-spacing: 0;
                border: 1px solid #999; /* Màu border cho toàn bộ bảng */
            }
            
            /* CSS cho header và cells */
            .table-container th, .table-container td {
                border: 1px solid #ddd;
                padding: 8px;
                min-height: 32px;
                line-height: 1.5;
                vertical-align: middle;
            }
            
            .table-container th {
                background-color: #f2f2f2;
                font-weight: bold;
                text-align: center;
                position: relative;
                border: 1px solid #aaa; /* Màu border riêng cho header */
                height: 32px; /* Đảm bảo header có chiều cao bằng các hàng khác */
            }
            
            /* Đảm bảo các cell có chiều cao đồng nhất */
            .table-container tr {
                height: 32px; /* Chiều cao cố định cho các hàng */
            }
            
            /* CSS cho các ô được chọn */
            .table-container .selected-cell {
                background-color: rgba(79, 142, 213, 0.2);
                outline: 2px solid #4f8ed5;
                position: relative;
                z-index: 1;
            }
            
            /* Cố định hàng đầu (header) */
            .table-container.has-sticky-header tr:first-child th,
            .table-container.has-sticky-header tr:first-child td {
                position: sticky;
                top: 0;
                z-index: 2;
                background-color: #f2f2f2;
                box-shadow: 0 1px 0 #aaa; /* Thêm box-shadow để tạo border dưới khi scroll */
            }
            
            /* Cố định cột đầu tiên */
            .table-container.has-sticky-first-column th:first-child,
            .table-container.has-sticky-first-column td:first-child {
                position: sticky;
                left: 0;
                z-index: 1;
                background-color: #f2f2f2;
                box-shadow: 1px 0 0 #aaa; /* Thêm box-shadow để tạo border phải khi scroll */
            }
            
            /* Trường hợp đặc biệt: góc trên bên trái khi cả hàng và cột được cố định */
            .table-container.has-sticky-header.has-sticky-first-column tr:first-child th:first-child,
            .table-container.has-sticky-header.has-sticky-first-column tr:first-child td:first-child {
                z-index: 3;
                box-shadow: 1px 1px 0 #aaa; /* Box-shadow cho góc */
            }
            
            /* Cố định hàng bất kỳ */
            .table-container tr.sticky-row th,
            .table-container tr.sticky-row td {
                position: sticky;
                background-color: #f2f2f2;
                z-index: 2;
                box-shadow: 0 1px 0 #aaa, 0 -1px 0 #aaa;
            }
            
            /* Cố định cột bất kỳ */
            .table-container .sticky-column {
                position: sticky;
                background-color: #f2f2f2;
                z-index: 1;
                box-shadow: 1px 0 0 #aaa, -1px 0 0 #aaa;
            }

            /* CSS cho các ô được merge */
            .table-container .merged-cell {
                background-color: #f9f9f9;
                border: 1px solid #ddd;
            }
            
            /* Tùy chỉnh thanh cuộn cho table container */
            .table-container::-webkit-scrollbar {
                height: 8px;
                width: 8px;
            }
            
            .table-container::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 4px;
            }
            
            .table-container::-webkit-scrollbar-thumb {
                background: #888;
                border-radius: 4px;
            }
            
            .table-container::-webkit-scrollbar-thumb:hover {
                background: #555;
            }
        `;
    }

    /**
     * Cập nhật container khi table thay đổi kích thước
     * @param {HTMLTableElement} table - Bảng được resize
     * @param {HTMLElement} container - Container của bảng
     */
    updateTableContainer(table, container) {
        // Đảm bảo container luôn có chiều rộng tối đa phù hợp với editor
        const editorWidth = this.editor.offsetWidth;
        const margin = 20; // 20px margin từ mỗi bên
        const maxWidth = editorWidth - (margin * 2);
        container.style.maxWidth = `${maxWidth}px`;
        
        // Tính toán chiều cao tối đa dựa trên chiều cao khung nhìn
        const viewportHeight = window.innerHeight;
        const maxContainerHeight = Math.floor(viewportHeight * 0.8) - 100; // 80% chiều cao màn hình trừ đi 100px
        
        // Tính toán chiều cao thực tế của bảng
        const tableHeight = table.offsetHeight;
        
        // Cài đặt chiều cao tối đa cho container
        container.style.maxHeight = `${maxContainerHeight}px`;
        
        // Tự động điều chỉnh chiều cao container theo nội dung nếu bảng nhỏ hơn maxHeight
        if (tableHeight < maxContainerHeight) {
            // Sử dụng fit-content để container chỉ cao bằng với nội dung
            container.style.height = 'auto';
        } else {
            // Sử dụng chiều cao tối đa nếu bảng lớn hơn
            container.style.height = `${maxContainerHeight}px`;
        }
    }

    /**
     * Cập nhật tất cả các container khi resize cửa sổ
     */
    updateAllTableContainers() {
        // Cập nhật tất cả các container
        this.editor.querySelectorAll('.table-container').forEach(container => {
            const table = container.querySelector('table');
            if (table) {
                this.updateTableContainer(table, container);
            }
        });
    }

    /**
     * Xử lý cố định hàng đang được chọn
     * @param {HTMLTableElement} table - Bảng chứa hàng cần cố định
     */
    freezeRow(table) {
        if (!this.currentTableCell) return;
        
        // Lấy hàng đang được chọn
        const currentRow = this.currentTableCell.parentElement;
        
        // Xóa class sticky-row từ tất cả các hàng
        table.querySelectorAll('tr.sticky-row').forEach(row => {
            if (row !== currentRow) {
                row.classList.remove('sticky-row');
            }
        });
        
        // Tính toán vị trí top cho hàng được cố định
        const container = table.closest('.table-container');
        const headerOffset = table.querySelector('.header-row') ? 
            table.querySelector('.header-row').offsetHeight : 0;
        
        // Thiết lập vị trí top cho sticky-row
        currentRow.style.top = `${headerOffset}px`;
        
        // Thêm class sticky-row cho hàng hiện tại
        currentRow.classList.toggle('sticky-row');
        
        // Cập nhật container nếu cần
        if (container) {
            this.updateTableContainer(table, container);
        }
    }
    
    /**
     * Xử lý cố định cột đang được chọn
     * @param {HTMLTableElement} table - Bảng chứa cột cần cố định
     */
    freezeColumn(table) {
        if (!this.currentTableCell) return;
        
        // Lấy chỉ số cột đang được chọn
        const colIndex = this.currentTableCell.cellIndex;
        
        // Xóa class sticky-column từ tất cả các cell không thuộc cột hiện tại
        table.querySelectorAll('.sticky-column').forEach(cell => {
            if (cell.cellIndex !== colIndex) {
                cell.classList.remove('sticky-column');
            }
        });
        
        // Tính toán vị trí left cho cột được cố định
        const headerColumnOffset = table.querySelector('.header-column') ? 
            table.querySelector('.header-column').offsetWidth : 0;
        
        // Lấy tất cả các ô trong cột đang được chọn
        for (let i = 0; i < table.rows.length; i++) {
            const cell = table.rows[i].cells[colIndex];
            if (cell) {
                // Thiết lập vị trí left nếu có header column
                if (colIndex > 0 && headerColumnOffset > 0) {
                    cell.style.left = `${headerColumnOffset}px`;
                }
                
                // Toggle class sticky-column
                cell.classList.toggle('sticky-column');
            }
        }
        
        // Cập nhật container nếu cần
        const container = table.closest('.table-container');
        if (container) {
            this.updateTableContainer(table, container);
        }
    }
    
    /**
     * Bỏ cố định tất cả các hàng và cột
     * @param {HTMLTableElement} table - Bảng cần bỏ cố định
     */
    unfreezeAll(table) {
        // Xóa tất cả các class sticky-row
        table.querySelectorAll('tr.sticky-row').forEach(row => {
            row.classList.remove('sticky-row');
            row.style.top = '';
        });
        
        // Xóa tất cả các class sticky-column
        table.querySelectorAll('.sticky-column').forEach(cell => {
            cell.classList.remove('sticky-column');
            cell.style.left = '';
        });
        
        // Cập nhật container nếu cần
        const container = table.closest('.table-container');
        if (container) {
            this.updateTableContainer(table, container);
        }
    }
    
    /**
     * Chuyển đổi giữa hàng thường và hàng tiêu đề
     * @param {HTMLTableElement} table - Bảng chứa hàng cần chuyển đổi
     */
    toggleHeaderRow(table) {
        if (!this.currentTableCell) return;
        
        // Lấy hàng đang được chọn
        const currentRow = this.currentTableCell.parentElement;
        
        // Kiểm tra xem hàng hiện tại có phải là header hay không
        const isHeader = currentRow.firstElementChild.tagName.toLowerCase() === 'th';
        
        // Chuyển đổi tất cả các cell trong hàng hiện tại
        Array.from(currentRow.cells).forEach(cell => {
            // Lưu lại nội dung và style
            const content = cell.innerHTML;
            const width = cell.style.width;
            const styles = window.getComputedStyle(cell);
            
            // Tạo cell mới với tag phù hợp
            const newCell = document.createElement(isHeader ? 'td' : 'th');
            newCell.innerHTML = content;
            newCell.style.width = width;
            
            // Thay thế cell cũ bằng cell mới
            cell.parentNode.replaceChild(newCell, cell);
            
            // Thêm lại event listener
            newCell.addEventListener('click', () => {
                this.currentTableCell = newCell;
            });
        });
        
        // Cập nhật class cho hàng
        currentRow.classList.toggle('header-row');
        
        // Cập nhật class cho container
        const container = table.closest('.table-container');
        if (container) {
            // Kiểm tra nếu hàng đầu tiên là header row
            const firstRowIsHeader = table.rows[0].classList.contains('header-row') || 
                                    table.rows[0].firstElementChild.tagName.toLowerCase() === 'th';
            
            if (firstRowIsHeader) {
                container.classList.add('has-sticky-header');
            } else {
                container.classList.remove('has-sticky-header');
            }
            
            this.updateTableContainer(table, container);
        }
    }
    
    /**
     * Chuyển đổi giữa cột thường và cột tiêu đề
     * @param {HTMLTableElement} table - Bảng chứa cột cần chuyển đổi
     */
    toggleHeaderColumn(table) {
        if (!this.currentTableCell) return;
        
        // Lấy chỉ số cột đang được chọn
        const colIndex = this.currentTableCell.cellIndex;
        
        // Kiểm tra xem cột hiện tại có phải là header hay không
        const isHeader = table.rows[0].cells[colIndex].classList.contains('header-column');
        
        // Chuyển đổi tất cả các cell trong cột hiện tại
        for (let i = 0; i < table.rows.length; i++) {
            const cell = table.rows[i].cells[colIndex];
            if (cell) {
                // Lưu lại nội dung và style
                const content = cell.innerHTML;
                const width = cell.style.width;
                
                // Xác định tag mới
                let newTag = 'td';
                if (!isHeader) {
                    // Chuyển sang header column
                    newTag = 'th';
                }
                
                // Cần xử lý đặc biệt nếu đây là cả header row và header column
                if (i === 0 && table.rows[0].classList.contains('header-row')) {
                    newTag = 'th'; // Luôn là th nếu nằm trong header row
                }
                
                // Tạo cell mới
                const newCell = document.createElement(newTag);
                newCell.innerHTML = content;
                newCell.style.width = width;
                
                // Thêm hoặc xóa class header-column
                if (!isHeader) {
                    newCell.classList.add('header-column');
                } else {
                    newCell.classList.remove('header-column');
                }
                
                // Thay thế cell cũ bằng cell mới
                cell.parentNode.replaceChild(newCell, cell);
                
                // Thêm lại event listener
                newCell.addEventListener('click', () => {
                    this.currentTableCell = newCell;
                });
            }
        }
        
        // Cập nhật class cho container
        const container = table.closest('.table-container');
        if (container) {
            // Kiểm tra nếu còn cell header-column nào không
            const hasHeaderColumn = table.querySelector('.header-column') !== null;
            
            if (hasHeaderColumn) {
                container.classList.add('has-sticky-first-column');
            } else {
                container.classList.remove('has-sticky-first-column');
            }
            
            this.updateTableContainer(table, container);
        }
    }

    /**
     * Gộp các ô đã chọn
     * @param {HTMLTableElement} table - Bảng chứa các ô cần gộp
     */
    mergeCells(table) {
        // Trường hợp không có table
        if (!table) return;
        
        // Kiểm tra nếu không có ô nào được chọn hoặc chỉ có 1 ô được chọn thì không cần gộp
        if (!this.selectedCells || this.selectedCells.length <= 1) {
            console.log("Cần chọn ít nhất 2 ô để gộp");
            return;
        }
        
        // Kiểm tra xem các ô đã chọn có tạo thành một hình chữ nhật liên tục không
        if (!this.isRectangularSelection()) {
            console.log("Chỉ có thể gộp các ô tạo thành hình chữ nhật liên tục");
            return;
        }
        
        // Lấy phạm vi của các ô đã chọn
        const {minRowIndex, maxRowIndex, minColIndex, maxColIndex} = this.getSelectionRange();
        
        // Lấy ô đầu tiên trong phạm vi (ô góc trên bên trái)
        const firstCell = table.rows[minRowIndex].cells[minColIndex];
        
        // Lấy nội dung của tất cả các ô đã chọn
        const content = this.getCombinedContent();
        
        // Đặt nội dung cho ô đầu tiên
        firstCell.innerHTML = content;
        
        // Đặt rowspan và colspan cho ô đầu tiên
        const rowSpan = maxRowIndex - minRowIndex + 1;
        const colSpan = maxColIndex - minColIndex + 1;
        
        if (rowSpan > 1) firstCell.rowSpan = rowSpan;
        if (colSpan > 1) firstCell.colSpan = colSpan;
        
        // Đánh dấu ô đã được merge
        firstCell.classList.add('merged-cell');
        firstCell.dataset.isMerged = 'true';
        firstCell.dataset.originalRowIndex = minRowIndex;
        firstCell.dataset.originalColIndex = minColIndex;
        firstCell.dataset.rowSpan = rowSpan;
        firstCell.dataset.colSpan = colSpan;
        
        // Đảm bảo ô có thể edit được sau khi merge
        firstCell.contentEditable = true;
        
        // Xóa các ô khác trong phạm vi đã chọn
        for (let i = minRowIndex; i <= maxRowIndex; i++) {
            const row = table.rows[i];
            // Duyệt từ phải sang trái để tránh vấn đề khi xóa cell
            for (let j = maxColIndex; j >= minColIndex; j--) {
                // Bỏ qua ô đầu tiên
                if (i === minRowIndex && j === minColIndex) continue;
                
                // Nếu có cell tại vị trí này (có thể đã bị xóa do merge trước đó)
                if (row.cells[j]) {
                    row.deleteCell(j);
                }
            }
        }
        
        // Cập nhật lại selection sau khi merge
        this.clearCellSelection();
        this.selectedCells = [firstCell];
        firstCell.classList.add('selected-cell');
        
        // Cập nhật currentTableCell
        this.currentTableCell = firstCell;
        
        // Chuyển sang chế độ edit sau khi merge
        if (table.modeSwitchBtn) {
            table.modeSwitchBtn.dataset.mode = 'edit';
            table.modeSwitchBtn.innerHTML = '<i class="fas fa-edit"></i>';
            table.modeSwitchBtn.title = 'Chế độ chỉnh sửa';
            table.classList.add('edit-mode');
            table.classList.remove('merge-mode');
            table.dataset.mode = 'edit';
            
            // Thông báo sự thay đổi mode
            const event = new CustomEvent('table-mode-change', {
                detail: { table: table, mode: 'edit' }
            });
            document.dispatchEvent(event);
        }
    }
    
    /**
     * Tách ô đã gộp
     * @param {HTMLTableElement} table - Bảng chứa ô cần tách
     */
    unmergeCells(table) {
        // Kiểm tra nếu ô hiện tại có phải là ô đã gộp không
        const cell = this.currentTableCell;
        if (!cell || !cell.dataset.isMerged) {
            console.log("Ô hiện tại không phải là ô đã gộp");
            return;
        }
        
        // Lấy thông tin rowspan và colspan
        const rowSpan = parseInt(cell.rowSpan) || 1;
        const colSpan = parseInt(cell.colSpan) || 1;
        
        // Nếu không có rowspan và colspan thì không cần tách
        if (rowSpan === 1 && colSpan === 1) {
            console.log("Ô hiện tại không phải là ô đã gộp");
            return;
        }
        
        // Lấy vị trí của ô gốc
        const rowIndex = parseInt(cell.dataset.originalRowIndex) || cell.parentElement.rowIndex;
        const colIndex = parseInt(cell.dataset.originalColIndex) || cell.cellIndex;
        
        // Lấy nội dung hiện tại của ô đã gộp
        const content = cell.innerHTML;
        
        // Reset rowspan và colspan
        cell.rowSpan = 1;
        cell.colSpan = 1;
        
        // Xóa classes và attributes liên quan đến merge
        cell.classList.remove('merged-cell');
        delete cell.dataset.isMerged;
        delete cell.dataset.originalRowIndex;
        delete cell.dataset.originalColIndex;
        delete cell.dataset.rowSpan;
        delete cell.dataset.colSpan;
        
        // Tạo lại các ô đã bị xóa
        for (let i = rowIndex; i < rowIndex + rowSpan; i++) {
            const row = table.rows[i];
            
            for (let j = (i === rowIndex ? colIndex + 1 : colIndex); j < colIndex + colSpan; j++) {
                // Tạo cell mới
                const newCell = document.createElement(cell.tagName); // Sử dụng cùng tag (td hoặc th)
                newCell.innerHTML = '&nbsp;';
                
                // Đảm bảo ô có thể edit được
                newCell.contentEditable = true;
                
                // Thêm sự kiện click cho ô mới
                newCell.addEventListener('click', () => {
                    this.currentTableCell = newCell;
                    this.currentTable = table;
                });
                
                // Chèn ô mới vào đúng vị trí
                if (j === colIndex) {
                    // Trường hợp đặc biệt: ô đầu tiên của hàng mới
                    if (row.cells.length === 0) {
                        row.appendChild(newCell);
                    } else {
                        row.insertBefore(newCell, row.cells[0]);
                    }
                } else {
                    // Xác định vị trí chèn
                    let insertBeforeIndex = j;
                    let cellToInsertBefore = null;
                    
                    // Tìm ô phù hợp để chèn trước
                    for (let k = 0; k < row.cells.length; k++) {
                        const currentCellIndex = k + this.countColSpansBefore(row, k);
                        if (currentCellIndex >= j) {
                            cellToInsertBefore = row.cells[k];
                            break;
                        }
                    }
                    
                    if (cellToInsertBefore) {
                        row.insertBefore(newCell, cellToInsertBefore);
                    } else {
                        row.appendChild(newCell);
                    }
                }
            }
        }
        
        // Đặt nội dung gốc cho ô đầu tiên
        cell.innerHTML = content;
        
        // Cập nhật lại selection
        this.clearCellSelection();
    }
    
    /**
     * Đếm tổng colspan của các ô trước ô chỉ định
     * @param {HTMLTableRowElement} row - Hàng chứa các ô
     * @param {number} cellIndex - Chỉ số của ô cần kiểm tra
     * @returns {number} Tổng số colspan
     */
    countColSpansBefore(row, cellIndex) {
        let count = 0;
        for (let i = 0; i < cellIndex; i++) {
            count += (parseInt(row.cells[i].colSpan) || 1) - 1;
        }
        return count;
    }
    
    /**
     * Kiểm tra xem các ô đã chọn có tạo thành một hình chữ nhật liên tục không
     * @returns {boolean} true nếu các ô tạo thành hình chữ nhật, false nếu không
     */
    isRectangularSelection() {
        if (!this.selectedCells || this.selectedCells.length === 0) return false;
        
        // Lấy phạm vi của các ô đã chọn
        const {minRowIndex, maxRowIndex, minColIndex, maxColIndex} = this.getSelectionRange();
        
        // Tính số lượng ô trong hình chữ nhật
        const expectedCount = (maxRowIndex - minRowIndex + 1) * (maxColIndex - minColIndex + 1);
        
        // Nếu số lượng ô đã chọn bằng với số lượng ô trong hình chữ nhật, coi như là liên tục
        return this.selectedCells.length === expectedCount;
    }
    
    /**
     * Lấy phạm vi của các ô đã chọn
     * @returns {Object} Phạm vi chọn
     */
    getSelectionRange() {
        if (!this.selectedCells || this.selectedCells.length === 0) {
            return { minRowIndex: 0, maxRowIndex: 0, minColIndex: 0, maxColIndex: 0 };
        }
        
        // Tìm min/max row và column index
        let minRowIndex = Infinity;
        let maxRowIndex = -Infinity;
        let minColIndex = Infinity;
        let maxColIndex = -Infinity;
        
        this.selectedCells.forEach(cell => {
            const rowIndex = cell.parentElement.rowIndex;
            const colIndex = cell.cellIndex;
            
            minRowIndex = Math.min(minRowIndex, rowIndex);
            maxRowIndex = Math.max(maxRowIndex, rowIndex);
            minColIndex = Math.min(minColIndex, colIndex);
            maxColIndex = Math.max(maxColIndex, colIndex);
        });
        
        return { minRowIndex, maxRowIndex, minColIndex, maxColIndex };
    }
    
    /**
     * Lấy nội dung kết hợp từ tất cả các ô đã chọn
     * @returns {string} Nội dung kết hợp
     */
    getCombinedContent() {
        if (!this.selectedCells || this.selectedCells.length === 0) return '';
        
        // Lấy phạm vi của các ô đã chọn
        const {minRowIndex, maxRowIndex, minColIndex, maxColIndex} = this.getSelectionRange();
        
        let content = '';
        let currentRow = minRowIndex;
        
        // Lấy nội dung theo thứ tự từ trái qua phải, từ trên xuống dưới
        for (let i = minRowIndex; i <= maxRowIndex; i++) {
            for (let j = minColIndex; j <= maxColIndex; j++) {
                // Tìm ô tại vị trí (i, j)
                const cell = this.selectedCells.find(c => 
                    c.parentElement.rowIndex === i && c.cellIndex === j);
                
                // Nếu đã chuyển sang hàng mới, thêm dấu xuống dòng
                if (i !== currentRow) {
                    content += '<br>';
                    currentRow = i;
                }
                
                // Nếu không phải là ô đầu tiên trong hàng, thêm dấu cách
                if (j !== minColIndex) {
                    content += ' ';
                }
                
                // Thêm nội dung của ô
                if (cell) {
                    const cellContent = cell.innerHTML.trim();
                    if (cellContent && cellContent !== '&nbsp;') {
                        content += cellContent;
                    }
                }
            }
        }
        
        // Nếu không có nội dung, trả về khoảng trắng
        return content || '&nbsp;';
    }

    setupStyles() {
        // Thêm CSS cho bảng
        const css = `
            .table-container {
                position: relative;
                margin: 10px 0;
                overflow: auto;
            }
            
            .table-container table {
                border-collapse: collapse;
                width: 100%;
                table-layout: fixed;
                border: 1.5px solid #757575;
            }
            
            .table-container table th, 
            .table-container table td {
                border: 1px solid #dddddd;
                padding: 8px;
                text-align: left;
                position: relative;
                min-width: 100px;
                word-wrap: break-word;
            }
            
            .table-container table thead th {
                background-color: #f2f2f2;
                font-weight: bold;
                border: 1px solid #aaaaaa;
            }
            
            .table-container table th.resizable,
            .table-container table td.resizable {
                position: relative;
            }
            
            .table-container table th.resizable span.resize-handle {
                position: absolute;
                top: 0;
                right: 0;
                width: 5px;
                height: 100%;
                cursor: col-resize;
                z-index: 1;
            }
            
            .table-container .selected-cell {
                background-color: rgba(79, 142, 213, 0.2);
                outline: 2px solid #4f8ed5;
                position: relative;
                z-index: 1;
            }
            
            .table-container .merged-cell {
                background-color: #f9f9f9;
                border: 1px solid #ddd;
            }
        `;
        
        // Thêm CSS vào head
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }
}

// Export class
window.TableHandler = TableHandler; 