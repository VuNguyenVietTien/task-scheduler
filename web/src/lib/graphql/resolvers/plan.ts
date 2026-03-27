import { planService } from '@/lib/services/plan-service';
import { requireAuth } from '../utils/error-handler';
import type { GraphQLContext } from '../context';

export const planResolvers = {
  Query: {
    get_project_plans: async (_: unknown, args: { project_id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return planService.getProjectPlans(ctx.supabaseAdmin, args.project_id);
    },
    get_latest_project_plan: async (_: unknown, args: { project_id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return planService.getLatestPlan(ctx.supabaseAdmin, args.project_id);
    },
    get_plan: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return planService.getPlan(ctx.supabaseAdmin, args.id);
    },
  },
  Mutation: {
    create_plan: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return planService.createPlan(ctx.supabaseAdmin, args.input);
    },
    update_plan: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      const { id, ...rest } = args.input;
      return planService.updatePlan(ctx.supabaseAdmin, id as string, rest);
    },
  },
};
