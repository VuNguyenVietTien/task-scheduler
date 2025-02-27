import { z } from 'zod';

export const projectFormSchema = z.object({
  name: z
    .string()
    .min(3, 'Project name must be at least 3 characters')
    .max(100, 'Project name must be less than 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional()
    .nullable(),
  dueDate: z
    .string()
    .refine((date) => {
      const currentDate = new Date().toISOString().split('T')[0];
      return date >= currentDate;
    }, 'Due date cannot be in the past'),
  members: z
    .number()
    .min(1, 'At least one team member is required')
    .max(50, 'Team size cannot exceed 50 members')
});

export type ProjectFormData = z.infer<typeof projectFormSchema>;

export const validateProjectForm = (data: ProjectFormData) => {
  try {
    return {
      success: true,
      data: projectFormSchema.parse(data)
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message
      }));
      return {
        success: false,
        errors
      };
    }
    return {
      success: false,
      errors: [{ path: 'form', message: 'Invalid form data' }]
    };
  }
};
