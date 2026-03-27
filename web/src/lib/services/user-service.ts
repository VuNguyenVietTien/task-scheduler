import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type Supabase = SupabaseClient<Database>;

export const userService = {
  async getUser(supabase: Supabase, id: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getUserByEmail(supabase: Supabase, email: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    if (error) throw error;
    return data;
  },

  async getUsers(supabase: Supabase, ids: string[]) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .in('user_id', ids);
    if (error) throw error;
    return data;
  },
};
