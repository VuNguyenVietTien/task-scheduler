import { commentService } from '@/lib/services/comment-service';
import { requireAuth } from '../utils/error-handler';
import type { GraphQLContext } from '../context';

export const commentResolvers = {
  Query: {
    comment: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return commentService.getComment(ctx.supabaseAdmin, args.id);
    },
    task_comments: async (_: unknown, args: { task_id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return commentService.getTaskComments(ctx.supabaseAdmin, args.task_id);
    },
  },
  Mutation: {
    create_comment: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return commentService.createComment(ctx.supabaseAdmin, { ...args.input, user_id: ctx.user.id });
    },
    delete_comment: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return commentService.deleteComment(ctx.supabaseAdmin, args.id);
    },
  },
};
