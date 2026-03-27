import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type Supabase = SupabaseClient<Database>;

export const auditService = {
  /**
   * Fire-and-forget audit trail — do not await in resolver response path.
   */
  record(
    supabase: Supabase,
    entityType: string,
    entityId: string,
    action: string,
    oldData: unknown,
    newData: unknown,
    changedBy: string
  ) {
    supabase
      .from('document_audit')
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        action,
        old_data: oldData as never,
        new_data: newData as never,
        changed_by: changedBy,
      } as never)
      .then(({ error }) => {
        if (error) console.error('[Audit] Failed to record:', error);
      });
  },
};
