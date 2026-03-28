import { notificationService } from '@/lib/services/notification-service';
import { requireAuth } from '../utils/error-handler';
import type { GraphQLContext } from '../context';

export const notificationResolvers = {
  Notification: {
    // Map DB column 'type' to schema field 'type_'
    type_: (parent: { type?: string | null }) => parent.type ?? null,
  },
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
    register_fcm_token: async (_: unknown, args: { token: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      // FCM token storage not yet implemented — silently succeed
      return true;
    },
  },
};
