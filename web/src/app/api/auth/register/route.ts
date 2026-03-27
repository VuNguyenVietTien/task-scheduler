import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Email, password and name are required' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // Create auth user (email not auto-confirmed — user must verify)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { name },
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    // Insert profile into users table
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert({ id: data.user.id, email, name } as never);

    if (profileError) {
      console.error('Failed to create user profile:', profileError);
      // Auth user created but profile failed — non-fatal, return success
    }

    return NextResponse.json({ success: true, message: 'Registration successful. Please verify your email.' });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
