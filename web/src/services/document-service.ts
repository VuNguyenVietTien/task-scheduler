import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { auditService } from './audit-service';

type Supabase = SupabaseClient<Database>;
type DocumentRow = Database['public']['Tables']['design_documents']['Row'];

export const documentService = {
  async getDocuments(supabase: Supabase, moduleId: string) {
    const { data, error } = await supabase
      .from('design_documents')
      .select('*')
      .eq('module_id', moduleId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  async getDocument(supabase: Supabase, id: string) {
    const { data, error } = await supabase
      .from('design_documents')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async createDocument(supabase: Supabase, input: Record<string, unknown>, userId: string) {
    const { data, error } = await supabase
      .from('design_documents')
      .insert(input as never)
      .select()
      .single() as { data: DocumentRow | null; error: unknown };
    if (error) throw error;
    auditService.record(supabase, 'document', (data as DocumentRow).id, 'create', null, data, userId);
    return data;
  },

  async updateDocument(supabase: Supabase, id: string, input: Record<string, unknown>, userId: string) {
    const { data: oldData } = await supabase
      .from('design_documents')
      .select('*')
      .eq('id', id)
      .single();

    const { data, error } = await supabase
      .from('design_documents')
      .update(input as never)
      .eq('id', id)
      .select()
      .single() as { data: DocumentRow | null; error: unknown };
    if (error) throw error;
    auditService.record(supabase, 'document', id, 'update', oldData, data, userId);
    return data;
  },

  async deleteDocument(supabase: Supabase, id: string) {
    const { error } = await supabase.from('design_documents').delete().eq('id', id);
    if (error) throw error;
    return true;
  },
};
