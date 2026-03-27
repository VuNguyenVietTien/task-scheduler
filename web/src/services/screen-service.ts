import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type Supabase = SupabaseClient<Database>;

export const screenService = {
  async getScreens(supabase: Supabase, documentId: string) {
    const { data, error } = await supabase
      .from('screens')
      .select('*')
      .eq('document_id', documentId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data;
  },

  async getScreen(supabase: Supabase, id: string) {
    const { data, error } = await supabase
      .from('screens')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async createScreen(supabase: Supabase, input: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('screens')
      .insert(input as never)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateScreen(supabase: Supabase, id: string, input: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('screens')
      .update(input as never)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteScreen(supabase: Supabase, id: string) {
    const { error } = await supabase.from('screens').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async pasteDesign(supabase: Supabase, input: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('screens')
      .insert({
        name: input.name ?? 'Pasted Design',
        document_id: input.document_id,
        svg_content: input.svg_content ?? input.content,
        content_type: input.content_type ?? 'svg',
        sort_order: input.sort_order ?? input.position ?? 0,
        metadata: input.metadata ?? null,
      } as never)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
