import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(
  request: Request,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    console.log(`[API] GET task details: projectId=${params.id}, taskId=${params.taskId}`);
    
    const cookieStore = cookies();
    const token = cookieStore.get('auth_token');

    if (!token) {
      console.error('[API] Authentication required - No auth_token cookie');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Khởi tạo URL GraphQL endpoint
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    if (!apiUrl) {
      console.error('[API] NEXT_PUBLIC_API_URL is not defined');
      return NextResponse.json(
        { error: 'API configuration error' },
        { status: 500 }
      );
    }

    const graphqlEndpoint = `${apiUrl}/graphql`;
    console.log(`[API] Using GraphQL endpoint: ${graphqlEndpoint}`);

    // GraphQL query để lấy thông tin task
    const query = `
      query GetTaskById($taskId: ID!) {
        task(taskId: $taskId) {
          taskId
          title
          description
          status
          priority
          effort
          progress
          startDate
          dueDate
          actualStartDate
          actualEndDate
          createdAt
          updatedAt
          projectId
          parentTaskId
          assignee {
            userId
            username
            avatarUrl
            role
          }
          creator {
            userId
            username
            avatarUrl
            role
          }
          priorityOrder
          type
          category
          progressType
          tags
        }
      }
    `;

    const variables = { taskId: params.taskId };
    console.log(`[API] GraphQL variables:`, JSON.stringify(variables));

    // Gọi API GraphQL để lấy chi tiết task
    console.log(`[API] Sending GraphQL request to ${graphqlEndpoint}`);
    const response = await fetch(
      graphqlEndpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token.value}`,
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      }
    );

    // Log response status
    console.log(`[API] GraphQL response status: ${response.status}`);
    
    const result = await response.json();
    
    // Log GraphQL errors if any
    if (result.errors) {
      console.error('[API] GraphQL errors:', JSON.stringify(result.errors));
      return NextResponse.json(
        { error: result.errors?.[0]?.message || 'Failed to fetch task details' },
        { status: 500 }
      );
    }

    // Chuyển đổi từ camelCase sang snake_case để tương thích với frontend
    const task = result.data?.task;
    if (!task) {
      console.error('[API] Task not found in GraphQL response');
      console.log('[API] GraphQL response:', JSON.stringify(result));
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    console.log('[API] Successfully fetched task data from GraphQL');
    
    // Chuyển đổi định dạng dữ liệu để phù hợp với schema Task của frontend
    const formattedTask = {
      task_id: task.taskId || '',
      id: task.taskId || '',
      title: task.title || '',
      description: task.description || '',
      status: task.status?.toLowerCase() || 'todo',
      priority: task.priority?.toLowerCase() || 'medium',
      effort: task.effort || 0,
      progress: task.progress || 0,
      start_date: task.startDate || null,
      due_date: task.dueDate || null,
      actual_start_date: task.actualStartDate || null,
      actual_end_date: task.actualEndDate || null,
      created_at: task.createdAt || new Date().toISOString(),
      updated_at: task.updatedAt || new Date().toISOString(),
      project_id: task.projectId || params.id,
      parent_task_id: task.parentTaskId || null,
      assignee: task.assignee ? {
        userId: task.assignee.userId || '',
        username: task.assignee.username || '',
        avatarUrl: task.assignee.avatarUrl || '',
        role: task.assignee.role || ''
      } : null,
      created_by: task.creator ? {
        userId: task.creator.userId || '',
        username: task.creator.username || '',
        avatarUrl: task.creator.avatarUrl || '',
        role: task.creator.role || ''
      } : 'system',
      priority_order: task.priorityOrder || 0,
      type: task.type || null,
      category: task.category || null,
      progress_type: task.progressType?.toLowerCase() || null,
      tags: task.tags || [],
      is_deleted: false
    };

    console.log('[API] Formatted task data:', JSON.stringify(formattedTask, null, 2).substring(0, 200) + '...');
    
    return NextResponse.json(formattedTask);
  } catch (error: any) {
    console.error('[API] Fetch task details error:', error);
    const errorMessage = error?.message || 'Failed to fetch task details';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 