/**
 * TableMenuHandler - Xử lý menu của table trong rich text editor
 */
export class TableMenuHandler {
    editor: HTMLElement;
    tableMenu: HTMLElement | null;
    currentTable: HTMLTableElement | null;

    constructor(editor: HTMLElement) {
        this.editor = editor;
        this.tableMenu = document.getElementById('table-menu');
        this.currentTable = null;

        // Khởi tạo menu
        this.initializeTableMenu();
        this.observeTablesInEditor();
    }

    initializeTableMenu() {
        if (!this.tableMenu) return;

        // Xóa nội dung cũ nếu có
        this.tableMenu.innerHTML = '';

        // Tạo các mục menu
        const menuItems = [
            { text: 'Chèn hàng phía trên', action: 'insert-row-above', icon: 'arrow-up' },
            { text: 'Chèn hàng phía dưới', action: 'insert-row-below', icon: 'arrow-down' },
            { text: 'Xóa hàng', action: 'delete-row', icon: 'trash-alt' },
            { divider: true },
            { text: 'Chèn cột bên trái', action: 'insert-column-left', icon: 'arrow-left' },
            { text: 'Chèn cột bên phải', action: 'insert-column-right', icon: 'arrow-right' },
            { text: 'Xóa cột', action: 'delete-column', icon: 'trash-alt' },
            { divider: true },
            { text: 'Gộp ô đã chọn', action: 'merge-cells', icon: 'object-group' },
            { text: 'Tách ô', action: 'unmerge-cells', icon: 'object-ungroup' },
            { divider: true },
            { text: 'Xóa bảng', action: 'delete-table', icon: 'trash' }
        ];

        // Tạo dropdown menu
        const dropdownMenu = document.createElement('div');
        dropdownMenu.className = 'dropdown-menu';

        // Thêm các mục vào menu
        menuItems.forEach(item => {
            if (item.divider) {
                const divider = document.createElement('div');
                divider.className = 'dropdown-divider';
                dropdownMenu.appendChild(divider);
            } else {
                const menuItem = document.createElement('a');
                menuItem.className = 'dropdown-item';
                menuItem.href = '#';
                menuItem.dataset.tableAction = item.action;
                
                const icon = document.createElement('i');
                icon.className = `fas fa-${item.icon} mr-2`;
                menuItem.appendChild(icon);
                
                const text = document.createTextNode(item.text);
                menuItem.appendChild(text);
                
                dropdownMenu.appendChild(menuItem);
            }
        });

        // Thêm dropdown menu vào table menu
        this.tableMenu.appendChild(dropdownMenu);
    }

    observeTablesInEditor() {
        // Tìm tất cả bảng hiện có
        this.editor.querySelectorAll('table').forEach(table => {
            this.addMenuButtonToTable(table);
        });

        // Theo dõi những bảng mới thêm vào
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeName === 'TABLE') {
                            this.addMenuButtonToTable(node as HTMLTableElement);
                        } else if (node.nodeType === Node.ELEMENT_NODE) {
                            const tables = (node as Element).querySelectorAll('table');
                            tables.forEach(table => this.addMenuButtonToTable(table));
                        }
                    });
                }
            });
        });

        observer.observe(this.editor, { childList: true, subtree: true });
    }

    addMenuButtonToTable(table: HTMLTableElement) {
        // Kiểm tra xem table có trong container không
        const container = table.closest('.table-container');
        if (!container) return;

        // Kiểm tra xem đã có button chưa
        let menuButton = container.querySelector('.table-menu-btn');
        if (!menuButton) {
            // Tạo menu button
            menuButton = document.createElement('button');
            menuButton.className = 'table-menu-btn';
            menuButton.title = 'Menu bảng';
            menuButton.innerHTML = '<i class="fas fa-ellipsis-v"></i>';
            
            // Thêm button vào sau table trong container
            container.insertBefore(menuButton, table.nextSibling);
            
            // Thêm sự kiện click
            menuButton.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Toggle menu
                this.toggleMenu(table, menuButton as HTMLElement);
            });
        }

        // Thêm button chuyển mode (edit/merge)
        let switchModeButton = container.querySelector('.table-switch-mode-btn');
        if (!switchModeButton) {
            switchModeButton = document.createElement('button');
            switchModeButton.className = 'table-switch-mode-btn';
            switchModeButton.title = 'Chuyển chế độ';
            
            // Tạo biểu tượng cho từng mode
            const editIndicator = document.createElement('span');
            editIndicator.className = 'edit-mode-indicator';
            const mergeIndicator = document.createElement('span');
            mergeIndicator.className = 'merge-mode-indicator';
            
            // Thiết lập nội dung button
            switchModeButton.innerHTML = 'Edit';
            switchModeButton.appendChild(editIndicator);
            
            // Thêm button vào sau menu button
            container.insertBefore(switchModeButton, menuButton.nextSibling);
            
            // Thêm sự kiện click
            switchModeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Toggle mode
                const currentMode = table.dataset.mode || 'edit';
                const newMode = currentMode === 'edit' ? 'merge' : 'edit';
                
                // Cập nhật mode
                table.dataset.mode = newMode;
                
                // Cập nhật giao diện button
                if (newMode === 'edit') {
                    switchModeButton.innerHTML = 'Edit';
                    switchModeButton.appendChild(editIndicator);
                } else {
                    switchModeButton.innerHTML = 'Merge';
                    switchModeButton.appendChild(mergeIndicator);
                }
                
                // Thông báo sự kiện thay đổi mode
                const event = new CustomEvent('table-mode-change', {
                    detail: {
                        table: table,
                        mode: newMode
                    }
                });
                document.dispatchEvent(event);
            });
        }
    }

    toggleMenu(table: HTMLTableElement, button: HTMLElement) {
        if (!this.tableMenu) return;

        // Lưu bảng hiện tại
        this.currentTable = table;

        // Vị trí của button
        const buttonRect = button.getBoundingClientRect();
        const editorRect = this.editor.getBoundingClientRect();

        // Xác định vị trí cho menu
        this.tableMenu.style.top = `${buttonRect.top - editorRect.top + this.editor.scrollTop}px`;
        this.tableMenu.style.left = `${buttonRect.right - editorRect.left + 5}px`;
        
        // Hiển thị menu
        this.tableMenu.style.display = 'block';
    }

    updateMenuButtonVisibility(table: HTMLTableElement, isVisible: boolean) {
        const container = table.closest('.table-container');
        if (!container) return;

        const menuButton = container.querySelector('.table-menu-btn');
        const switchModeButton = container.querySelector('.table-switch-mode-btn');

        if (menuButton) {
            (menuButton as HTMLElement).style.opacity = isVisible ? '1' : '0';
        }

        if (switchModeButton) {
            (switchModeButton as HTMLElement).style.opacity = isVisible ? '1' : '0';
        }
    }

    updateMenuButtonPosition(table: HTMLTableElement, button: HTMLElement) {
        if (!table || !button) return;

        const container = table.closest('.table-container');
        if (!container) return;
        
        const tableRect = table.getBoundingClientRect();
        const editorRect = this.editor.getBoundingClientRect();
        
        // Đặt button ở vị trí phía trên bên phải của bảng
        const controlContainer = button.closest('.table-control-container') as HTMLElement;
        if (controlContainer) {
            controlContainer.style.position = 'absolute';
            controlContainer.style.top = `${tableRect.top - 25}px`;
            controlContainer.style.left = `${tableRect.right - controlContainer.offsetWidth}px`;
        }
    }

    updateAllMenuButtonPositions() {
        this.editor.querySelectorAll('table').forEach(table => {
            const container = table.closest('.table-container');
            if (container) {
                const menuButton = container.querySelector('.table-menu-btn');
                const switchModeButton = container.querySelector('.table-switch-mode-btn');
                const controlContainer = container.querySelector('.table-control-container');
                
                if (menuButton && controlContainer) {
                    this.updateMenuButtonPosition(table, menuButton as HTMLElement);
                }
            }
        });
    }
}
