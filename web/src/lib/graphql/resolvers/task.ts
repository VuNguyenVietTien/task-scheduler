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
    tasks: async (_: unknown, args: { project_id?: string; assignee_id?: string; status?: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return taskService.getTasks(ctx.supabaseAdmin, args);
    },
    task_subtasks: async (_: unknown, args: { task_id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return taskService.getSubtasks(ctx.supabaseAdmin, args.task_id);
    },
  },
  Mutation: {
    create_task: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      const input = {
        ...args.input,
        created_by: ctx.user.id,
        // DB enums are lowercase
        ...(args.input.status && { status: (args.input.status as string).toLowerCase() }),
        ...(args.input.priority && { priority: (args.input.priority as string).toLowerCase() }),
        ...(args.input.progress_type && { progress_type: (args.input.progress_type as string).toLowerCase() }),
      };
      return taskService.createTask(ctx.supabaseAdmin, input);
    },
    update_task: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      const { task_id, ...rest } = args.input;
      const input = {
        ...rest,
        ...(rest.status && { status: (rest.status as string).toLowerCase() }),
        ...(rest.priority && { priority: (rest.priority as string).toLowerCase() }),
        ...(rest.progress_type && { progress_type: (rest.progress_type as string).toLowerCase() }),
      };
      return taskService.updateTask(ctx.supabaseAdmin, task_id as string, input);
    },
    update_task_status: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      const { task_id, status } = args.input;
      return taskService.updateTaskStatus(ctx.supabaseAdmin, task_id as string, (status as string).toLowerCase());
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
    // Map DB column 'type' to schema field 'type_'
    type_: (parent: { type?: string | null }) => parent.type ?? null,
    // Convert lowercase DB enum values to uppercase for GraphQL schema
    status: (parent: { status?: string | null }) => parent.status?.toUpperCase() ?? null,
    priority: (parent: { priority?: string | null }) => parent.priority?.toUpperCase() ?? null,
    progress_type: (parent: { progress_type?: string | null }) => parent.progress_type?.toUpperCase() ?? null,
    assignee: async (parent: { assignee_id?: string | null }, _: unknown, ctx: GraphQLContext) => {
      if (!parent.assignee_id) return null;
      return userService.getUser(ctx.supabaseAdmin, parent.assignee_id);
    },
    creator: async (parent: { created_by?: string | null }, _: unknown, ctx: GraphQLContext) => {
      if (!parent.created_by) return null;
      return userService.getUser(ctx.supabaseAdmin, parent.created_by);
    },
    child_tasks: async (parent: { task_id: string }, _: unknown, ctx: GraphQLContext) => {
      return taskService.getSubtasks(ctx.supabaseAdmin, parent.task_id);
    },
  },
};
