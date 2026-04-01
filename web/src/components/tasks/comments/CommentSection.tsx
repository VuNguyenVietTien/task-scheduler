'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_TASK_COMMENTS } from '@/graphql/queries/tasks';
import { CREATE_TASK_COMMENT } from '@/graphql/mutations/tasks';
import { CommentCard, Comment as CommentType } from '@/components/common/CommentCard';
import { AdvancedEditor } from '@/components/common/AdvancedEditor';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { User } from '@/contexts/AuthContext';
import { imageService } from '@/services/imageService';
import { useTranslation } from 'react-i18next';

// Định nghĩa kiểu dữ liệu cho API Comment
interface ApiComment {
  id: string;
  content: string;
  authorId: string;
  username: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// Định nghĩa kiểu dữ liệu cho response của GET_TASK_COMMENTS
interface TaskCommentsData {
  taskComments: ApiComment[];
}

// Định nghĩa kiểu dữ liệu cho input của CREATE_COMMENT
interface CreateCommentInput {
  taskId: string;
  content: string;
}

// Định nghĩa kiểu dữ liệu cho response của CREATE_COMMENT
interface CreateCommentData {
  create_comment: ApiComment;
}

// Định nghĩa kiểu dữ liệu cho local comment
interface LocalComment extends CommentType {
  status: 'saved' | 'pending' | 'failed';
  error?: string;
}

// Props của component
interface CommentSectionProps {
  taskId: string;
  currentUser: User | null;
}

export default function CommentSection({ taskId, currentUser }: CommentSectionProps) {
  const { t } = useTranslation();
  const [comments, setComments] = useState<LocalComment[]>([]);
  const [newComment, setNewComment] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [localComments, setLocalComments] = useState<LocalComment[]>([]);
  const [isProcessingImages, setIsProcessingImages] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  
  // Query để lấy danh sách comments
  const { data: commentsData, loading: commentsLoading, error: commentsError, refetch } = useQuery<TaskCommentsData>(
    GET_TASK_COMMENTS,
    {
      variables: { taskId },
      fetchPolicy: 'cache-and-network',
      skip: !taskId,
    }
  );
  
  // Mutation để tạo comment mới
  const [createComment, { loading: createLoading }] = useMutation<CreateCommentData, { input: CreateCommentInput }>(
    CREATE_TASK_COMMENT
  );
  
  // Chuyển đổi từ API comment sang định dạng CommentType
  const mapApiToComment = (apiComment: ApiComment, status: 'saved' | 'pending' | 'failed' = 'saved'): LocalComment => ({
    id: apiComment.id,
    content: apiComment.content,
    user_id: apiComment.authorId,
    username: apiComment.username,
    avatar_url: apiComment.avatarUrl,
    created_at: apiComment.createdAt,
    updated_at: apiComment.updatedAt,
    task_id: taskId,
    status
  });
  
  // Cập nhật danh sách comments khi có dữ liệu mới
  useEffect(() => {
    if (commentsData?.taskComments) {
      // Format comments từ API
      const formattedComments = commentsData.taskComments.map(comment => 
        mapApiToComment(comment)
      );
      
      // Kết hợp comments từ API với local comments đang chờ xử lý
      const pendingOrFailedComments = localComments.filter(c => c.status === 'pending' || c.status === 'failed');
      
      setComments([...formattedComments, ...pendingOrFailedComments]);
      setLoading(false);
    }
  }, [commentsData, localComments, taskId]);
  
  // Cập nhật state loading
  useEffect(() => {
    setLoading(commentsLoading);
  }, [commentsLoading]);
  
  // Cập nhật state error
  useEffect(() => {
    if (commentsError) {
      setError('Không thể tải bình luận. Vui lòng thử lại sau.');
    } else {
      setError(null);
    }
  }, [commentsError]);

  // Hủy viết bình luận
  const cancelComment = () => {
    setNewComment('');
    setError(null);
    
    // Dọn dẹp hình ảnh không sử dụng
    imageService.cleanupUnusedImages();
  };

  // Xử lý hình ảnh trong nội dung comment
  const processCommentImages = async (content: string): Promise<string> => {
    if (!content || !content.includes('<img')) {
      // Không có hình ảnh
      return content;
    }

    // Đánh dấu hình ảnh đang sử dụng trước khi xử lý
    imageService.trackImagesInContent(content);

    setIsProcessingImages(true);
    
    try {
      // Kiểm tra đặc biệt cho blob URL
      const hasBlobImages = content.includes('blob:');
      
      if (!hasBlobImages) {
        console.log('Không phát hiện hình ảnh blob trong comment');
        return content;
      }
      
      console.log('Phát hiện hình ảnh blob trong bình luận, đang xử lý...');
      
      // Gọi service xử lý ảnh để upload và lấy URL thực từ server
      const processedContent = await imageService.processHtmlContent(content);
      console.log('Xử lý hình ảnh hoàn tất, độ dài nội dung mới:', processedContent.length);
      
      // Kiểm tra nếu còn blob URL trong processedContent
      if (processedContent.includes('blob:')) {
        console.warn('Vẫn còn URL blob trong nội dung sau khi xử lý, nhưng vẫn tiếp tục lưu');
        // Không ném lỗi để vẫn tiếp tục lưu
        
        // Thông báo cho người dùng
        setError('Lưu ý: Một số hình ảnh có thể chưa được tải lên. Bình luận vẫn sẽ được lưu.');
      } else {
        console.log('Đã xử lý xong hình ảnh trong bình luận.');
      }
      
      return processedContent;
    } catch (error) {
      console.error('Lỗi khi xử lý hình ảnh:', error);
      
      // Kiểm tra lỗi cụ thể để hiển thị thông báo rõ ràng
      let errorMessage = 'Một số hình ảnh không thể tải lên, nhưng bình luận vẫn sẽ được lưu.';
      if (error instanceof Error) {
        const errorText = error.message;
        if (errorText.includes('File too large')) {
          errorMessage = 'Hình ảnh quá lớn. Vui lòng sử dụng ảnh có kích thước nhỏ hơn 5MB.';
        }
      }
      
      // Hiển thị lỗi nhưng không dừng quá trình
      setError(`Lưu ý: ${errorMessage}`);
      
      // Vẫn trả về nội dung gốc để tiếp tục lưu
      return content;
    } finally {
      setIsProcessingImages(false);
    }
  };
  
  // Lưu bình luận bất kể lỗi xử lý hình ảnh
  const forceSendComment = async () => {
    if (!newComment || !newComment.trim() || !currentUser) return;
    
    try {
      setIsSending(true);
      
      // Xóa tất cả các blob URL và thay thế bằng placeholder
      let cleanedComment = newComment;
      if (newComment.includes('blob:')) {
        // Tạo một DOM parser để xử lý HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(newComment, 'text/html');
        
        // Tìm tất cả thẻ img có blob URL
        const images = doc.querySelectorAll('img[src^="blob:"]');
        images.forEach(img => {
          // Thay thế bằng placeholder hoặc xóa
          img.removeAttribute('src');
          img.setAttribute('alt', 'Hình ảnh không thể tải lên');
        });
        
        // Lấy nội dung HTML sau khi xử lý
        cleanedComment = doc.body.innerHTML;
      }
      
      console.log('Đang gửi yêu cầu tạo bình luận (bỏ qua lỗi hình ảnh)...');
      
      // Tạo một ID tạm thời cho comment đang chờ xử lý
      const tempId = `temp-${Date.now()}`;
      
      // Tạo comment tạm thời để hiển thị ngay lập tức
      const tempComment: LocalComment = {
        id: tempId,
        content: cleanedComment,
        user_id: currentUser.id || 'unknown',
        username: currentUser.name || currentUser.email || 'Người dùng',
        avatar_url: undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        task_id: taskId,
        status: 'pending'
      };
      
      // Thêm comment tạm thời vào state
      setLocalComments(prev => [...prev, tempComment]);
      
      try {
        const { data } = await createComment({
          variables: {
            input: {
              taskId,
              content: cleanedComment
            }
          }
        });
        
        if (data?.create_comment) {
          // Cập nhật state localComments, đánh dấu comment là đã lưu
          setLocalComments(prev => prev.map(c => 
            c.id === tempId 
              ? mapApiToComment(data.create_comment)
              : c
          ));
          
          // Xóa comment hiện tại
          setNewComment('');
          
          // Refresh lại danh sách comments
          refetch();
          
          // Dọn dẹp hình ảnh không sử dụng sau khi đã lưu thành công
          imageService.cleanupUnusedImages();
          
          // Xóa lỗi sau khi lưu thành công
          setError(null);
        }
      } catch (apiError) {
        console.error('Lỗi khi gọi API tạo bình luận:', apiError);
        
        // Cập nhật state localComments, đánh dấu comment là thất bại
        setLocalComments(prev => prev.map(c => 
          c.id === tempId 
            ? { ...c, status: 'failed', error: 'Không thể gửi bình luận. Vui lòng thử lại.' } 
            : c
        ));
      }
    } catch (error) {
      console.error('Lỗi khi tạo bình luận:', error);
      setError('Đã xảy ra lỗi không xác định. Vui lòng thử lại sau.');
    } finally {
      setIsSending(false);
    }
  };
  
  // Xử lý gửi comment mới
  const handleSubmitComment = async () => {
    if (!newComment || !newComment.trim() || !currentUser) return;
    
    try {
      setIsSending(true);
      setError(null);

      console.log('Bắt đầu gửi bình luận...');
      console.log('Nội dung bình luận:', newComment.substring(0, 100) + '...');
      
      // Kiểm tra và xử lý hình ảnh trước
      let processedComment = newComment;
      const hasImages = newComment.includes('<img');
      const containsBlob = newComment.includes('blob:');
      
      console.log('Phân tích bình luận:', {
        hasImages,
        containsBlob,
        commentLength: newComment.length
      });
      
      // Tạo một ID tạm thời cho comment đang chờ xử lý
      const tempId = `temp-${Date.now()}`;
      
      // Tạo comment tạm thời để hiển thị ngay lập tức
      const tempComment: LocalComment = {
        id: tempId,
        content: newComment, // Hiển thị với nội dung gốc (có blob URL)
        user_id: currentUser.id || 'unknown',
        username: currentUser.name || currentUser.email || 'Người dùng',
        avatar_url: undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        task_id: taskId,
        status: 'pending'
      };
      
      // Thêm comment tạm thời vào state
      setLocalComments(prev => [...prev, tempComment]);
      
      // Xử lý hình ảnh nếu có
      if (hasImages && containsBlob) {
        console.log('Phát hiện hình ảnh blob trong bình luận, đang xử lý...');
        
        try {
          // Xử lý hình ảnh (upload và thay thế URL)
          processedComment = await processCommentImages(newComment);
          
          // Kiểm tra nếu còn blob URL, nhưng vẫn tiếp tục
          if (processedComment.includes('blob:')) {
            console.warn('Vẫn còn URL blob trong nội dung sau khi xử lý.');
            
            // Xóa tất cả các blob URL và thay thế bằng placeholder
            const parser = new DOMParser();
            const doc = parser.parseFromString(processedComment, 'text/html');
            
            // Tìm tất cả thẻ img có blob URL
            const images = doc.querySelectorAll('img[src^="blob:"]');
            images.forEach(img => {
              // Thay thế bằng placeholder hoặc xóa
              img.removeAttribute('src');
              img.setAttribute('alt', 'Hình ảnh không thể tải lên');
            });
            
            // Lấy nội dung HTML sau khi xử lý
            processedComment = doc.body.innerHTML;
          } 
        } catch (imageError) {
          console.error('Lỗi khi xử lý hình ảnh:', imageError);
          
          // Xóa tất cả các blob URL và thay thế bằng placeholder
          const parser = new DOMParser();
          const doc = parser.parseFromString(processedComment, 'text/html');
          
          // Tìm tất cả thẻ img có blob URL
          const images = doc.querySelectorAll('img[src^="blob:"]');
          images.forEach(img => {
            // Thay thế bằng placeholder hoặc xóa
            img.removeAttribute('src');
            img.setAttribute('alt', 'Hình ảnh không thể tải lên');
          });
          
          // Lấy nội dung HTML sau khi xử lý
          processedComment = doc.body.innerHTML;
        }
      } else if (hasImages) {
        console.log('Bình luận có hình ảnh nhưng không phải blob URL, không cần xử lý đặc biệt.');
      }

      // Gọi API để tạo comment
      try {
        console.log('Gọi createComment với nội dung đã xử lý');
        const { data } = await createComment({
          variables: {
            input: {
              taskId,
              content: processedComment // Gửi nội dung đã xử lý hình ảnh
            }
          }
        });
        
        if (data?.create_comment) {
          // Cập nhật state localComments, đánh dấu comment là đã lưu
          setLocalComments(prev => prev.map(c => 
            c.id === tempId 
              ? mapApiToComment(data.create_comment) 
              : c
          ));
          
          console.log('Tạo bình luận thành công!');
          
          // Xóa bình luận hiện tại
          setNewComment('');
          
          // Refresh lại danh sách comments
          refetch();
          
          // Dọn dẹp hình ảnh không sử dụng sau khi đã lưu thành công
          if (hasImages) {
            console.log('Dọn dẹp hình ảnh không sử dụng');
            imageService.cleanupUnusedImages();
          }
          
          // Xóa lỗi nếu có
          setError(null);
        } else {
          console.error('Tạo bình luận thất bại từ API');
          
          // Cập nhật state localComments, đánh dấu comment là thất bại
          setLocalComments(prev => prev.map(c => 
            c.id === tempId 
              ? { ...c, status: 'failed', error: 'Không thể gửi bình luận. Vui lòng thử lại.' } 
              : c
          ));
        }
      } catch (updateError) {
        console.error('Lỗi khi gọi API tạo bình luận:', updateError);
        
        // Cập nhật state localComments, đánh dấu comment là thất bại
        setLocalComments(prev => prev.map(c => 
          c.id === tempId 
            ? { ...c, status: 'failed', error: 'Không thể gửi bình luận. Vui lòng thử lại.' } 
            : c
        ));
        
        setError('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
      }
    } catch (error) {
      console.error('Lỗi khi tạo bình luận:', error);
      setError('Đã xảy ra lỗi không xác định. Vui lòng thử lại sau.');
    } finally {
      setIsSending(false);
    }
  };
  
  // Xử lý thử lại gửi comment thất bại
  const handleRetryComment = async (commentId: string) => {
    const comment = localComments.find(c => c.id === commentId);
    if (!comment) return;
    
    // Cập nhật status thành pending
    setLocalComments(prev => prev.map(c => 
      c.id === commentId 
        ? { ...c, status: 'pending', error: undefined } 
        : c
    ));
    
    // Sử dụng lại logic từ handleSubmitComment
    try {
      setIsSending(true);
      setError(null);
      
      // Kiểm tra và xử lý hình ảnh trước
      let processedContent = comment.content;
      const hasImages = comment.content.includes('<img');
      const containsBlob = comment.content.includes('blob:');
      
      // Xử lý hình ảnh nếu có
      if (hasImages && containsBlob) {
        console.log('Phát hiện hình ảnh blob trong bình luận, đang xử lý...');
        
        try {
          // Xử lý hình ảnh (upload và thay thế URL)
          processedContent = await processCommentImages(comment.content);
          
          // Kiểm tra nếu còn blob URL, nhưng vẫn tiếp tục
          if (processedContent.includes('blob:')) {
            console.warn('Vẫn còn URL blob trong nội dung sau khi xử lý.');
            
            // Xóa tất cả các blob URL và thay thế bằng placeholder
            const parser = new DOMParser();
            const doc = parser.parseFromString(processedContent, 'text/html');
            
            // Tìm tất cả thẻ img có blob URL
            const images = doc.querySelectorAll('img[src^="blob:"]');
            images.forEach(img => {
              // Thay thế bằng placeholder hoặc xóa
              img.removeAttribute('src');
              img.setAttribute('alt', 'Hình ảnh không thể tải lên');
            });
            
            // Lấy nội dung HTML sau khi xử lý
            processedContent = doc.body.innerHTML;
          }
        } catch (imageError) {
          console.error('Lỗi khi xử lý hình ảnh:', imageError);
          
          // Xóa tất cả các blob URL và thay thế bằng placeholder
          const parser = new DOMParser();
          const doc = parser.parseFromString(processedContent, 'text/html');
          
          // Tìm tất cả thẻ img có blob URL
          const images = doc.querySelectorAll('img[src^="blob:"]');
          images.forEach(img => {
            // Thay thế bằng placeholder hoặc xóa
            img.removeAttribute('src');
            img.setAttribute('alt', 'Hình ảnh không thể tải lên');
          });
          
          // Lấy nội dung HTML sau khi xử lý
          processedContent = doc.body.innerHTML;
        }
      }
      
      // Gọi API để tạo comment
      try {
        console.log('Gọi createComment với nội dung đã xử lý');
        const { data } = await createComment({
          variables: {
            input: {
              taskId,
              content: processedContent
            }
          }
        });
        
        if (data?.create_comment) {
          // Cập nhật state localComments, đánh dấu comment là đã lưu
          setLocalComments(prev => prev.map(c => 
            c.id === commentId 
              ? mapApiToComment(data.create_comment) 
              : c
          ));
          
          console.log('Thử lại bình luận thành công!');
          
          // Refresh lại danh sách comments
          refetch();
          
          // Dọn dẹp hình ảnh không sử dụng sau khi đã lưu thành công
          if (hasImages) {
            console.log('Dọn dẹp hình ảnh không sử dụng');
            imageService.cleanupUnusedImages();
          }
          
          // Xóa lỗi
          setError(null);
        } else {
          console.error('Thử lại bình luận thất bại từ API');
          
          // Cập nhật state localComments, đánh dấu comment là thất bại
          setLocalComments(prev => prev.map(c => 
            c.id === commentId 
              ? { ...c, status: 'failed', error: 'Không thể gửi bình luận. Vui lòng thử lại.' } 
              : c
          ));
        }
      } catch (updateError) {
        console.error('Lỗi khi gọi API tạo bình luận:', updateError);
        
        // Cập nhật state localComments, đánh dấu comment là thất bại
        setLocalComments(prev => prev.map(c => 
          c.id === commentId 
            ? { ...c, status: 'failed', error: 'Không thể gửi bình luận. Vui lòng thử lại.' } 
            : c
        ));
      }
    } catch (error) {
      console.error('Lỗi khi thử lại bình luận:', error);
      
      // Cập nhật state localComments, đánh dấu comment là thất bại
      setLocalComments(prev => prev.map(c => 
        c.id === commentId 
          ? { ...c, status: 'failed', error: 'Không thể gửi bình luận. Vui lòng thử lại.' } 
          : c
      ));
    } finally {
      setIsSending(false);
    }
  };
  
  // Xử lý xóa comment thất bại
  const handleDeleteFailedComment = (commentId: string) => {
    setLocalComments(prev => prev.filter(c => c.id !== commentId));
  };
  
  // Render comment dựa vào status
  const renderComment = (comment: LocalComment) => {
    switch (comment.status) {
      case 'pending':
        return (
          <div className="opacity-60">
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 flex-shrink-0 rounded-full overflow-hidden bg-gray-200">
                  {comment.avatar_url ? (
                    <img
                      src={comment.avatar_url}
                      alt={`Avatar của ${comment.username}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-blue-500 text-white font-medium">
                      {comment.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {comment.username}
                    </h3>
                    <div className="flex items-center text-xs text-gray-500">
                      <span>{t('tasks.comments.submitting')}</span>
                      <Spinner size="sm" className="ml-2" />
                    </div>
                  </div>
                  <div
                    className="prose prose-sm max-w-none text-gray-700 overflow-auto"
                    dangerouslySetInnerHTML={{ __html: comment.content }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      case 'failed':
        return (
          <div className="border border-red-300 rounded-lg p-4 mb-4">
            <CommentCard
              comment={comment}
              currentUserId={currentUser?.id}
            />
            <div className="mt-2 flex items-center justify-end space-x-2">
              <div className="text-sm text-red-500">{comment.error}</div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleRetryComment(comment.id)}
              >
                {t('common.retry')}
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => handleDeleteFailedComment(comment.id)}
              >
                {t('common.delete')}
              </Button>
            </div>
          </div>
        );
      default:
        return (
          <CommentCard 
            comment={comment}
            currentUserId={currentUser?.id}
          />
        );
    }
  };
  
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-gray-900 mb-2">{t('tasks.comments.title')}</h2>
      
      {/* Hiển thị thông báo lỗi nếu có */}
      {error && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm text-yellow-700">{error}</p>
              
              {/* Hiển thị các nút khi lỗi liên quan đến hình ảnh */}
              {error.includes('Lưu ý:') && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={cancelComment}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={forceSendComment}
                  >
                    {t('tasks.comments.sendWithoutImages')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner size="md" />
        </div>
      ) : comments.length > 0 ? (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id}>
              {renderComment(comment)}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>{t('tasks.comments.noCommentsFirst')}</p>
        </div>
      )}
      
      <div className="mt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">{t('tasks.comments.addComment')}</h3>
        <div className="border border-gray-300 rounded-lg overflow-hidden">
          <AdvancedEditor
            value={newComment}
            onChange={(content) => {
              try {
                // Chỉ cập nhật nội dung, không theo dõi hình ảnh ở đây
                setNewComment(content);
              } catch (error) {
                console.error('Lỗi khi cập nhật nội dung:', error);
              }
            }}
            placeholder={t('tasks.comments.placeholderSimple')}
            mode="compact"
          />
          <div className="flex justify-end bg-gray-50 px-4 py-2">
            {isSending || isProcessingImages ? (
              <div className="flex items-center px-4 py-2">
                <Spinner size="sm" className="mr-2" />
                <span>{isProcessingImages ? t('tasks.comments.processingImages') : t('tasks.comments.submitting')}</span>
              </div>
            ) : (
              <Button
                onClick={handleSubmitComment}
                disabled={!newComment.trim()}
              >
                {t('tasks.comments.submit')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 