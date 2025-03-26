'use client';

import React, { useState, useEffect } from 'react';
import { PencilIcon } from '@heroicons/react/24/outline';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Task } from '@/types/task';
import { AdvancedEditor } from '@/components/common/AdvancedEditor';
import { imageService } from "@/services/imageService";

interface TaskDescriptionProps {
  task: Task;
  onUpdate: (updates: Partial<Task>) => Promise<boolean>;
  className?: string;
}

export default function TaskDescription({ task, onUpdate, className = '' }: TaskDescriptionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState(task.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cập nhật mô tả khi task thay đổi
  useEffect(() => {
    setDescription(task.description || '');
  }, [task]);

  // Bắt đầu chỉnh sửa
  const startEditing = () => {
    setIsEditing(true);
  };

  // Hủy chỉnh sửa
  const cancelEditing = () => {
    setIsEditing(false);
    setDescription(task.description || '');
    setError(null);
    
    // Dọn dẹp hình ảnh không sử dụng
    imageService.cleanupUnusedImages();
  };

  // Lưu mô tả
  const saveDescription = async () => {
    try {
      setIsSaving(true);
      setError(null);

      console.log('Bắt đầu lưu mô tả công việc...');
      console.log('Nội dung mô tả:', description.substring(0, 100) + '...');
      
      // Kiểm tra nội dung mô tả
      if (!description) {
        setDescription('');
        try {
          console.log('Cập nhật mô tả rỗng');
          const success = await onUpdate({ description: '' });
          if (success) {
            console.log('Cập nhật mô tả rỗng thành công!');
            setIsEditing(false);
          } else {
            console.error('API trả về lỗi khi cập nhật mô tả rỗng');
          }
        } catch (error) {
          console.error('Lỗi khi cập nhật mô tả rỗng:', error);
          setError('Không thể cập nhật mô tả. Vui lòng thử lại sau.');
        } finally {
          setIsSaving(false);
        }
        return;
      }
      
      // Kiểm tra và xử lý hình ảnh trước
      let processedDescription = description;
      let hasImages = description.includes('<img');
      let containsBlob = description.includes('blob:');
      
      console.log('Phân tích mô tả:', {
        hasImages,
        containsBlob,
        descriptionLength: description.length
      });
      
      let imageProcessingFailed = false;
      let uploadError = null;
      
      if (hasImages && containsBlob) {
        console.log('Phát hiện hình ảnh blob trong mô tả, đang xử lý...');
        
        try {
          // Xử lý hình ảnh (upload và thay thế URL)
          console.log('Bắt đầu xử lý hình ảnh với imageService.processHtmlContent');
          processedDescription = await imageService.processHtmlContent(description);
          console.log('Xử lý hình ảnh hoàn tất, độ dài nội dung mới:', processedDescription.length);
          
          // Kiểm tra nếu còn blob URL trong processedDescription
          if (processedDescription.includes('blob:')) {
            console.warn('Vẫn còn URL blob trong nội dung sau khi xử lý, nhưng vẫn tiếp tục lưu');
            // Không đặt imageProcessingFailed = true để vẫn tiếp tục lưu
            
            // Thông báo cho người dùng
            setError('Lưu ý: Một số hình ảnh có thể chưa được tải lên. Bạn vẫn có thể lưu và tải lại hình ảnh sau.');
          } else {
            console.log('Đã xử lý xong hình ảnh trong mô tả.');
          }
        } catch (imageError) {
          console.error('Lỗi khi xử lý hình ảnh:', imageError);
          // Không đặt imageProcessingFailed = true để vẫn tiếp tục lưu
          
          // Kiểm tra lỗi cụ thể để hiển thị thông báo rõ ràng
          let errorMessage = 'Một số hình ảnh không thể tải lên, nhưng nội dung vẫn sẽ được lưu.';
          if (imageError instanceof Error) {
            const errorText = imageError.message;
            if (errorText.includes('File too large')) {
              errorMessage = 'Hình ảnh quá lớn. Vui lòng sử dụng ảnh có kích thước nhỏ hơn 5MB.';
              uploadError = 'File too large';
            } else {
              uploadError = errorText;
            }
          }
          
          // Hiển thị lỗi nhưng không dừng quá trình
          setError(`Lưu ý: ${errorMessage}`);
          
          // Vẫn sử dụng mô tả gốc để lưu, vì processHtmlContent có thể đã thất bại
          processedDescription = description;
        }
      } else if (hasImages) {
        console.log('Mô tả có hình ảnh nhưng không phải blob URL, không cần xử lý đặc biệt.');
      }

      // Không kiểm tra imageProcessingFailed nữa, luôn tiếp tục lưu
      // Chỉ gọi API update task khi đã xử lý xong hình ảnh
      console.log('Đang gửi yêu cầu cập nhật mô tả...');
      console.log('Độ dài của mô tả sau xử lý:', processedDescription.length);
      
      try {
        console.log('Gọi onUpdate với nội dung đã xử lý');
        const success = await onUpdate({ description: processedDescription });

        if (success) {
          console.log('Cập nhật mô tả thành công!');
          setIsEditing(false);
          setError(null);
          
          // Dọn dẹp hình ảnh không sử dụng sau khi đã lưu thành công
          if (hasImages) {
            console.log('Dọn dẹp hình ảnh không sử dụng');
            imageService.cleanupUnusedImages();
          }
        } else {
          console.error('Cập nhật mô tả thất bại từ API');
          setError('Không thể cập nhật mô tả. Vui lòng thử lại sau.');
        }
      } catch (updateError) {
        console.error('Lỗi khi gọi API cập nhật mô tả:', updateError);
        setError('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
      }
    } catch (error) {
      console.error('Lỗi khi cập nhật mô tả:', error);
      setError('Đã xảy ra lỗi không xác định. Vui lòng thử lại sau.');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Lưu mô tả bất kể lỗi xử lý hình ảnh
  const forceSaveDescription = async () => {
    try {
      setIsSaving(true);
      
      // Xóa tất cả các blob URL và thay thế bằng placeholder
      let cleanedDescription = description;
      if (description.includes('blob:')) {
        // Tạo một DOM parser để xử lý HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(description, 'text/html');
        
        // Tìm tất cả thẻ img có blob URL
        const images = doc.querySelectorAll('img[src^="blob:"]');
        images.forEach(img => {
          // Thay thế bằng placeholder hoặc xóa
          img.removeAttribute('src');
          img.setAttribute('alt', 'Hình ảnh không thể tải lên');
        });
        
        // Lấy nội dung HTML sau khi xử lý
        cleanedDescription = doc.body.innerHTML;
      }
      
      console.log('Đang gửi yêu cầu cập nhật mô tả (bỏ qua lỗi hình ảnh)...');
      const success = await onUpdate({ description: cleanedDescription });
      
      if (success) {
        console.log('Cập nhật mô tả thành công!');
        setIsEditing(false);
        setError(null);
        imageService.cleanupUnusedImages();
      } else {
        setError('Không thể cập nhật mô tả. Vui lòng thử lại sau.');
      }
    } catch (error) {
      console.error('Lỗi khi cập nhật mô tả:', error);
      setError('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`task-description ${className}`}>
      <h2 className="text-lg font-medium text-gray-900 mb-4">Mô tả</h2>
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm text-red-700">{error}</p>
              
              {/* Hiển thị các nút khi lỗi liên quan đến hình ảnh */}
              {error.includes('Lưu ý:') && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={cancelEditing}
                  >
                    Hủy
                  </Button>
                  <Button 
                    variant="primary" 
                    size="sm"
                    onClick={forceSaveDescription}
                  >
                    Lưu mô tả (bỏ hình ảnh)
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {isEditing ? (
        <div className="space-y-4">
          <AdvancedEditor
            value={description}
            onChange={(content) => {
              try {
                // Cập nhật nội dung và theo dõi hình ảnh
                setDescription(content);
                
                // Theo dõi hình ảnh đang sử dụng
                if (content.includes('<img')) {
                  imageService.trackImagesInContent(content);
                }
              } catch (error) {
                console.error('Lỗi khi cập nhật mô tả:', error);
              }
            }}
            placeholder="Thêm mô tả chi tiết về công việc..."
            mode="full"
          />
          
          <div className="flex justify-end space-x-2">
            {isSaving ? (
              <div className="flex items-center px-4 py-2">
                <Spinner size="sm" className="mr-2" />
                <span>Đang lưu...</span>
              </div>
            ) : (
              <>
                <Button 
                  variant="secondary" 
                  onClick={cancelEditing}
                >
                  Hủy
                </Button>
                <Button 
                  onClick={saveDescription}
                >
                  Lưu mô tả
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div>
          {task.description ? (
            <div 
              className="prose prose-sm max-w-none prose-img:rounded-md prose-img:my-2 prose-headings:mt-3 prose-headings:mb-2 prose-ul:list-disc prose-ul:pl-6 prose-ol:list-decimal prose-ol:pl-6 cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors group"
              onClick={startEditing}
              title="Nhấn để chỉnh sửa mô tả"
            >
              <div className="flex items-start justify-between">
                <div 
                  className="w-full rich-text-content"
                  dangerouslySetInnerHTML={{ __html: task.description }}
                />
                <PencilIcon className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ) : (
            <div 
              className="cursor-pointer text-gray-500 p-4 text-center border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={startEditing}
            >
              <p className="text-sm mb-2">Chưa có mô tả cho công việc này</p>
              <Button variant="secondary" size="sm">
                <PencilIcon className="h-4 w-4 mr-1" />
                Thêm mô tả
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 