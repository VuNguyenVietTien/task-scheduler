import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type Supabase = SupabaseClient<Database>;

export const attachmentService = {
  async getAttachments(supabase: Supabase, taskId: string) {
    const { data, error } = await supabase
      .from('attachments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createAttachment(supabase: Supabase, input: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('attachments')
      .insert(input as never)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteAttachment(supabase: Supabase, id: string) {
    const { error } = await supabase
      .from('attachments')
      .delete()
      .eq('attachment_id', id);
    if (error) throw error;
    return true;
  },
};
