import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type Supabase = SupabaseClient<Database>;

export const componentService = {
  async getComponents(supabase: Supabase, screenId: string) {
    const { data, error } = await supabase
      .from('components')
      .select('*, field_mappings(*)')
      .eq('screen_id', screenId);
    if (error) throw error;
    return data;
  },

  async createComponent(supabase: Supabase, input: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('components')
      .insert(input as never)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateComponent(supabase: Supabase, id: string, input: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('components')
      .update(input as never)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteComponent(supabase: Supabase, id: string) {
    const { error } = await supabase.from('components').delete().eq('id', id);
    if (error) throw error;
    return true;
  },
};
