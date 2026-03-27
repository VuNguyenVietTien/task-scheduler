import { tagService } from '@/services/tag-service';
import { requireAuth } from '../utils/error-handler';
import type { GraphQLContext } from '../context';

export const tagResolvers = {
  Query: {
    tags: async (_: unknown, args: { entity_type: string; entity_id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return tagService.getTags(ctx.supabaseAdmin, args.entity_type, args.entity_id);
    },
  },
  Mutation: {
    create_tag: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return tagService.createTag(ctx.supabaseAdmin, args.input);
    },
    delete_tag: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return tagService.deleteTag(ctx.supabaseAdmin, args.id);
    },
  },
};
