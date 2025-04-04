document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const editor = document.getElementById('editor');
    const boldBtn = document.getElementById('bold-btn');
    const italicBtn = document.getElementById('italic-btn');
    const underlineBtn = document.getElementById('underline-btn');
    const alignLeftBtn = document.getElementById('align-left-btn');
    const alignCenterBtn = document.getElementById('align-center-btn');
    const alignRightBtn = document.getElementById('align-right-btn');
    const alignJustifyBtn = document.getElementById('align-justify-btn');
    const insertTableBtn = document.getElementById('insert-table-btn');
    const insertImageBtn = document.getElementById('insert-image-btn');
    const tableDialog = document.getElementById('table-dialog');
    const tableRows = document.getElementById('table-rows');
    const tableCols = document.getElementById('table-cols');
    const insertTableConfirm = document.getElementById('insert-table-confirm');
    const insertTableCancel = document.getElementById('insert-table-cancel');
    const tableMenu = document.getElementById('table-menu');
    const imageMenu = document.getElementById('image-menu');
    const imageUpload = document.getElementById('image-upload');

    // Khởi tạo handler cho table và image
    const tableHandler = new TableHandler(editor);
    const imageHandler = new ImageHandler(editor);

    // Current state
    let currentTable = null;
    let currentTableCell = null;
    
    // Lưu trữ vị trí của cursor
    let savedRange = null;
    let lastFocusTime = 0;
    
    // Hàm lưu vị trí cursor hiện tại
    function saveCurrentCursorPosition() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (editor.contains(range.commonAncestorContainer)) {
                savedRange = range.cloneRange(); // Tạo bản sao để đảm bảo không bị thay đổi
                lastFocusTime = Date.now();
                console.log("Đã lưu vị trí cursor:", Date.now());
            }
        }
    }
    
    // Hàm khôi phục vị trí cursor đã lưu
    function restoreCursorPosition() {
        if (savedRange) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(savedRange);
            editor.focus();
            console.log("Đã khôi phục vị trí cursor:", Date.now());
        }
    }

    // Initialize editor
    editor.innerHTML = '<p>Bắt đầu nhập văn bản...</p>';
    editor.addEventListener('focus', () => {
        if (editor.innerHTML === '<p>Bắt đầu nhập văn bản...</p>') {
            editor.innerHTML = '<p><br></p>';
        }
    });
    
    // Lưu vị trí cursor khi focus vào editor
    editor.addEventListener('mouseup', saveCurrentCursorPosition);
    editor.addEventListener('keyup', saveCurrentCursorPosition);
    
    // Lưu vị trí cursor khi có thay đổi selection trong editor
    document.addEventListener('selectionchange', () => {
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && editor.contains(selection.anchorNode)) {
            savedRange = selection.getRangeAt(0).cloneRange();
            lastFocusTime = Date.now();
        }
    });

    // Text formatting buttons
    boldBtn.addEventListener('click', () => execCommand('bold'));
    italicBtn.addEventListener('click', () => execCommand('italic'));
    underlineBtn.addEventListener('click', () => execCommand('underline'));

    // Alignment buttons
    alignLeftBtn.addEventListener('click', () => {
        if (imageHandler.currentImage) {
            // Nếu có hình ảnh được chọn, áp dụng căn chỉnh cho hình ảnh
            imageHandler.alignImage(imageHandler.currentImage, 'left');
        } else {
            // Nếu không, áp dụng căn chỉnh cho văn bản
            execCommand('justifyLeft');
        }
    });
    
    alignCenterBtn.addEventListener('click', () => {
        if (imageHandler.currentImage) {
            // Nếu có hình ảnh được chọn, áp dụng căn chỉnh cho hình ảnh
            imageHandler.alignImage(imageHandler.currentImage, 'center');
        } else {
            // Nếu không, áp dụng căn chỉnh cho văn bản
            execCommand('justifyCenter');
        }
    });
    
    alignRightBtn.addEventListener('click', () => {
        if (imageHandler.currentImage) {
            // Nếu có hình ảnh được chọn, áp dụng căn chỉnh cho hình ảnh
            imageHandler.alignImage(imageHandler.currentImage, 'right');
        } else {
            // Nếu không, áp dụng căn chỉnh cho văn bản
            execCommand('justifyRight');
        }
    });
    
    alignJustifyBtn.addEventListener('click', () => execCommand('justifyFull'));

    // Insert table button
    insertTableBtn.addEventListener('mousedown', (e) => {
        // Ngăn chặn mất focus mặc định khi click vào button
        e.preventDefault();
        
        // Lưu vị trí cursor ngay lập tức
        saveCurrentCursorPosition();
        console.log("Button table clicked - cursor saved:", Date.now());
    });
    
    insertTableBtn.addEventListener('click', (e) => {
        // Ngăn chặn hành vi mặc định
        e.preventDefault();
        
        // Hiển thị dialog
        tableDialog.style.display = 'flex';
    });

    // Insert image button
    insertImageBtn.addEventListener('click', () => {
        imageUpload.click();
    });

    // Execute document commands
    function execCommand(command, value = null) {
        // Khôi phục vị trí trước khi thực hiện lệnh
        restoreCursorPosition();
        document.execCommand(command, false, value);
        editor.focus();
    }

    // Table dialog confirm
    insertTableConfirm.addEventListener('click', () => {
        const rows = parseInt(tableRows.value);
        const cols = parseInt(tableCols.value);
        const hasHeaderRow = document.getElementById('header-row').checked;
        const hasHeaderColumn = document.getElementById('header-column').checked;
        
        if (rows && cols) {
            // Đóng dialog
            tableDialog.style.display = 'none';
            
            // Đảm bảo kết quả sẽ được insert vào vị trí cursor đã lưu
            setTimeout(() => {
                console.log("Đang chuẩn bị chèn bảng, thời gian lưu cursor cuối:", lastFocusTime);
                // Khôi phục range đã lưu trước khi chèn bảng
                if (savedRange) {
                    try {
                        const selection = window.getSelection();
                        selection.removeAllRanges();
                        selection.addRange(savedRange);
                        editor.focus();
                    } catch (e) {
                        console.error("Lỗi khi khôi phục vị trí cursor:", e);
                    }
                } else {
                    console.warn("Không có vị trí cursor được lưu!");
                    editor.focus(); // Focus vào editor để đảm bảo bảng được chèn
                }
                
                // Chèn bảng vào editor tại vị trí cursor
                tableHandler.insertTable(rows, cols);
            }, 100);
        }
    });

    // Table dialog cancel
    insertTableCancel.addEventListener('click', () => {
        tableDialog.style.display = 'none';
        
        // Khôi phục vị trí cursor sau khi hủy
        setTimeout(() => {
            restoreCursorPosition();
        }, 10);
    });

    // Hide context menus when clicking elsewhere
    document.addEventListener('click', (e) => {
        if (!tableMenu.contains(e.target) && e.target.className !== 'table-menu-btn') {
            tableMenu.style.display = 'none';
        }
        
        if (!imageMenu.contains(e.target) && 
            !e.target.closest('.resizable-image') && 
            !e.target.closest('.image-menu-button-group')) {
            
            imageMenu.style.display = 'none';
            
            // Bỏ chọn tất cả hình ảnh và ẩn các menu button
            document.querySelectorAll('.selected-image').forEach(container => {
                container.classList.remove('selected-image');
                if (imageHandler && typeof imageHandler.updateMenuButtonVisibility === 'function') {
                    imageHandler.updateMenuButtonVisibility(container, false);
                }
            });
            
            // Reset currentImage
            if (imageHandler) {
                imageHandler.currentImage = null;
            }
        }
        
        if (!e.target.closest('table')) {
            document.querySelectorAll('table.focused').forEach(table => {
                table.classList.remove('focused');
            });
        }
    });

    // Prevent context menu on right-click
    editor.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // Global mouse events for drag and drop
    document.addEventListener('mousemove', (e) => {
        // Lưu ý: Không cần xử lý kéo thả hình ảnh ở đây vì đã được xử lý trong imageHandler
        // Giữ các phần xử lý kéo thả khác nếu cần
    });

    document.addEventListener('mouseup', () => {
        // Lưu ý: Không cần xử lý kéo thả hình ảnh ở đây vì đã được xử lý trong imageHandler
        // Giữ các phần xử lý kéo thả khác nếu cần
    });

    // Handle text flow around images - handled by imageHandler
    function handleTextFlow() {
        // Lưu ý: Chức năng này đã được chuyển vào imageHandler
        // Hàm này chỉ để tránh lỗi nếu có mã cũ gọi đến nó
        if (imageHandler && typeof imageHandler.handleTextFlow === 'function') {
            imageHandler.handleTextFlow();
        }
    }

    // Support for drag and drop file upload
    editor.addEventListener('dragover', (e) => {
        e.preventDefault();
        editor.classList.add('drag-over');
    });

    editor.addEventListener('dragleave', () => {
        editor.classList.remove('drag-over');
    });

    editor.addEventListener('drop', (e) => {
        e.preventDefault();
        editor.classList.remove('drag-over');
        
        if (e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                
                reader.onload = (event) => {
                    // Calculate position based on drop location
                    const selection = window.getSelection();
                    const range = document.createRange();
                    range.setStart(editor, 0);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    
                    imageHandler.insertImage(event.target.result);
                };
                
                reader.readAsDataURL(file);
            }
        }
    });

    // Lưu vị trí cursor khi click vào bất kỳ nút nào trên toolbar
    document.querySelectorAll('.toolbar button').forEach(button => {
        button.addEventListener('mousedown', (e) => {
            // Lưu vị trí cursor trước khi nhấn button
            saveCurrentCursorPosition();
        });
    });

    // Dọn dẹp các menu button khi nội dung editor thay đổi
    const editorObserver = new MutationObserver((mutations) => {
        // Dọn dẹp các menu button không còn sử dụng
        if (imageHandler && typeof imageHandler.cleanup === 'function') {
            setTimeout(() => imageHandler.cleanup(), 100);
        }
    });
    
    // Theo dõi thay đổi nội dung trong editor
    editorObserver.observe(editor, { 
        childList: true, 
        subtree: true,
        characterData: true 
    });
}); 