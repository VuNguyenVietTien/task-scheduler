import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No auth token found' }, { status: 401 });
    }

    return NextResponse.json({ token });
  } catch (error) {
    console.error('[Get Token API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get auth token' },
      { status: 500 }
    );
  }
}