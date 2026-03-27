import { moduleService } from '@/services/module-service';
import { requireAuth } from '../utils/error-handler';
import type { GraphQLContext } from '../context';

export const moduleResolvers = {
  Query: {
    module: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return moduleService.getModule(ctx.supabaseAdmin, args.id);
    },
  },
  Mutation: {
    create_module: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return moduleService.createModule(ctx.supabaseAdmin, args.input);
    },
    update_module: async (_: unknown, args: { input: { id: string } & Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      const { id, ...rest } = args.input;
      return moduleService.updateModule(ctx.supabaseAdmin, id, rest);
    },
    delete_module: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return moduleService.deleteModule(ctx.supabaseAdmin, args.id);
    },
  },
  DesignModule: {
    documents: async (parent: { id: string }, _: unknown, ctx: GraphQLContext) => {
      const { documentService } = await import('@/services/document-service');
      return documentService.getDocuments(ctx.supabaseAdmin, parent.id);
    },
    tags: async (parent: { id: string }, _: unknown, ctx: GraphQLContext) => {
      const { tagService } = await import('@/services/tag-service');
      return tagService.getTags(ctx.supabaseAdmin, 'module', parent.id);
    },
  },
};
