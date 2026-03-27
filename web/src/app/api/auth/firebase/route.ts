import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { firebaseAdmin } from '@/lib/firebase-admin';

/**
 * Firebase-to-Supabase auth bridge.
 * Verifies Firebase token, creates/signs-in Supabase user.
 * Implements create-on-first-login migration strategy.
 */
export async function POST(request: NextRequest) {
  try {
    const { firebaseToken, email, name, avatarUrl } = await request.json();

    if (!firebaseToken || !email) {
      return NextResponse.json(
        { error: 'Missing firebaseToken or email' },
        { status: 400 }
      );
    }

    // Verify Firebase token — prevents impersonation
    const { auth } = firebaseAdmin;
    const decodedToken = await auth.verifyIdToken(firebaseToken);
    if (decodedToken.email !== email) {
      return NextResponse.json(
        { error: 'Token email mismatch' },
        { status: 403 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // Find existing user by email using admin API
    const { data: { users: matchingUsers } } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1,
      page: 1,
    });
    // Use getUserByEmail-like pattern: query users table as fallback
    const { data: existingUserRow } = await supabaseAdmin
      .from('users')
      .select('supabase_uid')
      .eq('email', email)
      .single() as { data: { supabase_uid: string } | null };
    const existingUser = existingUserRow?.supabase_uid
      ? matchingUsers?.find(u => u.id === existingUserRow.supabase_uid) ?? null
      : null;

    if (existingUser) {
      // Sign in existing user — generate new session
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        user: existingUser,
        session: data,
      });
    }

    // Create new Supabase user (first login migration)
    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          name: name || email.split('@')[0],
          avatar_url: avatarUrl,
          firebase_migrated: true,
        },
      });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Also insert into our users table for app-level data
    await supabaseAdmin
      .from('users')
      .upsert({
        email,
        name: name || email.split('@')[0],
        avatar_url: avatarUrl,
        supabase_uid: newUser.user.id,
      } as never, { onConflict: 'email' });

    return NextResponse.json({
      user: newUser.user,
      message: 'User created via Firebase migration',
    });
  } catch (error) {
    console.error('[Firebase Auth Bridge] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
