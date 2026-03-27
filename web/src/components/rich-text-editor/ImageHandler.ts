/**
 * ImageHandler - Xử lý chức năng hình ảnh trong rich text editor
 */
export class ImageHandler {
  editor: HTMLElement;
  currentImage: HTMLElement | null = null;
  imageMenu: HTMLElement | null = null;
  isDragging: boolean;
  dragOffsetX: number;
  dragOffsetY: number;
  imageUpload: HTMLInputElement | null;
  imageButtonContainer: HTMLElement;
  alignMode: 'auto' | 'manual';
  editorScrollTop: number;
  editorOffsetX: number;
  editorOffsetY: number;
  resizeStartWidth: number;
  resizeStartHeight: number;
  resizeStartX: number;
  resizeStartY: number;
  currentResizeHandle: HTMLElement | null;
  isResizing: boolean;

  constructor(editor: HTMLElement) {
    this.editor = editor;
    this.isDragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.imageUpload = document.getElementById('image-upload') as HTMLInputElement;
    this.editorScrollTop = 0;
    this.editorOffsetX = 0;
    this.editorOffsetY = 0;
    this.resizeStartWidth = 0;
    this.resizeStartHeight = 0;
    this.resizeStartX = 0;
    this.resizeStartY = 0;
    this.currentResizeHandle = null;
    this.isResizing = false;

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
    if (this.imageUpload) {
      this.imageUpload.addEventListener('change', this.handleImageUpload.bind(this));
    }

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
      if (this.isDragging && !this.editor.contains(e.target as Node)) {
        this.cancelDrag();
      }
    });
  }

  handleImageUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const file = target.files[0];
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (event.target && event.target.result) {
          this.insertImage(event.target.result as string);
        }
      };
      
      reader.readAsDataURL(file);
    }
  }

  insertImage(src: string) {
    // Đảm bảo editor được focus trước khi chèn ảnh
    this.editor.focus();
    
    let range: Range;
    
    // Kiểm tra nếu có selection trong editor
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && this.editor.contains(selection.anchorNode)) {
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
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    
    // Kiểm tra nếu đang ở trong paragraph hoặc không
    let paragraph = range.commonAncestorContainer;
    if (paragraph.nodeType !== Node.ELEMENT_NODE || (paragraph as Element).tagName !== 'P') {
      paragraph = paragraph.parentNode;
      if (paragraph.nodeType !== Node.ELEMENT_NODE || (paragraph as Element).tagName !== 'P') {
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
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    
    // Thiết lập sự kiện cho hình ảnh
    this.setupImageListeners(imageContainer);
    
    // Chọn hình ảnh và hiện menu button
    imageContainer.classList.add('selected-image');
    this.currentImage = imageContainer;
    this.createOrUpdateMenuButton(imageContainer);
  }

  setupImageListeners(imageContainer: HTMLElement) {
    const img = imageContainer.querySelector('img');
    if (!img) return;
    
    const resizeHandles = imageContainer.querySelectorAll('.resize-handle');
    
    // Chọn hình ảnh
    imageContainer.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault(); // Ngăn chặn sự kiện focus vào text node gần đó
      
      // Bỏ chọn các hình ảnh khác
      document.querySelectorAll('.selected-image').forEach(container => {
        if (container !== imageContainer) {
          container.classList.remove('selected-image');
          this.updateMenuButtonVisibility(container as HTMLElement, false);
        }
      });
      
      imageContainer.classList.add('selected-image');
      this.currentImage = imageContainer;
      
      // Hiển thị menu button
      this.createOrUpdateMenuButton(imageContainer);
    });
    
    // Kéo hình ảnh
    imageContainer.addEventListener('mousedown', (e) => {
      if (e.target === img || (e.target === imageContainer && !(e.target as Element).classList.contains('resize-handle'))) {
        // Ngăn chặn các hành vi mặc định và bubble
        e.preventDefault();
        e.stopPropagation();
        
        // Chỉ cho phép kéo thả trong chế độ manual
        if (this.alignMode === 'manual') {
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
          
          // Bắt đầu kéo thả
          this.isDragging = true;
        }
      }
    });
    
    // Xử lý resize hình ảnh
    resizeHandles.forEach(handle => {
      (handle as HTMLElement).addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = img.offsetWidth;
        const startHeight = img.offsetHeight;
        const handleClass = (handle as Element).className;
        
        // Xác định hướng resize dựa trên class của handle
        const isNorth = handleClass.includes('n');
        const isSouth = handleClass.includes('s');
        const isWest = handleClass.includes('w');
        const isEast = handleClass.includes('e');
        
        // Thêm class đang resize
        imageContainer.classList.add('resizing');
        
        // Hàm xử lý khi di chuyển chuột
        const onMouseMove = (moveEvent: MouseEvent) => {
          // Tính toán độ thay đổi
          const dx = moveEvent.clientX - startX;
          const dy = moveEvent.clientY - startY;
          
          // Tính toán kích thước mới dựa trên hướng resize
          let newWidth = startWidth;
          let newHeight = startHeight;
          
          if (isEast) newWidth = startWidth + dx;
          if (isWest) newWidth = startWidth - dx;
          if (isNorth) newHeight = startHeight - dy;
          if (isSouth) newHeight = startHeight + dy;
          
          // Giới hạn kích thước tối thiểu
          newWidth = Math.max(50, newWidth);
          newHeight = Math.max(50, newHeight);
          
          // Cập nhật kích thước ảnh
          img.style.width = `${newWidth}px`;
          img.style.height = `${newHeight}px`;
        };
        
        // Hàm xử lý khi thả chuột
        const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          
          // Xóa class đang resize
          imageContainer.classList.remove('resizing');
        };
        
        // Đăng ký sự kiện tạm thời
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });
  }

  createOrUpdateMenuButton(imageContainer: HTMLElement) {
    // Xóa tất cả các menu button
    const allButtons = document.querySelectorAll('.image-menu-button-group');
    allButtons.forEach(button => button.remove());
    
    // Tạo button group mới
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'image-menu-button-group';
    
    // Tạo các button căn chỉnh
    const alignLeftBtn = document.createElement('button');
    alignLeftBtn.className = 'image-menu-button align-left-btn';
    alignLeftBtn.title = 'Căn trái';
    alignLeftBtn.innerHTML = '<i class="fas fa-align-left"></i>';
    
    const alignCenterBtn = document.createElement('button');
    alignCenterBtn.className = 'image-menu-button align-center-btn';
    alignCenterBtn.title = 'Căn giữa';
    alignCenterBtn.innerHTML = '<i class="fas fa-align-center"></i>';
    
    const alignRightBtn = document.createElement('button');
    alignRightBtn.className = 'image-menu-button align-right-btn';
    alignRightBtn.title = 'Căn phải';
    alignRightBtn.innerHTML = '<i class="fas fa-align-right"></i>';

    // Tạo button chuyển chế độ căn chỉnh
    const switchBtn = document.createElement('button');
    switchBtn.className = 'image-menu-button switch-align-mode-btn';
    this.updateSwitchButtonStyle(switchBtn);

    // Thêm button vào group
    buttonGroup.appendChild(alignLeftBtn);
    buttonGroup.appendChild(alignCenterBtn);
    buttonGroup.appendChild(alignRightBtn);
    buttonGroup.appendChild(switchBtn);
    
    // Thêm vào container
    this.imageButtonContainer.appendChild(buttonGroup);
    
    // Sự kiện cho các button
    alignLeftBtn.addEventListener('click', () => this.alignImage(imageContainer, 'left'));
    alignCenterBtn.addEventListener('click', () => this.alignImage(imageContainer, 'center'));
    alignRightBtn.addEventListener('click', () => this.alignImage(imageContainer, 'right'));
    
    switchBtn.addEventListener('click', () => {
      // Chuyển đổi chế độ
      this.alignMode = this.alignMode === 'auto' ? 'manual' : 'auto';
      this.updateSwitchButtonStyle(switchBtn);
      
      // Thay đổi lớp cho tất cả hình ảnh
      this.updateAllImageButtonsState();
    });
    
    // Cập nhật vị trí menu button
    this.updateMenuButtonPosition(imageContainer);
    
    // Đánh dấu button align hiện tại
    this.updateAlignButtonsState(buttonGroup);
    
    // Hiển thị menu button
    this.updateMenuButtonVisibility(imageContainer, true);
  }

  updateSwitchButtonStyle(switchBtn: HTMLElement) {
    if (this.alignMode === 'auto') {
      switchBtn.title = 'Chế độ căn chỉnh tự động';
      switchBtn.innerHTML = '<i class="fas fa-lock"></i>';
    } else {
      switchBtn.title = 'Chế độ căn chỉnh thủ công';
      switchBtn.innerHTML = '<i class="fas fa-unlock"></i>';
    }
  }

  updateAlignButtonsState(buttonGroup: HTMLElement) {
    if (!this.currentImage) return;
    
    const className = this.currentImage.className;
    const alignLeftBtn = buttonGroup.querySelector('.align-left-btn');
    const alignCenterBtn = buttonGroup.querySelector('.align-center-btn');
    const alignRightBtn = buttonGroup.querySelector('.align-right-btn');
    
    if (alignLeftBtn) alignLeftBtn.classList.remove('active');
    if (alignCenterBtn) alignCenterBtn.classList.remove('active');
    if (alignRightBtn) alignRightBtn.classList.remove('active');
    
    if (className.includes('align-left') && alignLeftBtn) {
      alignLeftBtn.classList.add('active');
    } else if (className.includes('align-center') && alignCenterBtn) {
      alignCenterBtn.classList.add('active');
    } else if (className.includes('align-right') && alignRightBtn) {
      alignRightBtn.classList.add('active');
    }
  }

  updateMenuButtonPosition(imageContainer: HTMLElement) {
    const buttonGroup = document.querySelector('.image-menu-button-group');
    if (!buttonGroup) return;
    
    const rect = imageContainer.getBoundingClientRect();
    (buttonGroup as HTMLElement).style.position = 'absolute';
    (buttonGroup as HTMLElement).style.top = `${rect.top - 40}px`;
    (buttonGroup as HTMLElement).style.left = `${rect.left}px`;
  }

  updateMenuButtonVisibility(imageContainer: HTMLElement, isVisible: boolean) {
    const buttonGroup = document.querySelector('.image-menu-button-group');
    if (buttonGroup && imageContainer === this.currentImage) {
      (buttonGroup as HTMLElement).style.display = isVisible ? 'flex' : 'none';
    }
  }

  alignImage(imageContainer: HTMLElement, alignment: 'left' | 'center' | 'right') {
    // Xóa tất cả class căn chỉnh
    imageContainer.classList.remove('align-left', 'align-center', 'align-right');
    
    // Thêm class căn chỉnh mới
    imageContainer.classList.add(`align-${alignment}`);
    
    // Tìm paragraph cha để căn chỉnh text
    const parentP = imageContainer.closest('p');
    if (parentP) {
      parentP.style.textAlign = alignment;
    }
    
    // Cập nhật trạng thái của button căn chỉnh
    const buttonGroup = document.querySelector('.image-menu-button-group');
    if (buttonGroup) {
      this.updateAlignButtonsState(buttonGroup as HTMLElement);
    }
  }

  handleMouseMove(e: MouseEvent) {
    if (!this.isDragging || !this.currentImage) return;
    
    // Xác định vị trí mới của ảnh
    const editorRect = this.editor.getBoundingClientRect();
    
    // Tính toán vị trí mới trong editor dựa trên vị trí chuột
    let left = e.clientX - editorRect.left - this.dragOffsetX;
    let top = e.clientY - editorRect.top - this.dragOffsetY + this.editor.scrollTop;
    
    // Giới hạn vị trí trong editor
    left = Math.max(0, Math.min(left, this.editor.clientWidth - this.currentImage.offsetWidth));
    top = Math.max(0, top);
    
    // Xác định vị trí của drop target
    const dropTarget = this.findDropTarget(e.clientX, e.clientY);
    
    if (dropTarget) {
      // Hiển thị drop indicator
      this.showDropIndicator(dropTarget.position);
    } else {
      // Ẩn drop indicator
      this.hideDropIndicator();
    }
    
    // Vị trí mới
    this.currentImage.style.position = 'absolute';
    this.currentImage.style.left = `${left}px`;
    this.currentImage.style.top = `${top}px`;
    
    // Cập nhật vị trí menu button
    this.updateMenuButtonPosition(this.currentImage);
  }

  handleMouseUp() {
    if (!this.isDragging || !this.currentImage) return;
    
    this.isDragging = false;
    this.currentImage.classList.remove('drag-ready');
    
    // Nếu đang ở chế độ căn chỉnh tự động, quay lại vị trí gốc
    if (this.alignMode === 'auto') {
      this.currentImage.style.position = '';
      this.currentImage.style.left = '';
      this.currentImage.style.top = '';
      
      // Cập nhật lại vị trí menu button
      this.updateMenuButtonPosition(this.currentImage);
    } else {
      // Xử lý drop vào target
      const mouseEvent = window.event as MouseEvent;
      const dropTarget = this.findDropTarget(mouseEvent.clientX, mouseEvent.clientY);
      
      if (dropTarget) {
        // Di chuyển hình ảnh vào target
        this.moveImageToDropTarget(this.currentImage, dropTarget);
        
        // Ẩn drop indicator
        this.hideDropIndicator();
      }
    }
    
    // Xử lý text flow
    this.handleTextFlow();
  }

  findDropTarget(x: number, y: number): any {
    // Chức năng này phức tạp, sẽ tìm vị trí có thể drop trong editor
    // Trong TypeScript, chúng ta sẽ trả về một đối tượng mô tả vị trí drop
    return null;
  }

  setupImageMenuHandlers() {
    // Phương thức này sẽ được triển khai với menu image
  }

  setupDragDropListeners() {
    // Phương thức này sẽ được triển khai để xử lý drag & drop từ ngoài
  }

  handleTextFlow() {
    // Phương thức này sẽ được triển khai để xử lý text flow xung quanh ảnh
  }

  showDropIndicator(position: string) {
    // Phương thức này sẽ được triển khai để hiển thị vị trí drop
  }

  hideDropIndicator() {
    // Phương thức này sẽ được triển khai để ẩn vị trí drop
  }

  moveImageToDropTarget(image: HTMLElement, dropTarget: any) {
    // Phương thức này sẽ được triển khai để di chuyển ảnh vào target
  }

  updateAllImageButtonsState() {
    // Phương thức này sẽ được triển khai để cập nhật trạng thái của tất cả button
  }

  setAlignMode(mode: 'auto' | 'manual') {
    this.alignMode = mode;
  }

  cancelDrag() {
    if (!this.isDragging || !this.currentImage) return;
    
    this.isDragging = false;
    this.currentImage.classList.remove('drag-ready');
    
    // Quay lại vị trí ban đầu
    this.currentImage.style.position = '';
    this.currentImage.style.left = '';
    this.currentImage.style.top = '';
    
    // Cập nhật lại vị trí menu button
    this.updateMenuButtonPosition(this.currentImage);
  }
}
