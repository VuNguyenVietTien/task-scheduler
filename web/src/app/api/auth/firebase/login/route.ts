export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { firebase_token, email, name, firebase_uid } = await request.json();

    if (!firebase_token || !email || !firebase_uid) {
      return NextResponse.json(
        { error: 'Firebase token, email, and uid are required' },
        { status: 400 }
      );
    }

    // Verify Firebase token server-side (dynamic import avoids build-time crash)
    const { firebaseAdmin } = await import('@/lib/firebase-admin');
    const decodedToken = await firebaseAdmin.auth.verifyIdToken(firebase_token);
    if (decodedToken.uid !== firebase_uid || decodedToken.email !== email) {
      return NextResponse.json({ error: 'Token verification failed' }, { status: 403 });
    }

    const supabaseAdmin = createAdminClient();

    // Find or create user in our users table, get their user_id (FK for projects etc.)
    let appUserId: string;

    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('user_id, email, name')
      .eq('email', email)
      .single() as { data: { user_id: string; email: string; name: string } | null };

    if (existingUser?.user_id) {
      appUserId = existingUser.user_id;
    } else {
      // Create user row with all required columns
      const displayName = name || email.split('@')[0];
      const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');

      let created: { user_id: string } | null = null;
      for (const suffix of ['', `_${Date.now()}`]) {
        const { data, error } = await supabaseAdmin
          .from('users')
          .insert({
            email,
            full_name: displayName,
            name: displayName,
            username: baseUsername + suffix,
            firebase_uid,
          } as never)
          .select('user_id')
          .single() as { data: { user_id: string } | null; error: any };

        if (!error && data) { created = data; break; }
        // On any conflict try next suffix or fall through to select
        if (error?.code !== '23505') break;
      }

      if (!created) {
        // Row may have been inserted concurrently — select it
        const { data: fallback } = await supabaseAdmin
          .from('users')
          .select('user_id')
          .eq('email', email)
          .single() as { data: { user_id: string } | null };
        if (!fallback) {
          return NextResponse.json({ error: 'Failed to create user account' }, { status: 500 });
        }
        appUserId = fallback.user_id;
      } else {
        appUserId = created.user_id;
      }
    }

    // Ensure Supabase auth user exists so we can generate a session magic link
    const ensureAuthUser = async () => {
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { name: name || email.split('@')[0], firebase_uid, firebase_migrated: true },
      });
      // Ignore "already registered" error
      if (createError && !createError.message?.includes('already been registered')) {
        throw createError;
      }
    };

    let linkData: Awaited<ReturnType<typeof supabaseAdmin.auth.admin.generateLink>>['data'];

    const { data: ld, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (linkError) {
      // Auth user doesn't exist yet — create it then retry
      await ensureAuthUser();
      const { data: ld2, error: le2 } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email,
      });
      if (le2) return NextResponse.json({ error: le2.message }, { status: 500 });
      linkData = ld2;
    } else {
      linkData = ld;
    }

    const userName = name || email.split('@')[0];
    const cookieOptions = {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    };

    // Store users.user_id (not the Supabase auth UUID) so FK references work
    const response = NextResponse.json({
      success: true,
      user: { id: appUserId, email, name: userName },
      session: linkData,
    });
    response.cookies.set('auth-token', firebase_token, cookieOptions);
    response.cookies.set(
      'user-session',
      JSON.stringify({ userId: appUserId, email, name: userName }),
      cookieOptions
    );

    return response;
  } catch (error) {
    console.error('[Firebase Login] Error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
