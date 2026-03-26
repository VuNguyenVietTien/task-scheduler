import { imageService } from "@/services/imageService";

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setSubmitting(true);
  
  try {
    // Kiểm tra và validate form
    const validationResult = taskFormSchema.safeParse(formState);
    
    if (!validationResult.success) {
      const errors = validationResult.error.format();
      setFormErrors(errors);
      return;
    }
    
    // Xử lý description để upload hình ảnh và thay thế URL trước khi lưu
    let processedDescription = formState.description;
    if (formState.description && formState.description.includes('img')) {
      processedDescription = await imageService.processHtmlContent(formState.description);
    }
    
    // Chuẩn bị dữ liệu để lưu
    const taskData = {
      ...formState,
      description: processedDescription
    };
    
    // Gọi hàm lưu từ props
    if (onSave) {
      await onSave(taskData);
    }
    
    // Reset form nếu cần
    if (resetOnSubmit) {
      setFormState(initialState);
    }
    
    setSubmitting(false);
  } catch (error) {
    console.error("Error submitting form:", error);
    setSubmitting(false);
  }
}; 