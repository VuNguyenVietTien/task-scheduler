import { z } from 'zod';

// Define project priority and visibility as enums
export const ProjectPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM', 
  HIGH: 'HIGH',
  URGENT: 'URGENT'
} as const;

export const ProjectVisibility = {
  PUBLIC: 'PUBLIC',
  PRIVATE: 'PRIVATE',
  TEAM: 'TEAM'
} as const;

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
  priority: z
    .enum([ProjectPriority.LOW, ProjectPriority.MEDIUM, ProjectPriority.HIGH, ProjectPriority.URGENT])
    .default(ProjectPriority.MEDIUM),
  visibility: z
    .enum([ProjectVisibility.PUBLIC, ProjectVisibility.PRIVATE, ProjectVisibility.TEAM])
    .default(ProjectVisibility.PRIVATE),
  tags: z
    .array(z.string().max(30, 'Tag must be less than 30 characters'))
    .max(10, 'Maximum 10 tags allowed')
    .default([])
});

export type ProjectFormData = z.infer<typeof projectFormSchema>;

export const validateProjectForm = (data: ProjectFormData) => {
  try {
    return {
      success: true,
      data: projectFormSchema.parse({
        ...data,
        tags: data.tags || [] // Ensure tags is always an array
      })
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
