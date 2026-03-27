import { componentService } from '@/services/component-service';
import { requireAuth } from '../utils/error-handler';
import type { GraphQLContext } from '../context';

export const componentResolvers = {
  Query: {
    components: async (_: unknown, args: { screen_id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return componentService.getComponents(ctx.supabaseAdmin, args.screen_id);
    },
  },
  Mutation: {
    create_component: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return componentService.createComponent(ctx.supabaseAdmin, args.input);
    },
    update_component: async (_: unknown, args: { input: { id: string } & Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      const { id, ...rest } = args.input;
      return componentService.updateComponent(ctx.supabaseAdmin, id, rest);
    },
    delete_component: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return componentService.deleteComponent(ctx.supabaseAdmin, args.id);
    },
  },
  Component: {
    field_mappings: async (parent: { id: string }, _: unknown, ctx: GraphQLContext) => {
      const { data } = await ctx.supabaseAdmin
        .from('field_mappings')
        .select('*')
        .eq('component_id', parent.id);
      return data || [];
    },
  },
};
