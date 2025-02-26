# GraphQL API Examples

This document provides examples of common GraphQL queries and mutations used in the Task Scheduler API.

## Authentication

### Register a New User
```graphql
mutation Register {
  register(input: {
    email: "john@example.com"
    password: "securepassword123"
    name: "John Doe"
  }) {
    accessToken
    refreshToken
    user {
      id
      name
      email
      role
    }
  }
}
```

### Login
```graphql
mutation Login {
  login(email: "john@example.com", password: "securepassword123") {
    accessToken
    refreshToken
    user {
      id
      name
      email
      role
    }
  }
}
```

## Projects

### Create Project
```graphql
mutation CreateProject {
  createProject(input: {
    name: "New Project"
    description: "Project description"
  }) {
    id
    name
    description
    createdBy {
      id
      name
    }
    createdAt
  }
}
```

### Get Projects
```graphql
query GetProjects {
  projects {
    id
    name
    description
    members {
      user {
        id
        name
      }
      role
    }
    tasks {
      id
      title
      status
    }
  }
}
```

## Tasks

### Create Task
```graphql
mutation CreateTask {
  createTask(input: {
    projectId: "project-id"
    title: "New Task"
    description: "Task description"
    status: BACKLOG
    priority: MEDIUM
    effortHours: 4
    startDate: "2025-03-01T00:00:00Z"
    deadline: "2025-03-15T00:00:00Z"
    assigneeIds: ["user-id-1", "user-id-2"]
  }) {
    id
    title
    status
    assignees {
      id
      name
    }
  }
}
```

### Query Tasks with Filters
```graphql
query GetTasks {
  tasks(
    projectId: "project-id"
    status: IN_PROGRESS
    assigneeId: "user-id"
  ) {
    id
    title
    description
    status
    priority
    effortHours
    startDate
    deadline
    assignees {
      id
      name
    }
    comments {
      id
      content
      user {
        name
      }
    }
  }
}
```

## Comments

### Add Comment
```graphql
mutation AddComment {
  createComment(input: {
    taskId: "task-id"
    content: "This is a comment"
    parentCommentId: null  # Optional, for replies
  }) {
    id
    content
    user {
      name
    }
    createdAt
  }
}
```

## File Attachments

### Upload File
```graphql
mutation UploadFile {
  uploadAttachment(
    taskId: "task-id"
    file: File!  # Use multipart form data
  ) {
    id
    fileName
    fileSize
    mimeType
    createdAt
  }
}
```

## Notifications

### Get Notifications
```graphql
query GetNotifications {
  notifications(includeRead: false) {
    id
    type
    content
    createdAt
    readAt
  }
}
```

### Mark Notification as Read
```graphql
mutation MarkAsRead {
  markNotificationAsRead(id: "notification-id") {
    id
    readAt
  }
}
```

## Real-time Updates

To receive real-time updates, connect to the WebSocket endpoint:
```javascript
const ws = new WebSocket('ws://your-api-url/ws?token=your-auth-token');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case 'TASK_UPDATED':
      // Handle task update
      break;
    case 'COMMENT_ADDED':
      // Handle new comment
      break;
    case 'NOTIFICATION_CREATED':
      // Handle new notification
      break;
  }
};
```

## Error Handling

GraphQL errors follow this structure:
```json
{
  "errors": [
    {
      "message": "Error message",
      "path": ["field", "path"],
      "extensions": {
        "code": "ERROR_CODE",
        "details": {}
      }
    }
  ]
}
```

Common error codes:
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Requested resource not found
- `VALIDATION_ERROR`: Invalid input data
- `INTERNAL_ERROR`: Server error

## Authentication Headers

Include the authentication token in requests:
```http
Authorization: Bearer your-access-token
```

## Rate Limiting

The API implements rate limiting:
- 100 requests per minute for authenticated users
- 20 requests per minute for unauthenticated users

Rate limit headers:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1582142400
```

## Best Practices

1. Request only needed fields to minimize response size
2. Use fragments for commonly requested fields
3. Handle errors gracefully
4. Implement exponential backoff for retries
5. Cache responses when appropriate
6. Use variables instead of string interpolation
7. Batch related requests using GraphQL's natural batching
