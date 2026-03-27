import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { notificationService } from '@/lib/services/notification-service';

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notifications = await notificationService.getNotifications(supabase, user.id);
    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
