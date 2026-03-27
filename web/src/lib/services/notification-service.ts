import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type Supabase = SupabaseClient<Database>;

export const notificationService = {
  async getNotifications(supabase: Supabase, userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getNotificationCount(supabase: Supabase, userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .select('is_read')
      .eq('user_id', userId);
    if (error) throw error;
    const rows = data as { is_read: boolean }[];
    const total = rows.length;
    const unread = rows.filter((n) => !n.is_read).length;
    return { total, unread };
  },

  async markAsRead(supabase: Supabase, notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true } as never)
      .eq('notification_id', notificationId);
    if (error) throw error;
    return true;
  },

  async markAllAsRead(supabase: Supabase, userId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true } as never)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  },

  async createNotification(supabase: Supabase, input: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('notifications')
      .insert(input as never)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
