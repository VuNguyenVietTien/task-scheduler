import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type Supabase = SupabaseClient<Database>;

export const moduleService = {
  async getModules(supabase: Supabase, systemId: string) {
    const { data, error } = await supabase
      .from('modules')
      .select('*')
      .eq('system_id', systemId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data;
  },

  async getModule(supabase: Supabase, id: string) {
    const { data, error } = await supabase
      .from('modules')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async createModule(supabase: Supabase, input: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('modules')
      .insert(input as never)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateModule(supabase: Supabase, id: string, input: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('modules')
      .update(input as never)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteModule(supabase: Supabase, id: string) {
    const { error } = await supabase.from('modules').delete().eq('id', id);
    if (error) throw error;
    return true;
  },
};
