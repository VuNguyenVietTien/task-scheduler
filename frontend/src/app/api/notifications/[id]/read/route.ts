import { NextResponse } from 'next/server';

// Type to represent the response shape
type ReadResponse = {
  success: boolean;
  error?: string;
};

// Mock storage for read notifications
const readNotifications = new Set<string>();

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse<ReadResponse>> {
  try {
    const notificationId = params.id;
    
    // In a real application, you would update the database
    // For now, just store in memory
    readNotifications.add(notificationId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to mark notification as read' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse<{ read: boolean }>> {
  const notificationId = params.id;
  
  return NextResponse.json({
    read: readNotifications.has(notificationId)
  });
}
