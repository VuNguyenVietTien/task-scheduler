export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { commentService } from '@/lib/services/comment-service';

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { task_id, content } = await request.json();

    if (!task_id || !content) {
      return NextResponse.json({ error: 'task_id and content are required' }, { status: 400 });
    }

    const comment = await commentService.createComment(supabase, {
      task_id,
      content,
      user_id: user.id,
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error('Create comment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
