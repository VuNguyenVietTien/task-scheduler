export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { attachmentService } from '@/lib/services/attachment-service';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ 'attachment-id': string }> }
) {
  try {
    const { 'attachment-id': attachmentId } = await params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the specific attachment record directly
    const { data: attachment, error: fetchError } = await supabase
      .from('attachments')
      .select('*')
      .eq('id', attachmentId)
      .single();

    if (fetchError || !attachment) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const row = attachment as { id: string; user_id: string; file_url: string };

    if (row.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Extract storage path from public URL
    const url = new URL(row.file_url);
    const storagePath = url.pathname.split('/attachments/')[1];

    if (storagePath) {
      await supabase.storage.from('attachments').remove([storagePath]);
    }

    await attachmentService.deleteAttachment(supabase, attachmentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete attachment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
