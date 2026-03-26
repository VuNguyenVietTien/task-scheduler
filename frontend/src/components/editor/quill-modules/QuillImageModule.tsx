import { MutableRefObject } from 'react';

/**
 * Interface cho các tùy chọn của QuillImageModule
 */
export interface QuillImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  acceptTypes?: string;
  multiple?: boolean;
  // Có thể thêm cho phép upload lên server
  uploadToServer?: boolean;
  serverUrl?: string;
  enableResize?: boolean;
  enableCaption?: boolean;
}

/**
 * Module quản lý tất cả chức năng liên quan đến ảnh trong Quill
 */
export class QuillImageModule {
  private quillRef: MutableRefObject<any>;
  private options: QuillImageOptions;

  constructor(quillRef: MutableRefObject<any>, options: QuillImageOptions = {}) {
    this.quillRef = quillRef;
    this.options = {
      maxWidth: 800,
      maxHeight: 600,
      acceptTypes: 'image/*',
      multiple: true,
      enableResize: true,
      enableCaption: false,
      ...options,
    };
  }

  /**
   * Khởi tạo module
   */
  public initialize(): void {
    // Phải đảm bảo chạy phía client
    if (typeof window === 'undefined') return;
    
    this.setupImageHandler();
  }

  /**
   * Thiết lập handler cho image trong toolbar
   */
  private setupImageHandler(): void {
    // Nhận tham chiếu đến Quill
    const quillEditor = this.quillRef.current?.getEditor();
    if (!quillEditor) return;

    // Tìm button image trong toolbar và gán handler nếu không sử dụng handlers trong config
    setTimeout(() => {
      const imageButton = document.querySelector('.ql-image');
      if (imageButton && !this.isCustomHandlerConfigured()) {
        imageButton.addEventListener('click', (e: Event) => this.handleImageUpload(e as MouseEvent));
      }
    }, 100);
  }

  /**
   * Kiểm tra xem đã cấu hình handler tùy chỉnh chưa
   */
  private isCustomHandlerConfigured(): boolean {
    const quillEditor = this.quillRef.current?.getEditor();
    if (!quillEditor) return false;

    const toolbar = quillEditor.getModule('toolbar');
    if (toolbar && toolbar.handlers && toolbar.handlers.image) {
      return true;
    }
    return false;
  }

  /**
   * Handler khi click vào nút image trong toolbar
   */
  public handleImageUpload(e?: MouseEvent): void {
    if (e) {
      e.preventDefault();
    }
    
    const quillEditor = this.quillRef.current?.getEditor();
    if (!quillEditor) return;
    
    // Tạo input type file ẩn
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', this.options.acceptTypes || 'image/*');
    if (this.options.multiple) {
      input.setAttribute('multiple', 'true');
    }
    input.click();
    
    // Khi file được chọn
    input.onchange = async () => {
      if (!input.files || input.files.length === 0) return;
      
      // Lấy vị trí hiện tại của con trỏ
      const range = quillEditor.getSelection(true);
      
      // Xử lý từng file được chọn
      for (let i = 0; i < input.files.length; i++) {
        const file = input.files[i];
        
        // Nếu có uploadToServer = true, thêm code upload lên server ở đây
        if (this.options.uploadToServer && this.options.serverUrl) {
          // Implement tính năng upload lên server sau
          console.log('Upload to server feature is not implemented yet');
        } else {
          // Upload local và chèn trực tiếp vào editor
          this.insertLocalImage(quillEditor, file, range.index + i);
        }
      }
    };
  }

  /**
   * Chèn ảnh từ local vào editor
   */
  private insertLocalImage(quillEditor: any, file: File, index: number): void {
    // Tạo file reader để đọc file
    const reader = new FileReader();
    reader.onload = () => {
      // Nếu enabled resize, chúng ta có thể resize ảnh trước khi chèn
      if (this.options.enableResize) {
        this.processImageBeforeInsert(reader.result as string, (processedImage) => {
          // Chèn ảnh vào vị trí con trỏ
          quillEditor.insertEmbed(index, 'image', processedImage, 'user');
          
          // Di chuyển con trỏ sau ảnh
          quillEditor.setSelection(index + 1, 0);
          
          // Thêm caption nếu được kích hoạt
          if (this.options.enableCaption) {
            this.addCaptionToImage(quillEditor, index);
          }
        });
      } else {
        // Chèn ảnh ngay lập tức không xử lý
        quillEditor.insertEmbed(index, 'image', reader.result, 'user');
        
        // Di chuyển con trỏ sau ảnh
        quillEditor.setSelection(index + 1, 0);
        
        // Thêm caption nếu được kích hoạt
        if (this.options.enableCaption) {
          this.addCaptionToImage(quillEditor, index);
        }
      }
    };
    reader.readAsDataURL(file);
  }

  /**
   * Xử lý ảnh trước khi chèn (resize nếu cần)
   */
  private processImageBeforeInsert(dataUrl: string, callback: (processedDataUrl: string) => void): void {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      // Kiểm tra xem có cần resize không
      if (
        (this.options.maxWidth && img.width > this.options.maxWidth) ||
        (this.options.maxHeight && img.height > this.options.maxHeight)
      ) {
        // Tính toán tỷ lệ resize
        let newWidth = img.width;
        let newHeight = img.height;
        
        if (this.options.maxWidth && newWidth > this.options.maxWidth) {
          const ratio = this.options.maxWidth / newWidth;
          newWidth = this.options.maxWidth;
          newHeight = newHeight * ratio;
        }
        
        if (this.options.maxHeight && newHeight > this.options.maxHeight) {
          const ratio = this.options.maxHeight / newHeight;
          newHeight = this.options.maxHeight;
          newWidth = newWidth * ratio;
        }
        
        // Resize ảnh
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          callback(dataUrl);
          return;
        }
        
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        ctx.drawImage(img, 0, 0, newWidth, newHeight);
        
        // Trả về ảnh đã resize
        callback(canvas.toDataURL('image/jpeg', 0.9));
      } else {
        // Không cần resize
        callback(dataUrl);
      }
    };
    img.onerror = () => {
      // Nếu có lỗi, trả về dataUrl gốc
      callback(dataUrl);
    };
  }

  /**
   * Thêm caption cho ảnh
   */
  private addCaptionToImage(quillEditor: any, index: number): void {
    // Chèn một dòng text dưới ảnh
    quillEditor.insertText(index + 1, '\nMô tả ảnh', { 'align': 'center', 'italic': true, 'size': 'small' });
    quillEditor.setSelection(index + 2, 0);
  }

  /**
   * Dọn dẹp - gỡ bỏ các sự kiện và tham chiếu
   */
  public destroy(): void {
    // Gỡ bỏ event listeners nếu có
  }
}

/**
 * Hook để sử dụng QuillImageModule trong React
 */
export function useQuillImage(quillRef: MutableRefObject<any>, options: QuillImageOptions = {}) {
  let imageModule: QuillImageModule | null = null;
  
  const initialize = () => {
    if (!imageModule) {
      imageModule = new QuillImageModule(quillRef, options);
      imageModule.initialize();
    }
    return imageModule;
  };
  
  const destroy = () => {
    if (imageModule) {
      imageModule.destroy();
      imageModule = null;
    }
  };
  
  return {
    initialize,
    destroy,
    uploadImage: () => {
      const module = initialize();
      module.handleImageUpload();
    }
  };
} 