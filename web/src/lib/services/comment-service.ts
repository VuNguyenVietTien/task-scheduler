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
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  async createComment(supabase: Supabase, input: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('comments')
      .insert(input as never)
      .select()
      .single();
    if (error) throw error;
    return data;
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
