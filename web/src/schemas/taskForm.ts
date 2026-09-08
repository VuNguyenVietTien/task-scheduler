import { z } from 'zod';

export const taskFormSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters'),
  description: z.string()
    .min(1, 'Description is required'),
  assignee: z.string()
    .min(1, 'Assignee is required'),
  dueDate: z.string()
    .min(1, 'Due date is required')
    .refine((date) => new Date(date) > new Date(), {
      message: 'Due date must be in the future',
    }),
  category: z.string()
    .min(1, 'Category is required'),
  type: z.string()
    .min(1, 'Task type is required'),
  effort: z.number()
    .min(0, 'Effort must be positive')
    .optional(),
  progressType: z.enum([
    'study',
    'investigate',
    'code',
    'test',
    'review_code',
    'review_test_report',
    'release'
  ], {
    required_error: 'Progress type is required',
  }),
  status: z.enum([
    'TODO',
    'DOING',
    'DONE',
    'CLOSE',
    'PENDING',
    'REVIEW',
    'BLOCKED',
    'ARCHIVED'
  ], {
    required_error: 'Status is required',
  }),
  priority: z.enum([
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT',
    'CRITICAL'
  ], {
    required_error: 'Priority is required',
  }),
  priorityOrder: z.number()
    .min(0, 'Priority order must be positive')
    .default(0),
  tags: z.array(z.string())
    .default([])
    .refine((tags) => tags.length <= 5, {
      message: 'Maximum 5 tags allowed',
    }),
});

export type TaskFormData = z.infer<typeof taskFormSchema>;

export const taskTypeOptions = [
  'Feature',
  'Bug',
  'Enhancement',
  'Documentation',
] as const;

export const categoryOptions = [
  'Frontend',
  'Backend',
  'Design',
  'Testing',
  'DevOps',
] as const;

export const tagOptions = [
  'Urgent',
  'High Priority',
  'Low Priority',
  'In Progress',
  'Blocked',
] as const;

export const progressTypeOptions = [
  'study',
  'investigate',
  'code',
  'test',
  'review_code',
  'review_test_report',
  'release'
] as const;

export const statusOptions = [
  'TODO',
  'DOING',
  'DONE',
  'CLOSE',
  'PENDING',
  'REVIEW',
  'BLOCKED',
  'ARCHIVED'
] as const;

export const priorityOptions = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
  'CRITICAL'
] as const;
