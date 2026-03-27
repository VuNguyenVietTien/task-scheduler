import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type Supabase = SupabaseClient<Database>;

export const externalLinkService = {
  async getExternalLinks(supabase: Supabase, documentId: string) {
    const { data, error } = await supabase
      .from('external_links')
      .select('*')
      .eq('document_id', documentId);
    if (error) throw error;
    return data;
  },

  async createExternalLink(supabase: Supabase, input: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('external_links')
      .insert(input as never)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteExternalLink(supabase: Supabase, id: string) {
    const { error } = await supabase.from('external_links').delete().eq('id', id);
    if (error) throw error;
    return true;
  },
};
