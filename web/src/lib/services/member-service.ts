import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type Supabase = SupabaseClient<Database>;

export const memberService = {
  async getMembers(supabase: Supabase, projectId: string) {
    const { data, error } = await supabase
      .from('project_members')
      .select('*, user:users!project_members_user_id_fkey(*)')
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

  async getMemberRole(supabase: Supabase, projectId: string, userId: string): Promise<string | null> {
    const { data } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();
    return data ? (data as { role: string }).role?.toUpperCase() ?? null : null;
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

  async getUserByEmail(supabase: Supabase, email: string): Promise<{ user_id: string; email: string; username: string; full_name: string | null; avatar_url: string | null } | null> {
    const { data } = await supabase
      .from('users')
      .select('user_id, email, username, full_name, avatar_url')
      .eq('email', email)
      .single();
    return (data as { user_id: string; email: string; username: string; full_name: string | null; avatar_url: string | null } | null) ?? null;
  },

  async isMember(supabase: Supabase, projectId: string, userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();
    return data !== null;
  },

  async getMember(supabase: Supabase, projectId: string, userId: string) {
    const { data, error } = await supabase
      .from('project_members')
      .select('*, user:users!project_members_user_id_fkey(*)')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  async updateMemberPosition(supabase: Supabase, projectId: string, userId: string, position: string | null) {
    const { data, error } = await supabase
      .from('project_members')
      .update({ position } as never)
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
