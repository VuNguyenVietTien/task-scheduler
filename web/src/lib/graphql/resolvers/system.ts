import { systemService } from '@/services/system-service';
import { requireAuth } from '../utils/error-handler';
import type { GraphQLContext } from '../context';

export const systemResolvers = {
  Query: {
    systems: async (_: unknown, args: { project_id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return systemService.getSystems(ctx.supabaseAdmin, args.project_id);
    },
    system: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return systemService.getSystem(ctx.supabaseAdmin, args.id);
    },
  },
  Mutation: {
    create_system: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return systemService.createSystem(ctx.supabaseAdmin, { ...args.input, created_by: ctx.user.id });
    },
    update_system: async (_: unknown, args: { input: { id: string } & Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      const { id, ...rest } = args.input;
      return systemService.updateSystem(ctx.supabaseAdmin, id, rest);
    },
    delete_system: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return systemService.deleteSystem(ctx.supabaseAdmin, args.id);
    },
  },
  DesignSystem: {
    modules: async (parent: { id: string }, _: unknown, ctx: GraphQLContext) => {
      const { moduleService } = await import('@/services/module-service');
      return moduleService.getModules(ctx.supabaseAdmin, parent.id);
    },
    tags: async (parent: { id: string }, _: unknown, ctx: GraphQLContext) => {
      const { tagService } = await import('@/services/tag-service');
      return tagService.getTags(ctx.supabaseAdmin, 'system', parent.id);
    },
  },
};
