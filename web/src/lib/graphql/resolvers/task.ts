import { taskService } from '@/lib/services/task-service';
import { userService } from '@/lib/services/user-service';
import { requireAuth } from '../utils/error-handler';
import type { GraphQLContext } from '../context';

export const taskResolvers = {
  Query: {
    task: async (_: unknown, args: { task_id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return taskService.getTask(ctx.supabaseAdmin, args.task_id);
    },
    tasks: async (_: unknown, args: { project_id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return taskService.getTasksForProject(ctx.supabaseAdmin, args.project_id);
    },
    task_subtasks: async (_: unknown, args: { task_id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return taskService.getSubtasks(ctx.supabaseAdmin, args.task_id);
    },
  },
  Mutation: {
    create_task: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return taskService.createTask(ctx.supabaseAdmin, { ...args.input, creator_id: ctx.user.id });
    },
    update_task: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      const { task_id, ...rest } = args.input;
      return taskService.updateTask(ctx.supabaseAdmin, task_id as string, rest);
    },
    update_task_status: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      const { task_id, status } = args.input;
      return taskService.updateTaskStatus(ctx.supabaseAdmin, task_id as string, status as string);
    },
    update_task_effort: async (_: unknown, args: { task_id: string; effort: number }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return taskService.updateTaskEffort(ctx.supabaseAdmin, args.task_id, args.effort);
    },
    delete_task: async (_: unknown, args: { task_id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return taskService.deleteTask(ctx.supabaseAdmin, args.task_id);
    },
    reorder_tasks: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      const tasks = args.input.tasks as { task_id: string; priority_order: number }[];
      return taskService.reorderTasks(ctx.supabaseAdmin, tasks);
    },
  },
  Task: {
    assignee: async (parent: { assignee_id?: string | null }, _: unknown, ctx: GraphQLContext) => {
      if (!parent.assignee_id) return null;
      return userService.getUser(ctx.supabaseAdmin, parent.assignee_id);
    },
    creator: async (parent: { creator_id?: string | null }, _: unknown, ctx: GraphQLContext) => {
      if (!parent.creator_id) return null;
      return userService.getUser(ctx.supabaseAdmin, parent.creator_id);
    },
    child_tasks: async (parent: { id: string }, _: unknown, ctx: GraphQLContext) => {
      return taskService.getSubtasks(ctx.supabaseAdmin, parent.id);
    },
  },
};
