import { screenService } from '@/services/screen-service';
import { requireAuth } from '../utils/error-handler';
import type { GraphQLContext } from '../context';

export const screenResolvers = {
  Query: {
    screens: async (_: unknown, args: { document_id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return screenService.getScreens(ctx.supabaseAdmin, args.document_id);
    },
    screen: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return screenService.getScreen(ctx.supabaseAdmin, args.id);
    },
  },
  Mutation: {
    create_screen: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return screenService.createScreen(ctx.supabaseAdmin, args.input);
    },
    update_screen: async (_: unknown, args: { input: { id: string } & Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      const { id, ...rest } = args.input;
      return screenService.updateScreen(ctx.supabaseAdmin, id, rest);
    },
    delete_screen: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return screenService.deleteScreen(ctx.supabaseAdmin, args.id);
    },
    paste_design: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return screenService.pasteDesign(ctx.supabaseAdmin, args.input);
    },
  },
  Screen: {
    components: async (parent: { id: string }, _: unknown, ctx: GraphQLContext) => {
      const { componentService } = await import('@/services/component-service');
      return componentService.getComponents(ctx.supabaseAdmin, parent.id);
    },
    tags: async (parent: { id: string }, _: unknown, ctx: GraphQLContext) => {
      const { tagService } = await import('@/services/tag-service');
      return tagService.getTags(ctx.supabaseAdmin, 'screen', parent.id);
    },
  },
};
