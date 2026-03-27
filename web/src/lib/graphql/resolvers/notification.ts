import { notificationService } from '@/lib/services/notification-service';
import { requireAuth } from '../utils/error-handler';
import type { GraphQLContext } from '../context';

export const notificationResolvers = {
  Query: {
    notifications: async (_: unknown, _args: unknown, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      // Always use authenticated user's ID — prevent IDOR
      return notificationService.getNotifications(ctx.supabaseAdmin, ctx.user.id);
    },
    notification_count: async (_: unknown, _args: unknown, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return notificationService.getNotificationCount(ctx.supabaseAdmin, ctx.user.id);
    },
  },
  Mutation: {
    mark_notification_read: async (_: unknown, args: { notification_id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return notificationService.markAsRead(ctx.supabaseAdmin, args.notification_id);
    },
    mark_all_notifications_read: async (_: unknown, _args: unknown, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return notificationService.markAllAsRead(ctx.supabaseAdmin, ctx.user.id);
    },
  },
};
