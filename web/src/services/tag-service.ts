import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type Supabase = SupabaseClient<Database>;

export const tagService = {
  async getTags(supabase: Supabase, entityType: string, entityId: string) {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);
    if (error) throw error;
    return data;
  },

  async createTag(supabase: Supabase, input: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('tags')
      .insert(input as never)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteTag(supabase: Supabase, id: string) {
    const { error } = await supabase.from('tags').delete().eq('id', id);
    if (error) throw error;
    return true;
  },
};
