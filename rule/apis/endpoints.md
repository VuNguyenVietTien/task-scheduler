# API Endpoints Documentation

## Task Management APIs

### Query Tasks
**Endpoint**: `GET /api/projects/:projectId/tasks`
**GraphQL Query**:
```graphql
query GetTasks($projectId: ID!, $filters: TaskFilters) {
  tasks(projectId: $projectId, filters: $filters) {
    id
    title
    description
    status
    priority
    priorityOrder
    effortHours
    startDate
    deadline
    assignees {
      id
      name
      avatarUrl
    }
    createdAt
    updatedAt
  }
}
```

### Create Task
**Endpoint**: `POST /api/projects/:projectId/tasks`
**GraphQL Mutation**:
```graphql
mutation CreateTask($input: CreateTaskInput!) {
  createTask(input: $input) {
    id
    title
    description
    status
    priority
    priorityOrder
    effortHours
    startDate
    deadline
    assignees {
      id
      name
    }
  }
}
```

### Update Task Status
**Endpoint**: `PATCH /api/tasks/:taskId/status`
**GraphQL Mutation**:
```graphql
mutation UpdateTaskStatus($taskId: ID!, $status: TaskStatus!) {
  updateTaskStatus(taskId: $taskId, status: $status) {
    id
    status
    startDate    # Auto-updated for IN_PROGRESS
    deadline     # Auto-updated for DONE
    updatedAt
  }
}
```

### Update Task Priority Order
**Endpoint**: `PATCH /api/tasks/:taskId/priority-order`
**GraphQL Mutation**:
```graphql
mutation UpdateTaskPriorityOrder($taskId: ID!, $newOrder: Int!) {
  updateTaskPriorityOrder(taskId: $taskId, newOrder: $newOrder) {
    id
    priorityOrder
    updatedAt
  }
}
```

### Reorder Multiple Tasks
**Endpoint**: `POST /api/projects/:projectId/reorder-tasks`
**GraphQL Mutation**:
```graphql
mutation ReorderTasks($input: ReorderTasksInput!) {
  reorderTasks(input: $input) {
    tasks {
      id
      priorityOrder
    }
  }
}
```

## Data Types

### Inputs
```graphql
input TaskFilters {
  status: TaskStatus
  priority: TaskPriority
  assigneeId: ID
  startDate: DateTime
  endDate: DateTime
  searchQuery: String
}

input CreateTaskInput {
  projectId: ID!
  title: String!
  description: String
  status: TaskStatus!
  priority: TaskPriority!
  effortHours: Float
  startDate: DateTime
  deadline: DateTime
  assigneeIds: [ID!]
}

input ReorderTasksInput {
  projectId: ID!
  taskOrders: [TaskOrderInput!]!
}

input TaskOrderInput {
  taskId: ID!
  priorityOrder: Int!
}
```

### Types
```graphql
type Task {
  id: ID!
  projectId: ID!
  title: String!
  description: String
  status: TaskStatus!
  priority: TaskPriority!
  priorityOrder: Int!
  effortHours: Float
  startDate: DateTime
  deadline: DateTime
  assignees: [User!]!
  createdBy: User!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type User {
  id: ID!
  name: String!
  avatarUrl: String
}
```

### Enums
```graphql
enum TaskStatus {
  BACKLOG
  PLANNED
  IN_PROGRESS
  IN_REVIEW
  DONE
  CANCELLED
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}
```

## Business Rules

### Status Changes
```typescript
// When status changes to IN_PROGRESS
if (newStatus === TaskStatus.IN_PROGRESS && !task.startDate) {
  task.startDate = new Date();
}

// When status changes to DONE
if (newStatus === TaskStatus.DONE) {
  task.deadline = new Date();
}
```

### Priority Ordering
- Tasks are ordered by priorityOrder within each project
- Only non-completed tasks participate in priority ordering
- Reordering updates all affected task priorities
- New tasks get max(priorityOrder) + 1

## Error Handling

### Common Errors
```graphql
type Error {
  code: ErrorCode!
  message: String!
  field: String
  details: JSON
}

enum ErrorCode {
  TASK_NOT_FOUND
  INVALID_STATUS_TRANSITION
  DUPLICATE_PRIORITY_ORDER
  INVALID_PROJECT
  UNAUTHORIZED
}
```

## Optimizations

### Caching
```typescript
// Cache Configuration
{
  // Cache task lists by project with filters
  [`tasks:${projectId}:${filterHash}`]: TaskList
  
  // Cache individual tasks
  [`task:${taskId}`]: Task
  
  // Invalidate on changes
  invalidatePattern: `tasks:${projectId}:*`
}
```

### Batch Operations
```graphql
mutation BulkUpdateTasks($input: BulkTaskUpdateInput!) {
  bulkUpdateTasks(input: $input) {
    successCount
    failureCount
    errors {
      taskId
      code
      message
    }
  }
}
