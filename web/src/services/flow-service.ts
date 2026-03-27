import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type Supabase = SupabaseClient<Database>;

export const flowService = {
  async getFlows(supabase: Supabase, documentId: string) {
    const { data, error } = await supabase
      .from('flows')
      .select('*')
      .eq('document_id', documentId)
      .order('position', { ascending: true });
    if (error) throw error;
    return data;
  },

  async createFlow(supabase: Supabase, input: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('flows')
      .insert(input as never)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateFlow(supabase: Supabase, id: string, input: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('flows')
      .update(input as never)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteFlow(supabase: Supabase, id: string) {
    const { error } = await supabase.from('flows').delete().eq('id', id);
    if (error) throw error;
    return true;
  },
};
