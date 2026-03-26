import { MutableRefObject, useCallback, useEffect, useState } from 'react';
import { QuillTableOptions, useQuillTable } from '../quill-modules/QuillTableModule';
import { QuillImageOptions, useQuillImage } from '../quill-modules/QuillImageModule';

/**
 * Tùy chọn cho các module Quill
 */
export interface QuillModulesOptions {
  table?: QuillTableOptions;
  image?: QuillImageOptions;
  // Có thể thêm các tùy chọn cho module khác sau này
}

/**
 * Hook quản lý các module của Quill Editor
 * @param quillRef Tham chiếu đến Quill Editor
 * @param options Các tùy chọn cho module
 */
export function useQuillModules(
  quillRef: MutableRefObject<any>,
  options: QuillModulesOptions = {}
) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  
  // Khởi tạo và lấy các module
  const tableModule = useQuillTable(quillRef, options.table);
  const imageModule = useQuillImage(quillRef, options.image);
  
  // Kiểm tra xem Quill editor đã được khởi tạo đầy đủ hay chưa
  const checkQuillReady = useCallback(() => {
    if (!quillRef.current) return false;
    
    try {
      // Kiểm tra xem quillRef.current.getEditor() có thể gọi được không
      const editor = quillRef.current.getEditor();
      return !!editor;
    } catch (error) {
      console.warn('Quill editor không thể truy cập:', error);
      return false;
    }
  }, [quillRef]);
  
  // Khởi tạo tất cả modules khi component mount
  useEffect(() => {
    if (typeof window === 'undefined' || isInitialized || isInitializing) return;
    
    // Kiểm tra xem Quill đã sẵn sàng chưa
    if (!checkQuillReady()) {
      // Nếu quillRef chưa sẵn sàng, chúng ta sẽ chờ một lúc và thử lại sau
      const retryTimer = setTimeout(() => {
        // Buộc effect này chạy lại để thử lại việc khởi tạo
        setIsInitializing(false);
      }, 200);
      
      return () => clearTimeout(retryTimer);
    }
    
    // Đánh dấu đang trong quá trình khởi tạo để tránh chạy nhiều lần
    setIsInitializing(true);
    
    // Khởi tạo các module
    const initializeModules = async () => {
      try {
        console.log('Bắt đầu khởi tạo modules Quill');
        
        // Khởi tạo table module
        await tableModule.initialize();
        console.log('Đã khởi tạo table module');
        
        // Khởi tạo image module
        await imageModule.initialize();
        console.log('Đã khởi tạo image module');
        
        // Đánh dấu đã khởi tạo
        setIsInitialized(true);
        setHasError(false);
        console.log('Tất cả modules đã được khởi tạo thành công');
      } catch (error) {
        console.error('Lỗi khi khởi tạo Quill modules:', error);
        setHasError(true);
      } finally {
        setIsInitializing(false);
      }
    };
    
    // Thêm một chút trì hoãn để đảm bảo Quill đã hoàn tất khởi tạo
    const timer = setTimeout(() => {
      initializeModules();
    }, 200);
    
    // Cleanup khi unmount
    return () => {
      clearTimeout(timer);
      try {
        if (isInitialized) {
          tableModule.destroy();
          imageModule.destroy();
        }
      } catch (err) {
        console.warn('Error during module cleanup:', err);
      }
    };
  }, [quillRef, isInitialized, isInitializing, tableModule, imageModule, checkQuillReady]);
  
  // Handler cho việc thêm bảng - kiểm tra trạng thái khởi tạo
  const handleTableInsert = useCallback((rows: number, cols: number) => {
    if (isInitialized && !hasError && checkQuillReady()) {
      try {
        tableModule.insertTable(rows, cols);
      } catch (error) {
        console.error('Error inserting table:', error);
      }
    } else {
      console.warn('Cannot insert table: Quill modules not fully initialized yet or has errors');
    }
  }, [tableModule, isInitialized, hasError, checkQuillReady]);
  
  // Handler cho việc upload ảnh - kiểm tra trạng thái khởi tạo
  const handleImageUpload = useCallback(() => {
    if (isInitialized && !hasError && checkQuillReady()) {
      try {
        imageModule.uploadImage();
      } catch (error) {
        console.error('Error uploading image:', error);
      }
    } else {
      console.warn('Cannot upload image: Quill modules not fully initialized yet or has errors');
    }
  }, [imageModule, isInitialized, hasError, checkQuillReady]);
  
  // Trả về các handlers và modules
  return {
    isReady: isInitialized && !hasError && checkQuillReady(),
    isInitializing,
    hasError,
    insertTable: handleTableInsert,
    uploadImage: handleImageUpload,
  };
} 