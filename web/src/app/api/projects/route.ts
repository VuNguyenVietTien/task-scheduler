export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cookieStore = cookies();
    const token = cookieStore.get('auth_token');

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Format dates for API
    const formattedBody = {
      ...body,
      start_date: body.start_date ? new Date(body.start_date).toISOString() : null,
      due_date: body.due_date ? new Date(body.due_date).toISOString() : null,
    };

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`,
      },
      body: JSON.stringify(formattedBody),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('API Error:', data);
      return NextResponse.json(
        { error: data.message || 'Failed to create project' },
        { status: response.status }
      );
    }

    // Log successful response
    console.log('Project created successfully:', data);

    revalidatePath('/projects');
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Create project error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('auth_token');

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects`, {
      headers: {
        'Authorization': `Bearer ${token.value}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to fetch projects' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Fetch projects error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
