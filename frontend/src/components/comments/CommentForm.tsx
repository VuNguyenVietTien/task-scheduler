import { imageService } from "@/services/imageService";

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!content.trim()) return;
  
  setSubmitting(true);
  
  try {
    // Xử lý nội dung để upload hình ảnh và thay thế URL
    let processedContent = content;
    if (content.includes('img')) {
      processedContent = await imageService.processHtmlContent(content);
    }
    
    // Gọi onSubmit với nội dung đã xử lý
    if (onSubmit) {
      await onSubmit(processedContent);
    }
    
    // Reset content
    if (!isEdit) {
      setContent('');
    }
  } catch (error) {
    console.error('Error submitting comment:', error);
  } finally {
    setSubmitting(false);
  }
}; 