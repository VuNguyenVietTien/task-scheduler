import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type Supabase = SupabaseClient<Database>;

export const memberService = {
  async getMembers(supabase: Supabase, projectId: string) {
    const { data, error } = await supabase
      .from('project_members')
      .select('*, user:users(*)')
      .eq('project_id', projectId);
    if (error) throw error;
    return data;
  },

  async addMember(supabase: Supabase, input: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('project_members')
      .insert(input as never)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateMember(supabase: Supabase, projectId: string, userId: string, role: string) {
    const { data, error } = await supabase
      .from('project_members')
      .update({ role } as never)
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async removeMember(supabase: Supabase, projectId: string, userId: string) {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  },
};
