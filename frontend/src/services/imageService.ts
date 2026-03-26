import { v4 as uuidv4 } from 'uuid';
import { client } from '@/lib/apollo-client';

interface ImageData {
  file: File;
  tempUrl: string;
  uniqueId: string;
}

// Map để lưu trữ tạm thời các hình ảnh chưa được upload
const tempImagesMap = new Map<string, ImageData>();
// Map để lưu trữ hình ảnh đã upload và url trên server tương ứng
const uploadedImagesMap = new Map<string, string>();
// Mảng để theo dõi các URL hình ảnh đang được sử dụng
const activeImageUrls: string[] = [];

// Đọc biến môi trường
const MEDIA_BASE_PATH = process.env.NEXT_PUBLIC_MEDIA_BASE_PATH || '/media';

/**
 * Dịch vụ xử lý hình ảnh, cho phép:
 * 1. Tạo URL tạm thời để hiển thị hình ảnh trong editor
 * 2. Upload hình ảnh lên server khi user lưu content
 * 3. Thay thế URL trong nội dung từ tạm thời sang URL server
 */
export class ImageService {
  private static instance: ImageService;

  private constructor() {}

  public static getInstance(): ImageService {
    if (!ImageService.instance) {
      ImageService.instance = new ImageService();
    }
    return ImageService.instance;
  }

  /**
   * Tạo URL tạm thời cho hình ảnh để hiển thị trong editor
   * @param file File hình ảnh
   * @returns URL tạm thời và ID duy nhất của hình ảnh
   */
  public createTempImage(file: File): { tempUrl: string; uniqueId: string } {
    const tempUrl = URL.createObjectURL(file);
    const uniqueId = uuidv4();
    
    console.log(`Tạo URL tạm thời cho hình ảnh: ${file.name}`);
    
    // Lưu thông tin vào map tạm thời
    tempImagesMap.set(uniqueId, {
      file,
      tempUrl,
      uniqueId
    });
    
    // Thêm vào danh sách URL đang hoạt động
    activeImageUrls.push(tempUrl);
    
    return { tempUrl, uniqueId };
  }

  /**
   * Phân tích nội dung HTML để tìm và đánh dấu tất cả hình ảnh đang được sử dụng
   * @param htmlContent Nội dung HTML cần phân tích
   */
  public trackImagesInContent(htmlContent: string): void {
    console.log('Đánh dấu hình ảnh đang được sử dụng...');
    
    // Xóa danh sách hình ảnh đang hoạt động hiện tại
    activeImageUrls.length = 0;
    
    // Nếu không có nội dung hoặc không có hình ảnh, return
    if (!htmlContent || !htmlContent.includes('<img')) {
      return;
    }
    
    try {
      // Tạo một DOM parser để xử lý HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      
      // Tìm tất cả thẻ img trong nội dung
      const images = doc.querySelectorAll('img');
      
      // Lấy tất cả src và lưu vào activeImageUrls
      images.forEach(img => {
        const src = img.getAttribute('src');
        if (src) {
          activeImageUrls.push(src);
          console.log(`Đánh dấu hình ảnh đang sử dụng: ${src.slice(0, 30)}...`);
        }
      });
      
      console.log(`Tổng số hình ảnh đang sử dụng: ${activeImageUrls.length}`);
    } catch (error) {
      console.error('Lỗi khi phân tích HTML:', error);
    }
  }

  /**
   * Xử lý nội dung HTML để upload và thay thế các URL hình ảnh tạm thời
   * @param htmlContent Nội dung HTML cần xử lý
   * @returns Nội dung HTML sau khi xử lý
   */
  public async processHtmlContent(htmlContent: string): Promise<string> {
    // Nếu không có nội dung hoặc không có hình ảnh, trả về nguyên nội dung
    if (!htmlContent) {
      return htmlContent;
    }
    
    // Kiểm tra cụ thể cho blob URL
    const hasBlobImages = htmlContent.includes('blob:');
    
    if (!hasBlobImages) {
      console.log('Không phát hiện hình ảnh blob cần xử lý');
      return htmlContent;
    }
    
    console.log('Bắt đầu xử lý hình ảnh blob trong nội dung HTML...');
    
    // Theo dõi tất cả hình ảnh đang được sử dụng
    this.trackImagesInContent(htmlContent);
    
    try {
      // Tạo một DOM parser để xử lý HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      
      // Tìm tất cả thẻ img trong nội dung
      const images = doc.querySelectorAll('img');
      console.log(`Tìm thấy ${images.length} hình ảnh trong nội dung HTML`);
      
      if (images.length === 0) {
        return htmlContent;
      }
      
      // Kiểm tra xem có blob URL không
      let hasBlobUrl = false;
      for (const img of Array.from(images)) {
        const src = img.getAttribute('src');
        if (src && src.startsWith('blob:')) {
          hasBlobUrl = true;
          break;
        }
      }
      
      if (!hasBlobUrl) {
        console.log('Không có hình ảnh blob cần xử lý');
        return htmlContent;
      }
      
      // Danh sách các promise xử lý hình ảnh
      const imagePromises = Array.from(images).map(async (img) => {
        const src = img.getAttribute('src');
        if (!src) return;
        
        // Chỉ xử lý các URL blob
        if (src.startsWith('blob:')) {
          console.log(`Xử lý hình ảnh blob: ${src}`);
          
          // Tìm hình ảnh trong tempImagesMap
          let fileData: ImageData | undefined;
          
          for (const entry of Array.from(tempImagesMap.entries())) {
            const imageData = entry[1];
            if (imageData.tempUrl === src) {
              fileData = imageData;
              break;
            }
          }
          
          if (fileData) {
            // Upload hình ảnh lên server
            const serverUrl = await this.uploadImageToServer(fileData.file);
            
            if (serverUrl) {
              // Cập nhật src trong thẻ img
              img.setAttribute('src', serverUrl);
              console.log(`Đã thay thế URL: ${src} -> ${serverUrl}`);
              
              // Lưu ánh xạ URL tạm thời -> URL server
              uploadedImagesMap.set(src, serverUrl);
            } else {
              console.error(`Không thể upload hình ảnh blob: ${src}`);
              throw new Error(`Không thể upload hình ảnh blob: ${src}`);
            }
          } else {
            console.warn(`Không tìm thấy dữ liệu cho hình ảnh: ${src}`);
            throw new Error(`Không tìm thấy dữ liệu cho hình ảnh: ${src}`);
          }
        }
      });
      
      // Đợi tất cả các xử lý hoàn thành
      try {
        await Promise.all(imagePromises);
      } catch (error) {
        console.error('Lỗi khi xử lý một hoặc nhiều hình ảnh:', error);
        throw error;
      }
      
      // Lấy nội dung HTML sau khi xử lý
      const processedContent = doc.body.innerHTML;
      
      // Kiểm tra lại xem còn URL blob không
      if (processedContent.includes('blob:')) {
        console.error('Vẫn còn URL blob sau khi xử lý');
        throw new Error('Không thể xử lý tất cả hình ảnh blob');
      }
      
      console.log('Xử lý hình ảnh hoàn tất');
      return processedContent;
    } catch (error) {
      console.error('Lỗi khi xử lý hình ảnh:', error);
      throw error; // Ném lỗi để hàm gọi xử lý
    }
  }

  /**
   * Upload một hình ảnh lên server sử dụng GraphQL mutation
   * @param file File hình ảnh cần upload
   * @returns URL của hình ảnh sau khi upload
   */
  private async uploadImageToServer(file: File): Promise<string> {
    try {
      console.log(`Đang upload hình ảnh: ${file.name} (${file.size} bytes)`);
      
      // Kiểm tra file có hợp lệ không
      if (!file || !(file instanceof File)) {
        console.error('File không hợp lệ:', file);
        throw new Error('Invalid file object');
      }
      
      // Kiểm tra kích thước file - giới hạn 5MB (5 * 1024 * 1024 bytes)
      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
      if (file.size > MAX_FILE_SIZE) {
        console.error(`File quá lớn: ${file.size} bytes. Giới hạn là ${MAX_FILE_SIZE} bytes (5MB)`);
        throw new Error('File too large, maximum size is 5MB');
      }
      
      // Tạo FormData để upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('storage_type', 'local');
      
      // Upload bằng REST API trực tiếp đến backend
      const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';
      console.log(`API Base URL: ${API_BASE_URL}`);
      const uploadUrl = `${API_BASE_URL}/media/upload`;
      console.log(`Upload URL: ${uploadUrl}`);
      
      try {
        const response = await fetch(uploadUrl, {
          method: 'POST',
          body: formData,
          credentials: 'include' // Để gửi cookies, cần thiết cho xác thực
        });
        
        console.log(`Response status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
          console.error('Upload thất bại:', response.status, response.statusText);
          const errorText = await response.text();
          console.error('Error details:', errorText);
          throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (!data || !data.url) {
          console.error('Upload thất bại: Không có URL trả về');
          throw new Error('Upload failed: No URL returned');
        }
        
        // Lấy URL từ response và xử lý URL
        let url = data.url;
        console.log(`Upload thành công. Server URL gốc: ${url}`);
        
        // Kiểm tra nếu URL bắt đầu với dấu /
        if (url.startsWith('/')) {
          url = `${API_BASE_URL}${url}`;
          console.log(`URL đã được chuyển đổi thành: ${url}`);
        }
        
        return url;
      } catch (networkError) {
        console.error('Lỗi mạng khi upload hình ảnh:', networkError);
        
        // Trong trường hợp không thể kết nối đến server, trả về URL tạm thời
        // Điều này cho phép người dùng tiếp tục làm việc với hình ảnh cục bộ
        console.warn('Không thể kết nối đến server, sử dụng URL tạm thời');
        return URL.createObjectURL(file);
      }
    } catch (error) {
      console.error('Lỗi khi upload hình ảnh:', error);
      throw error; // Ném lỗi để bên gọi xử lý
    }
  }

  /**
   * Dọn dẹp hình ảnh không sử dụng
   */
  public cleanupUnusedImages(): void {
    console.log('Bắt đầu dọn dẹp hình ảnh không sử dụng...');
    
    // Xóa các blob URL không còn sử dụng để tránh memory leak
    for (const entry of Array.from(tempImagesMap.entries())) {
      const uniqueId = entry[0];
      const imageData = entry[1];
      
      // Nếu URL không còn trong danh sách đang hoạt động
      if (!activeImageUrls.includes(imageData.tempUrl)) {
        console.log(`Xóa hình ảnh không sử dụng: ${imageData.file.name}`);
        
        // Revoke URL object để tránh memory leak
        URL.revokeObjectURL(imageData.tempUrl);
        
        // Xóa khỏi map
        tempImagesMap.delete(uniqueId);
      }
    }
    
    console.log('Hoàn tất dọn dẹp hình ảnh');
  }

  /**
   * Xóa tất cả URL tạm thời đã tạo
   */
  public clearTempImages(): void {
    console.log('Xóa tất cả hình ảnh tạm thời...');
    
    // Revoke tất cả object URL để tránh memory leak
    tempImagesMap.forEach(data => {
      URL.revokeObjectURL(data.tempUrl);
    });
    
    // Xóa tất cả phần tử
    tempImagesMap.clear();
    activeImageUrls.length = 0;
    
    console.log('Đã xóa tất cả hình ảnh tạm thời');
  }

  /**
   * Lấy số lượng hình ảnh tạm thời
   */
  public getTempImagesCount(): number {
    return tempImagesMap.size;
  }

  /**
   * Lấy số lượng hình ảnh đang hoạt động
   */
  public getActiveImagesCount(): number {
    return activeImageUrls.length;
  }
}

export const imageService = ImageService.getInstance(); 