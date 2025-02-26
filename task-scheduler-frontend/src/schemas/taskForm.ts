import { z } from 'zod';

export const taskFormSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters'),
  description: z.string()
    .min(1, 'Description is required'),
  assignee: z.string()
    .min(1, 'Assignee is required'),
  deadline: z.string()
    .min(1, 'Deadline is required')
    .refine((date) => new Date(date) > new Date(), {
      message: 'Deadline must be in the future',
    }),
  category: z.string()
    .min(1, 'Category is required'),
  type: z.string()
    .min(1, 'Task type is required'),
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
