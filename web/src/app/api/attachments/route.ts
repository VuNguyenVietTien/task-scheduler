export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { attachmentService } from '@/lib/services/attachment-service';

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const taskId = formData.get('task_id') as string | null;

    if (!file || !taskId) {
      return NextResponse.json({ error: 'file and task_id are required' }, { status: 400 });
    }

    // Upload file to Supabase Storage bucket 'attachments'
    const fileExt = file.name.split('.').pop();
    const storagePath = `${taskId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(storagePath, file, { contentType: file.type });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('attachments')
      .getPublicUrl(storagePath);

    const attachment = await attachmentService.createAttachment(supabase, {
      task_id: taskId,
      user_id: user.id,
      file_name: file.name,
      file_url: publicUrl,
      file_size: file.size,
      mime_type: file.type,
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    console.error('Upload attachment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
