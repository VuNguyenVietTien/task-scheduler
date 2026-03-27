import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { commentService } from '@/lib/services/comment-service';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ 'comment-id': string }> }
) {
  try {
    const { 'comment-id': commentId } = await params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content } = await request.json();
    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    // Verify ownership before update
    const existing = await commentService.getComment(supabase, commentId) as { user_id: string };
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('comments')
      .update({ content } as never)
      .eq('id', commentId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ comment: data });
  } catch (error) {
    console.error('Update comment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ 'comment-id': string }> }
) {
  try {
    const { 'comment-id': commentId } = await params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership before delete
    const existing = await commentService.getComment(supabase, commentId) as { user_id: string };
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await commentService.deleteComment(supabase, commentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete comment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
