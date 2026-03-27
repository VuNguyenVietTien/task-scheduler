import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type Supabase = SupabaseClient<Database>;

export const systemService = {
  async getSystems(supabase: Supabase, projectId: string) {
    const { data, error } = await supabase
      .from('systems')
      .select('*')
      .eq('project_id', projectId);
    if (error) throw error;
    return data;
  },

  async getSystem(supabase: Supabase, id: string) {
    const { data, error } = await supabase
      .from('systems')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async createSystem(supabase: Supabase, input: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('systems')
      .insert(input as never)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateSystem(supabase: Supabase, id: string, input: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('systems')
      .update(input as never)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteSystem(supabase: Supabase, id: string) {
    const { error } = await supabase.from('systems').delete().eq('id', id);
    if (error) throw error;
    return true;
  },
};
