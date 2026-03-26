import { NextResponse } from 'next/server';

export async function GET() {
  // Mock notifications data with the correct structure
  const notifications = {
    notifications: [
      {
        id: '1',
        title: 'High Priority Task Due Soon',
        message: 'API Integration task is due in 2 days',
        type: 'deadline',
        taskId: '1',
        createdAt: new Date().toISOString(),
        read: false
      },
      {
        id: '2',
        title: 'Task Status Update',
        message: 'User Authentication task moved to In Progress',
        type: 'status',
        taskId: '2',
        createdAt: new Date().toISOString(),
        read: false
      }
    ]
  };

  return NextResponse.json(notifications);
}
