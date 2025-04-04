/**
 * TableMenuHandler - Xử lý chức năng menu button và hiển thị menu cho table
 * 
 * @version 1.0
 * @author Rich Text Editor
 */

class TableMenuHandler {
    constructor(editor) {
        this.editor = editor;
        this.currentTable = null;
        this.tableMenu = document.getElementById('table-menu');
        
        // Tạo button container để tránh ảnh hưởng đến layout table
        this.menuButtonContainer = document.createElement('div');
        this.menuButtonContainer.className = 'table-menu-button-container';
        document.body.appendChild(this.menuButtonContainer);
        
        // Theo dõi chế độ: 'edit' hoặc 'merge'
        this.mode = 'edit';
        
        // Khởi tạo event listeners
        this.initEvents();
    }
    
    /**
     * Khởi tạo các event listeners
     */
    initEvents() {
        // Đóng menu khi click vào bất kỳ đâu ngoài menu
        document.addEventListener('click', (e) => {
            // Nếu click không phải vào menu hoặc button menu
            if (!this.tableMenu.contains(e.target) && 
                !e.target.classList.contains('table-menu-btn') &&
                !e.target.classList.contains('table-mode-switch')) {
                this.tableMenu.style.display = 'none';
            }
            
            // Nếu click không phải vào table, bỏ focus tất cả các table
            if (!e.target.closest('table') && 
                !e.target.classList.contains('table-menu-btn') && 
                !e.target.classList.contains('table-mode-switch') && 
                !e.target.classList.contains('table-column-resizer')) {
                document.querySelectorAll('table.focused').forEach(table => {
                    table.classList.remove('focused');
                    this.updateMenuButtonVisibility(table, false);
                });
            }
        });
        
        // Theo dõi thay đổi kích thước cửa sổ để cập nhật vị trí menu button
        window.addEventListener('resize', () => {
            this.updateAllMenuButtonPositions();
        });
        
        // Theo dõi scroll để cập nhật vị trí menu button
        document.addEventListener('scroll', () => {
            this.updateAllMenuButtonPositions();
        }, true);
        
        // Theo dõi DOM để phát hiện khi table bị xóa
        const editorObserver = new MutationObserver((mutations) => {
            let needCleanup = false;
            
            mutations.forEach(mutation => {
                if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
                    // Kiểm tra nếu có table bị xóa
                    mutation.removedNodes.forEach(node => {
                        if (node.nodeName === 'TABLE' || (node.nodeType === Node.ELEMENT_NODE && node.querySelector('table'))) {
                            needCleanup = true;
                        }
                    });
                }
            });
            
            // Nếu có table bị xóa, thực hiện dọn dẹp
            if (needCleanup) {
                this.cleanupMenuButtons();
            }
        });
        
        editorObserver.observe(this.editor, { childList: true, subtree: true });
    }
    
    /**
     * Cập nhật vị trí tất cả các menu button
     */
    updateAllMenuButtonPositions() {
        document.querySelectorAll('table').forEach(table => {
            const button = this.getMenuButtonForTable(table);
            if (button && button.classList.contains('visible')) {
                this.updateMenuButtonPosition(table, button);
            }
        });
    }
    
    /**
     * Lấy hoặc tạo menu button cho table
     */
    getMenuButtonForTable(table) {
        let button = table.menuButton;
        let switchBtn = table.modeSwitchBtn;
        
        // Nếu chưa có button, tạo mới
        if (!button) {
            // Tạo container chứa switch và button menu
            const controlContainer = document.createElement('div');
            controlContainer.className = 'table-control-container';
            
            // Tạo switch button
            switchBtn = document.createElement('div');
            switchBtn.className = 'table-mode-switch';
            switchBtn.innerHTML = '<i class="fas fa-edit"></i>';
            switchBtn.title = 'Chế độ chỉnh sửa';
            switchBtn.dataset.mode = 'edit';
            
            // Tạo menu button
            button = document.createElement('div');
            button.className = 'table-menu-btn';
            button.innerHTML = '⋮';
            button.style.display = 'none'; // Ẩn lúc đầu
            
            // Thêm vào container
            controlContainer.appendChild(switchBtn);
            controlContainer.appendChild(button);
            this.menuButtonContainer.appendChild(controlContainer);
            
            // Lưu tham chiếu 
            table.menuButton = button;
            table.modeSwitchBtn = switchBtn;
            table.controlContainer = controlContainer;
            
            // Thiết lập sự kiện click cho switch button
            switchBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Chuyển đổi mode
                if (switchBtn.dataset.mode === 'edit') {
                    switchBtn.dataset.mode = 'merge';
                    switchBtn.innerHTML = '<i class="fas fa-th-large"></i>';
                    switchBtn.title = 'Chế độ gộp ô';
                    table.classList.add('merge-mode');
                    table.classList.remove('edit-mode');
                    this.mode = 'merge';
                } else {
                    switchBtn.dataset.mode = 'edit';
                    switchBtn.innerHTML = '<i class="fas fa-edit"></i>';
                    switchBtn.title = 'Chế độ chỉnh sửa';
                    table.classList.add('edit-mode');
                    table.classList.remove('merge-mode');
                    this.mode = 'edit';
                }
                
                // Thông báo sự thay đổi mode
                const event = new CustomEvent('table-mode-change', {
                    detail: { table: table, mode: this.mode }
                });
                document.dispatchEvent(event);
            });
            
            // Thiết lập sự kiện click cho button
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Hiển thị menu tại vị trí button
                const rect = button.getBoundingClientRect();
                this.tableMenu.style.top = `${rect.bottom + window.scrollY}px`;
                this.tableMenu.style.left = `${rect.left + window.scrollX}px`;
                this.tableMenu.style.display = 'block';
                
                // Lưu table hiện tại
                this.currentTable = table;
                
                // Thêm class focused vào table
                document.querySelectorAll('table.focused').forEach(t => {
                    if (t !== table) {
                        t.classList.remove('focused');
                    }
                });
                table.classList.add('focused');
            });
        }
        
        return button;
    }
    
    /**
     * Cập nhật vị trí của menu button theo table
     */
    updateMenuButtonPosition(table, button) {
        if (!table || !button) return;
        
        const tableRect = table.getBoundingClientRect();
        const container = table.controlContainer;
        
        if (!container) return;
        
        // Đặt ở vị trí phía trên table, canh phải
        container.style.position = 'absolute';
        container.style.top = `${tableRect.top + window.scrollY - 30}px`; // 30px ở trên table
        container.style.left = `${tableRect.right + window.scrollX - container.offsetWidth}px`; // Canh phải với table
    }
    
    /**
     * Cập nhật hiển thị button menu dựa trên trạng thái focus
     */
    updateMenuButtonVisibility(table, isFocused) {
        const button = this.getMenuButtonForTable(table);
        const container = table.controlContainer;
        
        if (button && container) {
            if (isFocused) {
                container.style.display = 'flex';
                button.style.display = 'block';
                button.classList.add('visible');
                table.modeSwitchBtn.style.display = 'block';
                this.updateMenuButtonPosition(table, button);
            } else {
                container.style.display = 'none';
                button.style.display = 'none';
                button.classList.remove('visible');
                table.modeSwitchBtn.style.display = 'none';
            }
        }
    }
    
    /**
     * Thiết lập table listeners
     */
    setupTableListeners(table) {
        // Lấy hoặc tạo menu button cho table
        const menuButton = this.getMenuButtonForTable(table);
        
        // Đặt mặc định là edit mode
        table.classList.add('edit-mode');
        
        // Xử lý sự kiện focus vào table
        table.addEventListener('mousedown', (e) => {
            // Không xử lý sự kiện khi đang resize column
            if (e.target.dataset && e.target.dataset.canResize) {
                return;
            }
            
            // Để sự kiện mousedown tiếp tục truyền đi bình thường
            // để TableResizeHandler có thể bắt và xử lý nếu cần
        });
        
        // Xử lý click vào table để hiển thị menu button
        table.addEventListener('click', (e) => {
            // Bỏ qua nếu đang trong quá trình resize
            if (e.target.dataset && e.target.dataset.canResize) {
                return;
            }
            
            // Bỏ focus các table khác
            document.querySelectorAll('table.focused').forEach(t => {
                if (t !== table) {
                    t.classList.remove('focused');
                    this.updateMenuButtonVisibility(t, false);
                }
            });
            
            // Focus vào table hiện tại
            table.classList.add('focused');
            this.currentTable = table;
            
            // Hiển thị button menu
            this.updateMenuButtonVisibility(table, true);
        });
    }
    
    /**
     * Theo dõi tables mới thêm vào editor
     */
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
    }
    
    /**
     * Khởi tạo và thiết lập cho table cụ thể
     */
    applyToTable(table) {
        this.setupTableListeners(table);
        
        // Nếu table đã focus, hiển thị button ngay
        if (table.classList.contains('focused')) {
            this.updateMenuButtonVisibility(table, true);
        }
    }
    
    /**
     * Lấy table hiện tại đang được focus
     */
    getCurrentTable() {
        return this.currentTable;
    }
    
    /**
     * Xóa button menu cho table
     */
    removeMenuButtonForTable(table) {
        if (table && table.menuButton) {
            // Xóa button khỏi DOM
            table.menuButton.remove();
            
            // Xóa tham chiếu
            table.menuButton = null;
            
            // Nếu đây là table hiện tại, cập nhật currentTable
            if (this.currentTable === table) {
                this.currentTable = null;
            }
        }
    }
    
    /**
     * Xóa tất cả button menu không còn được tham chiếu từ table nào
     * Gọi hàm này định kỳ để dọn dẹp
     */
    cleanupOrphanedMenuButtons() {
        // Lấy tất cả button trong container
        const buttons = this.menuButtonContainer.querySelectorAll('.table-menu-btn');
        
        // Lấy tất cả table trong editor
        const tables = this.editor.querySelectorAll('table');
        
        // Tạo mảng chứa tất cả menuButton của các table
        const tableButtons = [];
        tables.forEach(table => {
            if (table.menuButton) {
                tableButtons.push(table.menuButton);
            }
        });
        
        // Xóa những button không thuộc về table nào
        buttons.forEach(button => {
            if (!tableButtons.includes(button)) {
                button.remove();
            }
        });
    }
    
    /**
     * Kết hợp phương thức xóa button và cleanup
     */
    cleanupMenuButtons() {
        this.cleanupOrphanedMenuButtons();
    }
}

// Export class
window.TableMenuHandler = TableMenuHandler; 