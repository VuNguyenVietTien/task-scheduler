import { z } from 'zod';
import { TaskStatus } from '@/types/task';

export const taskFormSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters'),
  description: z.string()
    .min(1, 'Description is required'),
  status: z.nativeEnum(TaskStatus)
    .default(TaskStatus.PLANNED),
  priority: z.enum(['high', 'medium', 'low'])
    .default('medium'),
  effortHours: z.number()
    .min(0, 'Effort hours must be positive')
    .optional(),
  startDate: z.string()
    .optional(),
  deadline: z.string()
    .min(1, 'Deadline is required')
    .refine((date) => new Date(date) > new Date(), {
      message: 'Deadline must be in the future',
    }),
  assigneeIds: z.array(z.string())
    .min(1, 'At least one assignee is required')
});

export type TaskFormData = z.infer<typeof taskFormSchema>;
export type TaskFormSchema = TaskFormData;

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
