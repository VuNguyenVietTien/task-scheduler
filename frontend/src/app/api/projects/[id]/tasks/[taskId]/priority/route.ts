import { NextResponse } from 'next/server';

export async function PUT(
  request: Request,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const body = await request.json();

    const response = await fetch(
      `${process.env.BACKEND_URL}/api/projects/${params.id}/tasks/${params.taskId}/priority`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to update task priority');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Update task priority error:', error);
    return NextResponse.json(
      { error: 'Failed to update task priority' },
      { status: 500 }
    );
  }
}
