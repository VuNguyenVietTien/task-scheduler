export class ImageHandler {
  editor: HTMLElement;
  currentImage: HTMLElement | null = null;
  imageMenu: HTMLElement | null = null;
  
  constructor(editor: HTMLElement) {
    this.editor = editor;
    this.initImageHandlers();
    this.initImageUpload();
  }
  
  initImageHandlers() {
    // Lắng nghe sự kiện click trên hình ảnh
    this.editor.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      
      // Kiểm tra nếu click vào hình ảnh hoặc container của hình ảnh
      if (target.tagName === 'IMG' || target.classList.contains('resizable-image')) {
        // Lấy đối tượng hình ảnh
        const imgContainer = target.tagName === 'IMG' 
          ? target.closest('.resizable-image') 
          : target;
          
        if (imgContainer) {
          this.selectImage(imgContainer as HTMLElement);
        }
      } else if (!target.closest('.image-menu-button-container')) {
        // Nếu click ra ngoài và không phải là menu hình ảnh
        this.deselectImage();
      }
    });
  }
  
  initImageUpload() {
    // Tìm input upload hình ảnh
    const imageUpload = document.getElementById('image-upload') as HTMLInputElement;
    
    if (imageUpload) {
      // Lắng nghe sự kiện thay đổi của input
      imageUpload.addEventListener('change', async () => {
        if (imageUpload.files && imageUpload.files.length > 0) {
          const file = imageUpload.files[0];
          
          // Kiểm tra xem có phải là file hình ảnh không
          if (file.type.startsWith('image/')) {
            try {
              // Chuyển đổi file thành base64
              const base64 = await this.fileToBase64(file);
              
              // Chèn hình ảnh vào editor
              this.insertImage(base64);
              
              // Reset input file
              imageUpload.value = '';
            } catch (error) {
              console.error('Lỗi khi tải lên hình ảnh:', error);
            }
          } else {
            alert('Vui lòng chọn file hình ảnh hợp lệ.');
            imageUpload.value = '';
          }
        }
      });
    }
  }
  
  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Không thể chuyển đổi file thành base64.'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Lỗi khi đọc file.'));
      };
      
      reader.readAsDataURL(file);
    });
  }
  
  insertImage(src: string) {
    // Tạo container cho hình ảnh
    const imgContainer = document.createElement('div');
    imgContainer.className = 'resizable-image';
    
    // Tạo đối tượng hình ảnh
    const img = document.createElement('img');
    img.src = src;
    img.alt = 'Hình ảnh được chèn';
    
    // Thêm hình ảnh vào container
    imgContainer.appendChild(img);
    
    // Thêm resize handles
    this.addResizeHandles(imgContainer);
    
    // Chèn hình ảnh vào vị trí con trỏ
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(imgContainer);
      
      // Di chuyển caret sau hình ảnh
      range.setStartAfter(imgContainer);
      range.setEndAfter(imgContainer);
      
      selection.removeAllRanges();
      selection.addRange(range);
      
      // Thêm một thẻ p sau hình ảnh nếu cần
      const nextElement = imgContainer.nextElementSibling;
      if (!nextElement || !['P', 'DIV', 'BLOCKQUOTE'].includes(nextElement.tagName)) {
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        const parentNode = imgContainer.parentNode;
        if (parentNode) {
          parentNode.insertBefore(p, imgContainer.nextSibling);
        }
      }
    }
    
    // Chọn hình ảnh mới chèn
    this.selectImage(imgContainer);
  }
  
  addResizeHandles(imgContainer: HTMLElement) {
    // Thêm các handles để resize
    const handles = [
      { class: 'resize-handle-nw', cursor: 'nw-resize' },
      { class: 'resize-handle-ne', cursor: 'ne-resize' },
      { class: 'resize-handle-sw', cursor: 'sw-resize' },
      { class: 'resize-handle-se', cursor: 'se-resize' }
    ];
    
    // Tạo và thêm các handle
    handles.forEach(handle => {
      const div = document.createElement('div');
      div.className = `resize-handle ${handle.class}`;
      div.style.cursor = handle.cursor;
      
      // Thêm sự kiện mousedown cho handle
      div.addEventListener('mousedown', (e) => {
        this.startImageResize(e, handle.class, imgContainer);
      });
      
      imgContainer.appendChild(div);
    });
  }
  
  startImageResize(e: MouseEvent, handleClass: string, imgContainer: HTMLElement) {
    e.preventDefault();
    e.stopPropagation();
    
    // Lấy hình ảnh trong container
    const img = imgContainer.querySelector('img');
    if (!img) return;
    
    // Lấy kích thước ban đầu
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = imgContainer.offsetWidth;
    const startHeight = imgContainer.offsetHeight;
    
    // Tính toán tỷ lệ khung hình
    const aspectRatio = startWidth / startHeight;
    
    // Hàm xử lý sự kiện mousemove
    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      
      // Tính toán sự thay đổi
      let deltaX = moveEvent.clientX - startX;
      let deltaY = moveEvent.clientY - startY;
      
      // Tính toán kích thước mới dựa trên handle được kéo
      let newWidth = startWidth;
      let newHeight = startHeight;
      
      // Xác định hướng thay đổi dựa trên handle
      if (handleClass.includes('e')) { // Đông (phải)
        newWidth = startWidth + deltaX;
        newHeight = newWidth / aspectRatio;
      } else if (handleClass.includes('w')) { // Tây (trái)
        newWidth = startWidth - deltaX;
        newHeight = newWidth / aspectRatio;
      }
      
      if (handleClass.includes('s')) { // Nam (dưới)
        newHeight = startHeight + deltaY;
        newWidth = newHeight * aspectRatio;
      } else if (handleClass.includes('n')) { // Bắc (trên)
        newHeight = startHeight - deltaY;
        newWidth = newHeight * aspectRatio;
      }
      
      // Giới hạn kích thước tối thiểu
      newWidth = Math.max(50, newWidth);
      newHeight = Math.max(50, newHeight);
      
      // Áp dụng kích thước mới
      imgContainer.style.width = `${newWidth}px`;
      img.style.width = '100%';
      img.style.height = 'auto';
    };
    
    // Hàm xử lý sự kiện mouseup
    const handleMouseUp = () => {
      // Xóa event listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    // Thêm event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }
  
  selectImage(imgContainer: HTMLElement) {
    // Bỏ chọn hình ảnh hiện tại nếu có
    this.deselectImage();
    
    // Đặt hình ảnh hiện tại và thêm class selected
    this.currentImage = imgContainer;
    imgContainer.classList.add('selected-image');
    
    // Hiển thị menu cho hình ảnh
    this.showImageMenu(imgContainer);
  }
  
  deselectImage() {
    if (this.currentImage) {
      this.currentImage.classList.remove('selected-image');
      this.currentImage = null;
      
      // Ẩn menu hình ảnh
      this.hideImageMenu();
    }
  }
  
  showImageMenu(imgContainer: HTMLElement) {
    // Tìm hoặc tạo menu cho hình ảnh
    let menuContainer = document.querySelector('.image-menu-button-container') as HTMLElement;
    
    if (!menuContainer) {
      menuContainer = document.createElement('div');
      menuContainer.className = 'image-menu-button-container';
      document.body.appendChild(menuContainer);
    }
    
    // Lấy vị trí của hình ảnh
    const imgRect = imgContainer.getBoundingClientRect();
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    
    // Đặt vị trí cho menu
    menuContainer.style.top = (imgRect.top + scrollY - 40) + 'px';
    menuContainer.style.left = imgRect.left + 'px';
    
    // Tạo nội dung cho menu
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'image-menu-button-group';
    
    // Tạo các nút menu
    const buttons = [
      { label: 'Trái', action: () => this.alignImage(imgContainer, 'left'), icon: 'fa-align-left' },
      { label: 'Giữa', action: () => this.alignImage(imgContainer, 'center'), icon: 'fa-align-center' },
      { label: 'Phải', action: () => this.alignImage(imgContainer, 'right'), icon: 'fa-align-right' },
      { label: 'Xóa', action: () => this.deleteImage(imgContainer), icon: 'fa-trash' }
    ];
    
    // Thêm các nút vào menu
    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.className = 'image-menu-button';
      button.title = btn.label;
      button.innerHTML = `<i class="fas ${btn.icon}"></i>`;
      
      // Thêm sự kiện click
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.action();
      });
      
      // Kiểm tra nếu là nút căn chỉnh và hình ảnh đang có class tương ứng
      if (btn.icon.includes('align')) {
        const alignment = btn.icon.split('-').pop();
        if (imgContainer.classList.contains(`align-${alignment}`)) {
          button.classList.add('active');
        }
      }
      
      buttonGroup.appendChild(button);
    });
    
    // Xóa nội dung cũ và thêm nội dung mới
    menuContainer.innerHTML = '';
    menuContainer.appendChild(buttonGroup);
    
    // Hiển thị menu
    menuContainer.style.display = 'block';
  }
  
  hideImageMenu() {
    const menuContainer = document.querySelector('.image-menu-button-container') as HTMLElement;
    if (menuContainer) {
      menuContainer.style.display = 'none';
    }
  }
  
  alignImage(imgContainer: HTMLElement, align: string) {
    // Xóa các class căn chỉnh hiện tại
    imgContainer.classList.remove('align-left', 'align-center', 'align-right');
    
    // Thêm class căn chỉnh mới
    imgContainer.classList.add(`align-${align}`);
    
    // Cập nhật menu
    this.showImageMenu(imgContainer);
  }
  
  deleteImage(imgContainer: HTMLElement) {
    // Xóa hình ảnh khỏi DOM
    imgContainer.remove();
    
    // Bỏ chọn hình ảnh và ẩn menu
    this.currentImage = null;
    this.hideImageMenu();
    
    // Focus lại vào editor
    this.editor.focus();
  }
} 