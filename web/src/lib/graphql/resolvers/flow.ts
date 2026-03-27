import { flowService } from '@/services/flow-service';
import { requireAuth } from '../utils/error-handler';
import type { GraphQLContext } from '../context';

export const flowResolvers = {
  Query: {
    flows: async (_: unknown, args: { document_id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return flowService.getFlows(ctx.supabaseAdmin, args.document_id);
    },
  },
  Mutation: {
    create_flow: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return flowService.createFlow(ctx.supabaseAdmin, args.input);
    },
    update_flow: async (_: unknown, args: { input: { id: string } & Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      const { id, ...rest } = args.input;
      return flowService.updateFlow(ctx.supabaseAdmin, id, rest);
    },
    delete_flow: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return flowService.deleteFlow(ctx.supabaseAdmin, args.id);
    },
  },
};
