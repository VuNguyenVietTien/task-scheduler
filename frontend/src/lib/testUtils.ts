import { CreateTaskInput, TaskDiagnosticResponse } from '@/types/task';

export async function validateTaskFormData(formData: FormData): Promise<{ isValid: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Basic validation example - expand as needed
  if (!formData.get('title')) {
    errors.push('Title is required');
  }

  if (formData.get('priority') && !['LOW', 'MEDIUM', 'HIGH'].includes(formData.get('priority') as string)) {
    errors.push('Invalid priority value');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export async function testFormSubmission(projectId: string, formData: FormData): Promise<TaskDiagnosticResponse> {
  const result: TaskDiagnosticResponse = {
    success: false,
    status: 'error',
    message: '',
    error: '',
    database_status: 'pending'
  };

  // Validate form data
  const { isValid, errors } = await validateTaskFormData(formData);
  
  if (!isValid) {
    result.success = false;
    result.message = 'Form validation failed';
    result.error = errors.join(', ');
    return result;
  }

  result.success = true;
  result.status = 'success';
  result.message = 'Form validation passed';
  
  return result;
}

export async function validateCreateTaskInput(input: CreateTaskInput): Promise<{ isValid: boolean; errors: string[] }> {
  const errors: string[] = [];

  if (!input.title) {
    errors.push('Title is required');
  }

  if (input.effort_hours && input.effort_hours < 0) {
    errors.push('Effort hours must be non-negative');
  }

  if (input.start_date && input.deadline) {
    const start = new Date(input.start_date);
    const end = new Date(input.deadline);
    if (start > end) {
      errors.push('Start date cannot be after deadline');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function generateTestResponse(success: boolean, withError = false): TaskDiagnosticResponse {
  if (success) {
    return {
      success: true,
      status: 'success',
      database_status: 'connected',
      message: 'Test completed successfully'
    };
  }

  if (withError) {
    return {
      success: false,
      status: 'error',
      database_status: 'error',
      message: 'Test failed with error',
      error: 'An error occurred during testing'
    };
  }

  return {
    success: false,
    status: 'error',
    database_status: 'pending',
    message: 'Test failed'
  };
}
