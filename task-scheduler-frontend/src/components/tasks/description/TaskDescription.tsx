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
      
      // Kiểm tra xem có hình ảnh cần xử lý không
      let processedDescription = description;
      
      if (description.includes('<img')) {
        console.log('Phát hiện hình ảnh trong mô tả, đang xử lý...');
        
        // Xử lý hình ảnh (upload và thay thế URL)
        processedDescription = await imageService.processHtmlContent(description);
        
        // Dọn dẹp hình ảnh không sử dụng
        imageService.cleanupUnusedImages();
        
        console.log('Đã xử lý xong hình ảnh trong mô tả.');
      }

      // Gọi hàm update từ props với nội dung đã xử lý
      console.log('Đang gửi yêu cầu cập nhật mô tả...');
      const success = await onUpdate({ description: processedDescription });

      if (success) {
        console.log('Cập nhật mô tả thành công!');
        setIsEditing(false);
      } else {
        console.error('Cập nhật mô tả thất bại từ API');
        setError('Không thể cập nhật mô tả. Vui lòng thử lại sau.');
      }
    } catch (error) {
      console.error('Lỗi khi cập nhật mô tả:', error);
      setError('Đã xảy ra lỗi. Vui lòng thử lại sau.');
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
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
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
              className="prose prose-sm max-w-none prose-img:rounded-md prose-img:my-2 prose-headings:mt-3 prose-headings:mb-2 cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors group"
              onClick={startEditing}
              title="Nhấn để chỉnh sửa mô tả"
            >
              <div className="flex items-start justify-between">
                <div 
                  className="w-full"
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