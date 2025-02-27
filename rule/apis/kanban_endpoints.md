# Kanban Board API Endpoints

## Task Status Update

### Update Task Status
```typescript
PATCH /api/tasks/{taskId}/status

// Request Body
{
  "newStatus": TaskStatus,
  "projectId": string,
  "previousStatus": TaskStatus
}

// Response: 200 OK
{
  "id": string,
  "status": TaskStatus,
  "updatedAt": string,
  "title": string,
  "description": string,
  "priority": string,
  "deadline": string | null,
  "assignees": Array<{
    "id": string,
    "name": string,
    "avatarUrl": string
  }>
}

// Response: 400 Bad Request
{
  "error": "Invalid status transition",
  "message": string
}

// Response: 404 Not Found
{
  "error": "Task not found",
  "message": string
}
```

## Mock Implementation

### Current Mock Response
```typescript
const mockUpdateStatus = async (variables: UpdateTaskStatusVariables): Promise<Task> => {
  await new Promise(resolve => setTimeout(resolve, 200));
  return {
    ...task,
    status: variables.newStatus,
    updatedAt: new Date().toISOString()
  };
};
```

## Cache Management

### Query Key Structure
```typescript
// Task List Query Key
['tasks', projectId]

// Task Update Mutation Key
['updateTaskStatus']
```

### Cache Invalidation
- Invalidate on successful status update
- Manual cache updates for optimistic changes
- Rollback on error using previous cache snapshot

## State Flow
1. Optimistic update: Update cache immediately
2. Send API request: PATCH /api/tasks/{id}/status
3. On success: Update cache with server response
4. On error: Revert to previous cache state

## Error Handling

### Error Response Format
```typescript
interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
}
```

### Status Codes
- 200: Successful update
- 400: Invalid status transition
- 404: Task not found
- 500: Server error

## Future Enhancements
1. Batch status updates
2. Real-time updates via WebSocket
3. Conflict resolution for concurrent updates
4. Task history tracking
