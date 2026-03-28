import { z } from 'zod';

export const taskFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  assignee: z.string().optional(),
  deadline: z.string().optional(),
  category: z.string().optional(),
  type: z.string().optional(),
  effort: z.number().optional(),
  progressType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  parentTaskId: z.string().optional(),
  status: z.enum([
    'TODO',
    'DOING',
    'DONE',
    'CLOSE',
    'PENDING',
    'REVIEW',
    'BLOCKED',
    'REJECTED',
    'ARCHIVED'
  ]),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL']),
  priorityOrder: z.number()
});

export const progressTypeOptions = [
  'not_started',
  'in_progress',
  'completed',
  'blocked',
  'on_hold'
];

export type TaskFormSchema = z.infer<typeof taskFormSchema>;