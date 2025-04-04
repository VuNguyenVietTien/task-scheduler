class ImageHandler {
    constructor(editor) {
        this.editor = editor;
        this.currentImage = null;
        this.isDragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.imageMenu = document.getElementById('image-menu');
        this.imageUpload = document.getElementById('image-upload');

        // Tạo container cho image menu buttons
        this.imageButtonContainer = document.createElement('div');
        this.imageButtonContainer.className = 'image-menu-button-container';
        document.body.appendChild(this.imageButtonContainer);
        
        // Chế độ căn chỉnh (auto hoặc manual)
        this.alignMode = 'auto'; // Mặc định là auto

        // Khởi tạo event listeners
        this.initEvents();
    }

    initEvents() {
        // Xử lý upload hình ảnh
        this.imageUpload.addEventListener('change', this.handleImageUpload.bind(this));

        // Xử lý các nút trong menu hình ảnh
        this.setupImageMenuHandlers();

        // Xử lý sự kiện kéo thả
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));

        // Xử lý drag & drop
        this.setupDragDropListeners();

        // Thêm event để hủy kéo thả nếu rời khỏi editor
        this.editor.addEventListener('mouseleave', () => {
            if (this.isDragging) {
                this.cancelDrag();
            }
        });
        
        // Thêm event cho trường hợp mouseup xảy ra bên ngoài editor
        document.addEventListener('mouseup', (e) => {
            if (this.isDragging && !this.editor.contains(e.target)) {
                this.cancelDrag();
            }
        });
    }

    handleImageUpload(e) {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            
            reader.onload = (event) => {
                this.insertImage(event.target.result);
            };
            
            reader.readAsDataURL(file);
        }
    }

    insertImage(src) {
        // Đảm bảo editor được focus trước khi chèn ảnh
        this.editor.focus();
        
        let range;
        
        // Kiểm tra nếu có selection trong editor
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && this.editor.contains(selection.anchorNode)) {
            range = selection.getRangeAt(0);
        } else {
            // Nếu không có selection trong editor, tạo range ở cuối editor
            range = document.createRange();
            
            // Tìm vị trí phù hợp để chèn
            if (this.editor.lastChild) {
                // Chèn vào cuối editor
                range.setStartAfter(this.editor.lastChild);
                range.setEndAfter(this.editor.lastChild);
            } else {
                // Editor trống, tạo paragraph mới
                const paragraph = document.createElement('p');
                paragraph.innerHTML = '<br>';
                this.editor.appendChild(paragraph);
                range.setStart(paragraph, 0);
                range.setEnd(paragraph, 0);
            }
            
            // Áp dụng range mới
            selection.removeAllRanges();
            selection.addRange(range);
        }
        
        // Kiểm tra nếu đang ở trong paragraph hoặc không
        let paragraph = range.commonAncestorContainer;
        if (paragraph.nodeType !== Node.ELEMENT_NODE || paragraph.tagName !== 'P') {
            paragraph = paragraph.parentNode;
            if (paragraph.nodeType !== Node.ELEMENT_NODE || paragraph.tagName !== 'P') {
                // Nếu không phải trong paragraph, tạo một cái mới
                paragraph = document.createElement('p');
                range.deleteContents();
                range.insertNode(paragraph);
            }
        }
        
        // Tạo container cho hình ảnh có thể resize
        const imageContainer = document.createElement('div');
        imageContainer.className = 'resizable-image align-center'; // Mặc định canh giữa
        
        // Tạo phần tử hình ảnh
        const img = document.createElement('img');
        img.src = src;
        img.style.width = '300px'; // Kích thước mặc định
        imageContainer.appendChild(img);
        
        // Thêm các handle resize
        const handlePositions = ['nw', 'ne', 'sw', 'se'];
        handlePositions.forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `resize-handle resize-handle-${pos}`;
            imageContainer.appendChild(handle);
        });
        
        // Xóa nội dung range hiện tại
        range.deleteContents();
        
        // Đảm bảo hình ảnh có paragraph container
        const imgParagraph = document.createElement('p');
        imgParagraph.style.textAlign = 'center';
        imgParagraph.appendChild(imageContainer);
        
        // Chèn paragraph chứa hình ảnh
        range.insertNode(imgParagraph);
        
        // Di chuyển con trỏ sau hình ảnh
        range.setStartAfter(imgParagraph);
        range.setEndAfter(imgParagraph);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Thiết lập sự kiện cho hình ảnh
        this.setupImageListeners(imageContainer);
        
        // Chọn hình ảnh và hiện menu button
        imageContainer.classList.add('selected-image');
        this.currentImage = imageContainer;
        this.createOrUpdateMenuButton(imageContainer);
    }

    setupImageListeners(imageContainer) {
        const img = imageContainer.querySelector('img');
        const resizeHandles = imageContainer.querySelectorAll('.resize-handle');
        
        // Chọn hình ảnh
        imageContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault(); // Ngăn chặn sự kiện focus vào text node gần đó
            
            // Bỏ chọn các hình ảnh khác
            document.querySelectorAll('.selected-image').forEach(container => {
                if (container !== imageContainer) {
                    container.classList.remove('selected-image');
                    this.updateMenuButtonVisibility(container, false);
                }
            });
            
            imageContainer.classList.add('selected-image');
            this.currentImage = imageContainer;
            
            // Hiển thị menu button
            this.createOrUpdateMenuButton(imageContainer);
        });
        
        // Kéo hình ảnh
        imageContainer.addEventListener('mousedown', (e) => {
            if (e.target === img || (e.target === imageContainer && !e.target.classList.contains('resize-handle'))) {
                // Ngăn chặn các hành vi mặc định và bubble
                e.preventDefault();
                e.stopPropagation();
                
                // Lưu vị trí của editor trong DOM để sử dụng sau
                this.editorScrollTop = this.editor.scrollTop;
                
                // Thêm class drag-ready để thay đổi cursor
                imageContainer.classList.add('drag-ready');
                
                // Lấy chính xác vị trí của ảnh và editor
                const rect = imageContainer.getBoundingClientRect();
                const editorRect = this.editor.getBoundingClientRect();
                
                // Xác định chính xác vị trí click so với góc trên bên trái của ảnh
                this.dragOffsetX = e.clientX - rect.left;
                this.dragOffsetY = e.clientY - rect.top;
                
                // Lưu offset tương đối với editor
                this.editorOffsetX = rect.left - editorRect.left;
                this.editorOffsetY = rect.top - editorRect.top;
                
                // Đánh dấu bắt đầu kéo
                this.isDragging = true;
                
                // Lưu vị trí ban đầu (tương đối với editor) để reset nếu cần
                this.initialPosition = {
                    parent: imageContainer.parentNode,
                    nextSibling: imageContainer.nextSibling,
                    x: rect.left - editorRect.left,
                    y: rect.top - editorRect.top
                };
                
                // Bỏ chọn các hình ảnh khác và chọn hình ảnh này
                document.querySelectorAll('.selected-image').forEach(container => {
                    if (container !== imageContainer) {
                        container.classList.remove('selected-image');
                        this.updateMenuButtonVisibility(container, false);
                    }
                });
                
                imageContainer.classList.add('selected-image');
                this.currentImage = imageContainer;
                
                // Cập nhật menu button
                this.createOrUpdateMenuButton(imageContainer);
                
                // TẠO BẢN SAO "GHOST" ĐỂ KÉO THẢ
                // Thay vì di chuyển trực tiếp ảnh, tạo một bản sao ghost để kéo
                const ghostContainer = document.createElement('div');
                ghostContainer.className = 'ghost-image';
                ghostContainer.style.position = 'absolute';
                ghostContainer.style.zIndex = '9999';
                ghostContainer.style.pointerEvents = 'none';
                ghostContainer.style.opacity = '0.8';
                ghostContainer.style.transform = 'scale(1.02)';
                ghostContainer.style.left = `${this.initialPosition.x}px`;
                ghostContainer.style.top = `${this.initialPosition.y}px`;
                ghostContainer.style.width = `${imageContainer.offsetWidth}px`;
                ghostContainer.style.height = `${imageContainer.offsetHeight}px`;
                
                // Tạo bản sao của hình ảnh
                const ghostImg = document.createElement('img');
                ghostImg.src = img.src;
                ghostImg.style.width = '100%';
                ghostImg.style.height = 'auto';
                ghostContainer.appendChild(ghostImg);
                
                // Thêm vào editor
                this.editor.appendChild(ghostContainer);
                this.ghostImage = ghostContainer;
                
                // Ẩn ảnh gốc nhưng vẫn giữ vị trí
                if (this.alignMode === 'auto') {
                    // Trong mode auto, giữ ảnh gốc ở vị trí ban đầu
                    imageContainer.style.opacity = '0.3';
                } else {
                    // Trong mode manual, di chuyển ảnh gốc thành tuyệt đối
                    // và kéo nó theo ghost
                    imageContainer.style.position = 'absolute';
                    imageContainer.style.left = `${this.initialPosition.x}px`;
                    imageContainer.style.top = `${this.initialPosition.y}px`;
                    imageContainer.style.zIndex = '1000';
                    imageContainer.style.opacity = '0'; // Ẩn hoàn toàn
                    imageContainer.classList.add('dragging');
                }
            }
        });
        
        // Sự kiện resize hình ảnh
        resizeHandles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                const startX = e.clientX;
                const startY = e.clientY;
                const startWidth = img.offsetWidth;
                const startHeight = img.offsetHeight;
                const aspectRatio = startWidth / startHeight;
                const handlePosition = handle.className.match(/resize-handle-(nw|ne|sw|se)/)[1];
                
                const onMouseMove = (moveEvent) => {
                    moveEvent.preventDefault();
                    
                    let newWidth, newHeight;
                    
                    if (handlePosition === 'se' || handlePosition === 'ne') {
                        // Resize từ bên phải
                        newWidth = startWidth + (moveEvent.clientX - startX);
                    } else {
                        // Resize từ bên trái
                        newWidth = startWidth - (moveEvent.clientX - startX);
                    }
                    
                    if (handlePosition === 'se' || handlePosition === 'sw') {
                        // Resize từ bên dưới
                        newHeight = startHeight + (moveEvent.clientY - startY);
                    } else {
                        // Resize từ bên trên
                        newHeight = startHeight - (moveEvent.clientY - startY);
                    }
                    
                    // Giữ tỉ lệ khi nhấn phím Shift
                    if (moveEvent.shiftKey) {
                        if (Math.abs(moveEvent.clientX - startX) > Math.abs(moveEvent.clientY - startY)) {
                            newHeight = newWidth / aspectRatio;
                        } else {
                            newWidth = newHeight * aspectRatio;
                        }
                    }
                    
                    // Áp dụng kích thước mới với kiểm tra kích thước tối thiểu
                    if (newWidth >= 30 && newHeight >= 30) {
                        img.style.width = `${newWidth}px`;
                        img.style.height = `${newHeight}px`;
                    }
                    
                    // Cập nhật vị trí menu button
                    this.updateMenuButtonPosition(imageContainer);
                };
                
                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };
                
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
    }

    // Tạo hoặc cập nhật menu button cho hình ảnh
    createOrUpdateMenuButton(imageContainer) {
        let buttonGroup = imageContainer.menuButtonGroup;
        
        // Nếu chưa có button group, tạo mới
        if (!buttonGroup) {
            buttonGroup = document.createElement('div');
            buttonGroup.className = 'image-menu-button-group';
            
            // Tạo nút switch mode
            const switchModeBtn = document.createElement('button');
            switchModeBtn.className = 'image-mode-switch';
            switchModeBtn.innerHTML = '<i class="fas fa-magic"></i>';
            switchModeBtn.title = 'Chế độ tự động căn chỉnh';
            switchModeBtn.dataset.mode = this.alignMode;
            
            // Cập nhật style của nút dựa vào mode hiện tại
            this.updateSwitchButtonStyle(switchModeBtn);
            
            // Tạo các nút căn chỉnh
            const alignLeftBtn = document.createElement('button');
            alignLeftBtn.className = 'image-align-btn align-left-btn';
            alignLeftBtn.innerHTML = '<i class="fas fa-align-left"></i>';
            alignLeftBtn.title = 'Canh trái';
            
            const alignCenterBtn = document.createElement('button');
            alignCenterBtn.className = 'image-align-btn align-center-btn';
            alignCenterBtn.innerHTML = '<i class="fas fa-align-center"></i>';
            alignCenterBtn.title = 'Canh giữa';
            
            const alignRightBtn = document.createElement('button');
            alignRightBtn.className = 'image-align-btn align-right-btn';
            alignRightBtn.innerHTML = '<i class="fas fa-align-right"></i>';
            alignRightBtn.title = 'Canh phải';
            
            // Tạo nút xóa ảnh thay cho menu button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'image-delete-btn';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.title = 'Xóa hình ảnh';
            
            // Thêm vào button group
            buttonGroup.appendChild(switchModeBtn);
            buttonGroup.appendChild(alignLeftBtn);
            buttonGroup.appendChild(alignCenterBtn);
            buttonGroup.appendChild(alignRightBtn);
            buttonGroup.appendChild(deleteBtn);
            
            // Thêm vào container
            this.imageButtonContainer.appendChild(buttonGroup);
            
            // Lưu tham chiếu
            imageContainer.menuButtonGroup = buttonGroup;
            buttonGroup.alignLeftBtn = alignLeftBtn;
            buttonGroup.alignCenterBtn = alignCenterBtn;
            buttonGroup.alignRightBtn = alignRightBtn;
            buttonGroup.switchModeBtn = switchModeBtn;
            buttonGroup.deleteBtn = deleteBtn;
            
            // Thêm sự kiện cho nút switch mode
            switchModeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Chuyển đổi mode
                const newMode = this.alignMode === 'auto' ? 'manual' : 'auto';
                
                // Cập nhật tooltip
                if (newMode === 'manual') {
                    switchModeBtn.title = 'Chế độ thủ công (kéo thả tự do)';
                } else {
                    switchModeBtn.title = 'Chế độ tự động căn chỉnh';
                }
                
                // Đặt chế độ mới
                this.setAlignMode(newMode);
            });
            
            // Thêm sự kiện cho các nút căn chỉnh
            alignLeftBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.alignImage(imageContainer, 'left');
            });
            
            alignCenterBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.alignImage(imageContainer, 'center');
            });
            
            alignRightBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.alignImage(imageContainer, 'right');
            });
            
            // Thêm sự kiện cho nút xóa ảnh
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Xóa menu button
                if (imageContainer.menuButtonGroup) {
                    imageContainer.menuButtonGroup.remove();
                }
                
                // Xóa ảnh
                imageContainer.remove();
                this.currentImage = null;
            });
        } else {
            // Cập nhật trạng thái của nút switch mode nếu button group đã tồn tại
            const switchModeBtn = buttonGroup.switchModeBtn;
            if (switchModeBtn) {
                switchModeBtn.dataset.mode = this.alignMode;
                this.updateSwitchButtonStyle(switchModeBtn);
            }
        }
        
        // Cập nhật trạng thái của các nút căn chỉnh
        this.updateAlignButtonsState(buttonGroup);
        
        // Hiển thị button group và cập nhật vị trí
        this.updateMenuButtonVisibility(imageContainer, true);
    }
    
    // Cập nhật style của nút switch mode
    updateSwitchButtonStyle(switchBtn) {
        if (this.alignMode === 'auto') {
            switchBtn.innerHTML = '<i class="fas fa-magic"></i>';
            switchBtn.classList.add('mode-auto');
            switchBtn.classList.remove('mode-manual');
        } else {
            switchBtn.innerHTML = '<i class="fas fa-arrows-alt"></i>';
            switchBtn.classList.add('mode-manual');
            switchBtn.classList.remove('mode-auto');
        }
    }
    
    // Cập nhật trạng thái của các nút căn chỉnh
    updateAlignButtonsState(buttonGroup) {
        if (buttonGroup) {
            const isDisabled = this.alignMode === 'manual';
            
            // Cập nhật trạng thái disabled
            buttonGroup.alignLeftBtn.disabled = isDisabled;
            buttonGroup.alignCenterBtn.disabled = isDisabled;
            buttonGroup.alignRightBtn.disabled = isDisabled;
            
            // Cập nhật style
            if (isDisabled) {
                buttonGroup.alignLeftBtn.classList.add('disabled');
                buttonGroup.alignCenterBtn.classList.add('disabled');
                buttonGroup.alignRightBtn.classList.add('disabled');
            } else {
                buttonGroup.alignLeftBtn.classList.remove('disabled');
                buttonGroup.alignCenterBtn.classList.remove('disabled');
                buttonGroup.alignRightBtn.classList.remove('disabled');
            }
        }
    }
    
    // Cập nhật vị trí menu button
    updateMenuButtonPosition(imageContainer) {
        if (!imageContainer || !imageContainer.menuButtonGroup) return;
        
        const rect = imageContainer.getBoundingClientRect();
        const buttonGroup = imageContainer.menuButtonGroup;
        
        buttonGroup.style.position = 'absolute';
        buttonGroup.style.top = `${rect.top + window.scrollY - 40}px`; // Đặt ở trên ảnh
        buttonGroup.style.left = `${rect.right + window.scrollX - buttonGroup.offsetWidth - 10}px`; // Canh phải
    }
    
    // Cập nhật hiển thị menu button
    updateMenuButtonVisibility(imageContainer, isVisible) {
        if (!imageContainer || !imageContainer.menuButtonGroup) return;
        
        const buttonGroup = imageContainer.menuButtonGroup;
        
        if (isVisible) {
            buttonGroup.style.display = 'flex';
            this.updateMenuButtonPosition(imageContainer);
        } else {
            buttonGroup.style.display = 'none';
        }
    }
    
    // Căn chỉnh hình ảnh
    alignImage(imageContainer, alignment) {
        if (!imageContainer) return;
        
        // Chỉ áp dụng căn chỉnh khi ở chế độ auto
        if (this.alignMode === 'manual') return;
        
        // Xóa tất cả các lớp căn chỉnh
        imageContainer.classList.remove('align-left', 'align-center', 'align-right');
        
        // Xóa vị trí thủ công
        imageContainer.style.position = '';
        imageContainer.style.left = '';
        imageContainer.style.top = '';
        imageContainer.style.zIndex = '';
        delete imageContainer.dataset.positionMode;
        
        // Đưa hình ảnh về paragraph nếu đang ở trong container vị trí thủ công
        const parent = imageContainer.parentNode;
        if (parent && parent.style.position === 'relative' && parent.style.height === '0px') {
            const grandparent = parent.parentNode;
            const paragraph = document.createElement('p');
            paragraph.style.textAlign = alignment;
            grandparent.insertBefore(paragraph, parent);
            paragraph.appendChild(imageContainer);
            parent.remove();
        }
        
        // Áp dụng lớp căn chỉnh mới
        imageContainer.classList.add(`align-${alignment}`);
        
        // Cập nhật text-align cho paragraph cha
        const parentP = imageContainer.closest('p');
        if (parentP) {
            parentP.style.textAlign = alignment;
        }
    }

    handleMouseMove(e) {
        if (this.isDragging && this.currentImage && this.ghostImage) {
            e.preventDefault();
            
            // Tính toán vị trí mới trực tiếp từ vị trí con trỏ
            const editorRect = this.editor.getBoundingClientRect();
            
            // Kiểm tra nếu editor đã scroll để điều chỉnh
            const scrollDiff = this.editor.scrollTop - this.editorScrollTop;
            
            // Tính toán vị trí mới dựa trên vị trí chuột và offset ban đầu
            let left = e.clientX - editorRect.left - this.dragOffsetX;
            let top = e.clientY - editorRect.top - this.dragOffsetY + scrollDiff;
            
            // Giới hạn đảm bảo không vượt ra ngoài editor
            const minLeft = 0;
            const minTop = 0; // Cho phép kéo lên đến đỉnh của editor
            const maxLeft = editorRect.width - this.ghostImage.offsetWidth;
            const maxTop = Math.max(this.editor.scrollHeight - this.ghostImage.offsetHeight, 0);
            
            left = Math.max(minLeft, Math.min(left, maxLeft));
            top = Math.max(minTop, Math.min(top, maxTop));
            
            // Áp dụng vị trí mới cho ghost image
            this.ghostImage.style.left = `${left}px`;
            this.ghostImage.style.top = `${top}px`;
            
            // Tìm vị trí mục tiêu để chèn ảnh
            const targetPosition = this.findDropTarget(e.clientX, e.clientY);
            
            // Hiển thị chỉ báo vị trí thả
            this.showDropIndicator(targetPosition);
            
            // Cập nhật vị trí menu button
            this.updateMenuButtonPosition(this.currentImage);
        }
    }

    handleMouseUp() {
        if (this.isDragging && this.currentImage && this.ghostImage) {
            // Lấy vị trí của ghost image
            const ghostRect = this.ghostImage.getBoundingClientRect();
            const editorRect = this.editor.getBoundingClientRect();
            
            // Tính toán vị trí tương đối của ghost image so với editor
            const relativeLeft = ghostRect.left - editorRect.left;
            const relativeTop = ghostRect.top - editorRect.top + this.editor.scrollTop - this.editorScrollTop;
            
            // Xóa ghost image
            this.ghostImage.remove();
            this.ghostImage = null;
            
            // Khôi phục hiệu ứng kéo trên ảnh gốc
            this.currentImage.style.opacity = '1';
            this.currentImage.style.transform = '';
            this.currentImage.classList.remove('drag-ready');
            this.currentImage.classList.remove('dragging');
            
            // Xóa chỉ báo vị trí thả
            this.hideDropIndicator();
            
            if (this.alignMode === 'auto') {
                // Tìm vị trí thả
                const dropTarget = this.findDropTarget(
                    ghostRect.left + this.ghostImage.offsetWidth / 2,
                    ghostRect.top + this.ghostImage.offsetHeight / 2
                );
                
                // Di chuyển ảnh đến vị trí thả
                this.moveImageToDropTarget(this.currentImage, dropTarget);
                
                // Đặt lại luồng văn bản (tự động căn chỉnh)
                this.handleTextFlow();
            } else {
                // Chế độ manual - giữ nguyên vị trí tuyệt đối
                // Tìm hoặc tạo container cho vị trí thủ công
                let container = this.currentImage.closest('.manual-position-container');
                if (!container) {
                    container = document.createElement('div');
                    container.className = 'manual-position-container';
                    container.style.position = 'relative';  // Đảm bảo container có vị trí relative
                    container.style.width = '100%';
                    container.style.height = '0';
                    container.style.overflow = 'visible'; // Cho phép nội dung tràn ra ngoài
                    container.style.zIndex = '2';  // Z-index cao hơn text
                    
                    // Xác định vị trí chèn dựa trên vị trí thả hiện tại
                    const insertPosition = this.findDropTarget(
                        ghostRect.left,
                        ghostRect.top
                    );
                    
                    // Chèn container vào vị trí thả
                    if (insertPosition.node.nodeType === Node.ELEMENT_NODE) {
                        if (insertPosition.before) {
                            insertPosition.node.parentNode.insertBefore(container, insertPosition.node);
                        } else if (insertPosition.node.nextSibling) {
                            insertPosition.node.parentNode.insertBefore(container, insertPosition.node.nextSibling);
                        } else {
                            insertPosition.node.parentNode.appendChild(container);
                        }
                    }
                    
                    // Dọn dẹp paragraph cha hiện tại nếu cần
                    const currentParentP = this.currentImage.closest('p');
                    if (currentParentP && currentParentP.childNodes.length <= 1) {
                        // Nếu paragraph chỉ chứa ảnh này, xóa nó sau khi di chuyển ảnh
                        const oldParent = currentParentP;
                        container.appendChild(this.currentImage);
                        if (oldParent.childNodes.length === 0) {
                            oldParent.remove();
                        }
                    } else {
                        container.appendChild(this.currentImage);
                    }
                }
                
                // Giữ nguyên vị trí tuyệt đối hiện tại của ảnh nhưng cập nhật vị trí dựa trên ghost image
                this.currentImage.style.position = 'absolute';
                this.currentImage.style.left = relativeLeft + 'px';
                this.currentImage.style.top = relativeTop + 'px';
                this.currentImage.style.zIndex = '3';  // Z-index cao hơn text
                
                // Đánh dấu là manual positioned
                this.currentImage.dataset.positionMode = 'manual';
            }
            
            // Cập nhật vị trí menu button
            this.updateMenuButtonPosition(this.currentImage);
            
            // Đánh dấu đã dừng kéo
            this.isDragging = false;
        }
    }

    // Tìm vị trí thả phù hợp dựa trên tọa độ chuột
    findDropTarget(x, y) {
        // Lấy tất cả các phần tử văn bản trong editor
        const nodes = Array.from(this.editor.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div, table, ul, ol, blockquote'));
        
        // Thêm các text node cấp cao nhất vào danh sách
        const childNodes = Array.from(this.editor.childNodes);
        childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
                nodes.push(node);
            }
        });
        
        // Nếu editor rỗng
        if (nodes.length === 0) {
            return { node: this.editor, before: true };
        }
        
        // Sắp xếp các node theo thứ tự xuất hiện trong DOM
        nodes.sort((a, b) => {
            const aRect = a.getBoundingClientRect();
            const bRect = b.getBoundingClientRect();
            
            if (aRect.top === bRect.top) {
                return aRect.left - bRect.left;
            }
            return aRect.top - bRect.top;
        });
        
        // Tìm phần tử gần nhất với vị trí chuột
        let targetNode = null;
        let beforeNode = true;
        let minDistance = Number.MAX_VALUE;
        
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (node === this.currentImage || node.contains(this.currentImage) || 
                (this.currentImage && this.currentImage.contains(node))) continue;
            
            const rect = node.getBoundingClientRect();
            
            // Tính khoảng cách từ chuột đến phần tử
            // Ưu tiên khoảng cách theo chiều dọc
            const distanceY = Math.min(
                Math.abs(y - rect.top),
                Math.abs(y - rect.bottom)
            );
            
            const distanceToTop = Math.abs(y - rect.top);
            const distanceToBottom = Math.abs(y - rect.bottom);
            
            // Nếu khoảng cách nhỏ hơn, cập nhật targetNode
            if (distanceY < minDistance) {
                minDistance = distanceY;
                targetNode = node;
                beforeNode = (distanceToTop <= distanceToBottom);
            }
        }
        
        // Nếu không tìm thấy hoặc khoảng cách quá lớn (> 100px), thêm vào cuối
        if (!targetNode || minDistance > 100) {
            // Tìm node cuối cùng trong editor
            let lastNode = this.editor.lastChild;
            
            // Nếu không có node nào hoặc node cuối là currentImage
            if (!lastNode || lastNode === this.currentImage) {
                const emptyP = document.createElement('p');
                emptyP.innerHTML = '<br>';
                this.editor.appendChild(emptyP);
                lastNode = emptyP;
            }
            
            return { node: lastNode, before: false };
        }
        
        return { node: targetNode, before: beforeNode };
    }
    
    // Hiển thị chỉ báo vị trí thả
    showDropIndicator(position) {
        // Tạo hoặc lấy chỉ báo
        let indicator = document.getElementById('drop-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'drop-indicator';
            document.body.appendChild(indicator);
        }
        
        // Lấy vị trí của phần tử mục tiêu
        const rect = position.node.getBoundingClientRect();
        const editorRect = this.editor.getBoundingClientRect();
        
        // Đặt vị trí chỉ báo
        indicator.style.position = 'absolute';
        indicator.style.backgroundColor = '#4b94e6';
        indicator.style.height = '3px';
        indicator.style.width = `${editorRect.width}px`;
        indicator.style.left = `${editorRect.left}px`;
        
        if (position.before) {
            indicator.style.top = `${rect.top - 2}px`;
        } else {
            indicator.style.top = `${rect.bottom - 2}px`;
        }
        
        indicator.style.display = 'block';
        indicator.style.zIndex = '1001';
    }
    
    // Ẩn chỉ báo vị trí thả
    hideDropIndicator() {
        const indicator = document.getElementById('drop-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    handleTextFlow() {
        // Đây là một cách tiếp cận đơn giản - trong một trình soạn thảo thực tế, điều này sẽ phức tạp hơn
        const images = this.editor.querySelectorAll('.resizable-image');
        
        // Đặt lại luồng văn bản
        this.editor.style.position = 'relative';
        
        // Với mỗi hình ảnh, xác định vị trí của nó và xử lý luồng văn bản
        images.forEach(image => {
            // Bỏ qua hình ảnh ở chế độ manual position
            if (image.dataset.positionMode === 'manual') {
                return;
            }
            
            if (image.style.position === 'absolute') {
                // Khi hình ảnh được định vị tuyệt đối, chúng ta cần đảm bảo văn bản chảy xung quanh nó
                // Điều này có thể thực hiện với thuộc tính float và position của CSS
                
                const imgRect = image.getBoundingClientRect();
                const editorRect = this.editor.getBoundingClientRect();
                
                // Xác định vị trí hình ảnh tương đối so với editor
                const relativeTop = imgRect.top - editorRect.top;
                const relativeLeft = imgRect.left - editorRect.left;
                const relativeHCenter = relativeLeft + (imgRect.width / 2);
                const editorCenter = editorRect.width / 2;
                
                // Cách tiếp cận cải tiến: sử dụng vị trí tương đối và khoảng cách đến trung tâm
                if (relativeLeft < editorRect.width / 3) {
                    // Canh trái
                    this.alignImage(image, 'left');
                } else if (relativeLeft > (editorRect.width * 2/3)) {
                    // Canh phải
                    this.alignImage(image, 'right');
                } else {
                    // Canh giữa - sử dụng phương pháp chính xác hơn
                    this.alignImage(image, 'center');
                    
                    // Đảm bảo hình ảnh nằm trong container riêng
                    const paragraph = document.createElement('p');
                    paragraph.style.textAlign = 'center';
                    
                    // Kiểm tra nếu hình ảnh đã nằm trong paragraph
                    const parentNode = image.parentNode;
                    if (parentNode.tagName !== 'P') {
                        // Thêm paragraph trước hình ảnh
                        image.parentNode.insertBefore(paragraph, image);
                        // Di chuyển hình ảnh vào paragraph
                        paragraph.appendChild(image);
                    }
                }
                
                // Xóa định vị tuyệt đối sau khi thả
                image.style.position = '';
                image.style.left = '';
                image.style.top = '';
                image.style.zIndex = '';
                
                // Xóa dataset position mode
                delete image.dataset.positionMode;
                
                // Cập nhật vị trí menu button
                this.updateMenuButtonPosition(image);
            }
        });
    }

    setupImageMenuHandlers() {
        // Thêm nút chuyển chế độ vào menu
        const modeSwitchItem = document.createElement('button');
        modeSwitchItem.id = 'toggle-image-mode';
        modeSwitchItem.innerHTML = 'Chế độ tự do (Manual)';
        modeSwitchItem.addEventListener('click', () => {
            if (this.currentImage) {
                // Chuyển đổi mode
                const newMode = this.alignMode === 'auto' ? 'manual' : 'auto';
                
                // Đặt chế độ mới
                this.setAlignMode(newMode);
                
                // Cập nhật nội dung của nút
                modeSwitchItem.innerHTML = newMode === 'auto' ? 'Chế độ tự do (Manual)' : 'Chế độ tự động (Auto)';
                
                // Ẩn menu
                this.imageMenu.style.display = 'none';
            }
        });
        
        // Thêm nút vào đầu menu sau khi tạo một dấu gạch ngang
        const separator = document.createElement('hr');
        this.imageMenu.insertBefore(separator, this.imageMenu.firstChild);
        this.imageMenu.insertBefore(modeSwitchItem, this.imageMenu.firstChild);

        // Căn trái
        document.getElementById('align-image-left').addEventListener('click', () => {
            if (this.currentImage) {
                this.alignImage(this.currentImage, 'left');
                this.imageMenu.style.display = 'none';
            }
        });

        // Căn giữa
        document.getElementById('align-image-center').addEventListener('click', () => {
            if (this.currentImage) {
                this.alignImage(this.currentImage, 'center');
                this.imageMenu.style.display = 'none';
            }
        });

        // Căn phải
        document.getElementById('align-image-right').addEventListener('click', () => {
            if (this.currentImage) {
                this.alignImage(this.currentImage, 'right');
                this.imageMenu.style.display = 'none';
            }
        });

        // Xóa hình ảnh
        document.getElementById('delete-image').addEventListener('click', () => {
            if (this.currentImage) {
                // Xóa menu button
                if (this.currentImage.menuButtonGroup) {
                    this.currentImage.menuButtonGroup.remove();
                }
                
                this.currentImage.remove();
                this.currentImage = null;
                this.imageMenu.style.display = 'none';
            }
        });
    }

    // Dọn dẹp các nút không còn sử dụng
    cleanup() {
        // Xóa tất cả các button group không còn gắn với hình ảnh nào
        const buttonGroups = this.imageButtonContainer.querySelectorAll('.image-menu-button-group');
        const images = this.editor.querySelectorAll('.resizable-image');
        
        buttonGroups.forEach(group => {
            let isOrphaned = true;
            
            images.forEach(img => {
                if (img.menuButtonGroup === group) {
                    isOrphaned = false;
                }
            });
            
            if (isOrphaned) {
                group.remove();
            }
        });
    }

    setupDragDropListeners() {
        // Hỗ trợ cho việc kéo và thả tệp
        this.editor.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.editor.classList.add('drag-over');
        });

        this.editor.addEventListener('dragleave', () => {
            this.editor.classList.remove('drag-over');
        });

        this.editor.addEventListener('drop', (e) => {
            e.preventDefault();
            this.editor.classList.remove('drag-over');
            
            if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    
                    reader.onload = (event) => {
                        // Tính toán vị trí dựa trên vị trí thả
                        const selection = window.getSelection();
                        const range = document.createRange();
                        range.setStart(this.editor, 0);
                        selection.removeAllRanges();
                        selection.addRange(range);
                        
                        this.insertImage(event.target.result);
                    };
                    
                    reader.readAsDataURL(file);
                }
            }
        });
    }

    // Di chuyển ảnh đến vị trí thả
    moveImageToDropTarget(image, dropTarget) {
        if (!dropTarget || !dropTarget.node) return;
        
        // Nếu đang ở chế độ manual, bỏ qua việc di chuyển
        if (this.alignMode === 'manual') return;
        
        // Lấy paragraph cha hiện tại của ảnh nếu có
        const currentParentP = image.closest('p');
        
        // Quyết định cách chèn ảnh dựa trên vị trí thả
        if (dropTarget.node.nodeType === Node.ELEMENT_NODE) {
            // Tạo paragraph mới nếu cần thiết
            let paragraphContainer = null;
            
            // Kiểm tra xem nơi thả có phải là paragraph hay không
            if (dropTarget.node.tagName === 'P') {
                paragraphContainer = dropTarget.node;
            } else {
                paragraphContainer = document.createElement('p');
            }
            
            // Xóa vị trí tuyệt đối trước khi chèn
            image.style.position = '';
            image.style.left = '';
            image.style.top = '';
            image.style.zIndex = '';
            delete image.dataset.positionMode;
            
            // Nếu là chèn trước node
            if (dropTarget.before) {
                if (dropTarget.node.tagName !== 'P') {
                    dropTarget.node.parentNode.insertBefore(paragraphContainer, dropTarget.node);
                    paragraphContainer.appendChild(image);
                } else {
                    dropTarget.node.parentNode.insertBefore(image, dropTarget.node);
                }
            } 
            // Nếu là chèn sau node
            else {
                if (dropTarget.node.nextSibling) {
                    if (dropTarget.node.tagName !== 'P') {
                        dropTarget.node.parentNode.insertBefore(paragraphContainer, dropTarget.node.nextSibling);
                        paragraphContainer.appendChild(image);
                    } else {
                        dropTarget.node.parentNode.insertBefore(image, dropTarget.node.nextSibling);
                    }
                } else {
                    if (dropTarget.node.tagName !== 'P') {
                        dropTarget.node.parentNode.appendChild(paragraphContainer);
                        paragraphContainer.appendChild(image);
                    } else {
                        dropTarget.node.parentNode.appendChild(image);
                    }
                }
            }
            
            // Dọn dẹp paragraph cha cũ nếu rỗng
            if (currentParentP && currentParentP.childNodes.length === 0) {
                currentParentP.remove();
            }
            
            // Cập nhật vị trí menu button
            this.updateMenuButtonPosition(image);
        } else {
            // Nếu là node văn bản, chèn trước hoặc sau node đó
            const textNode = dropTarget.node;
            const parentNode = textNode.parentNode;
            
            // Tạo paragraph mới để chứa ảnh
            const paragraphContainer = document.createElement('p');
            paragraphContainer.appendChild(image);
            
            if (dropTarget.before) {
                parentNode.insertBefore(paragraphContainer, textNode);
            } else {
                if (textNode.nextSibling) {
                    parentNode.insertBefore(paragraphContainer, textNode.nextSibling);
                } else {
                    parentNode.appendChild(paragraphContainer);
                }
            }
            
            // Dọn dẹp paragraph cha cũ nếu rỗng
            if (currentParentP && currentParentP.childNodes.length === 0) {
                currentParentP.remove();
            }
            
            // Cập nhật vị trí menu button
            this.updateMenuButtonPosition(image);
        }
    }

    // Cập nhật trạng thái của tất cả các button dựa trên mode hiện tại
    updateAllImageButtonsState() {
        const images = this.editor.querySelectorAll('.resizable-image');
        
        images.forEach(image => {
            if (image.menuButtonGroup) {
                // Cập nhật trạng thái của nút switch mode
                const switchModeBtn = image.menuButtonGroup.switchModeBtn;
                if (switchModeBtn) {
                    switchModeBtn.dataset.mode = this.alignMode;
                    this.updateSwitchButtonStyle(switchModeBtn);
                }
                
                // Cập nhật trạng thái của các nút căn chỉnh
                this.updateAlignButtonsState(image.menuButtonGroup);
            }
        });
    }
    
    // Cập nhật trạng thái của tất cả hình ảnh khi chuyển đổi mode
    setAlignMode(mode) {
        if (mode === this.alignMode) return;
        
        this.alignMode = mode;
        
        // Cập nhật trạng thái của tất cả các button
        this.updateAllImageButtonsState();
        
        // Xử lý tất cả hình ảnh theo mode mới
        const images = this.editor.querySelectorAll('.resizable-image');
        
        images.forEach(image => {
            if (mode === 'auto') {
                // Chuyển từ manual sang auto: áp dụng căn chỉnh tự động
                // Nếu hình ảnh đang ở chế độ manual
                if (image.dataset.positionMode === 'manual') {
                    // Lấy vị trí hiện tại để xác định chế độ căn chỉnh phù hợp
                    const imgRect = image.getBoundingClientRect();
                    const editorRect = this.editor.getBoundingClientRect();
                    const relativeLeft = imgRect.left - editorRect.left;
                    
                    // Nếu là phần tử cha đặc biệt cho manual position
                    const parent = image.parentNode;
                    if (parent && parent.style.position === 'relative' && parent.style.height === '0px') {
                        // Tạo paragraph mới
                        const paragraph = document.createElement('p');
                        // Determine alignment based on position
                        if (relativeLeft < editorRect.width / 3) {
                            paragraph.style.textAlign = 'left';
                        } else if (relativeLeft > (editorRect.width * 2/3)) {
                            paragraph.style.textAlign = 'right';
                        } else {
                            paragraph.style.textAlign = 'center';
                        }
                        
                        // Insert before current container
                        const grandparent = parent.parentNode;
                        grandparent.insertBefore(paragraph, parent);
                        
                        // Move image to new paragraph
                        paragraph.appendChild(image);
                        
                        // Remove old container
                        parent.remove();
                        
                        // Reset position styles
                        image.style.position = '';
                        image.style.left = '';
                        image.style.top = '';
                        image.style.zIndex = '';
                        delete image.dataset.positionMode;
                        
                        // Apply appropriate alignment class
                        if (relativeLeft < editorRect.width / 3) {
                            image.classList.add('align-left');
                            image.classList.remove('align-center', 'align-right');
                        } else if (relativeLeft > (editorRect.width * 2/3)) {
                            image.classList.add('align-right');
                            image.classList.remove('align-left', 'align-center');
                        } else {
                            image.classList.add('align-center');
                            image.classList.remove('align-left', 'align-right');
                        }
                    }
                }
            }
            // Mode manual không cần xử lý đặc biệt, vì các hình ảnh sẽ giữ nguyên trạng thái hiện tại
        });
    }

    // Hủy kéo thả nếu di chuột ra ngoài editor
    cancelDrag() {
        if (this.isDragging && this.currentImage && this.ghostImage) {
            // Xóa ghost image
            this.ghostImage.remove();
            this.ghostImage = null;
            
            // Khôi phục ảnh gốc
            this.currentImage.style.opacity = '1';
            this.currentImage.style.transform = '';
            this.currentImage.classList.remove('drag-ready');
            this.currentImage.classList.remove('dragging');
            
            // Khôi phục vị trí ban đầu
            if (this.initialPosition && this.initialPosition.parent) {
                if (this.initialPosition.nextSibling) {
                    this.initialPosition.parent.insertBefore(this.currentImage, this.initialPosition.nextSibling);
                } else {
                    this.initialPosition.parent.appendChild(this.currentImage);
                }
                
                // Khôi phục kiểu
                this.currentImage.style.position = '';
                this.currentImage.style.left = '';
                this.currentImage.style.top = '';
                this.currentImage.style.zIndex = '';
            }
            
            // Xóa chỉ báo vị trí thả
            this.hideDropIndicator();
            
            // Cập nhật vị trí menu button
            this.updateMenuButtonPosition(this.currentImage);
            
            // Đánh dấu đã dừng kéo
            this.isDragging = false;
        }
    }
}

// Export class
window.ImageHandler = ImageHandler; 