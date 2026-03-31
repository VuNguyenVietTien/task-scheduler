import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type Supabase = SupabaseClient<Database>;

export const commentService = {
  async getComment(supabase: Supabase, id: string) {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('comment_id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getTaskComments(supabase: Supabase, taskId: string) {
    const { data, error } = await supabase
      .from('comments')
      .select('*, user:users(full_name, avatar_url)')
      .eq('task_id', taskId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map((c: Record<string, unknown>) => {
      const user = c.user as { full_name?: string; avatar_url?: string } | null;
      return {
        id: c.comment_id,
        task_id: c.task_id,
        user_id: c.user_id,
        content: c.content,
        username: user?.full_name || '',
        avatar_url: user?.avatar_url || null,
        parent_comment_id: c.parent_comment_id || null,
        created_at: c.created_at,
        updated_at: c.updated_at,
        is_deleted: c.is_deleted,
      };
    });
  },

  async createComment(supabase: Supabase, input: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('comments')
      .insert(input as never)
      .select('*, user:users(full_name, avatar_url)')
      .single();
    if (error) throw error;
    const c = data as Record<string, unknown>;
    const user = c.user as { full_name?: string; avatar_url?: string } | null;
    return {
      id: c.comment_id,
      task_id: c.task_id,
      user_id: c.user_id,
      content: c.content,
      username: user?.full_name || '',
      avatar_url: user?.avatar_url || null,
      parent_comment_id: c.parent_comment_id || null,
      created_at: c.created_at,
      updated_at: c.updated_at,
      is_deleted: c.is_deleted,
    };
  },

  async deleteComment(supabase: Supabase, id: string) {
    const { error } = await supabase
      .from('comments')
      .update({ is_deleted: true } as never)
      .eq('comment_id', id);
    if (error) throw error;
    return true;
  },
};
