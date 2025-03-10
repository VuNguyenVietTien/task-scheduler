# GraphQL Test Requests

## Create Task with New Fields
```graphql
mutation CreateTask($input: CreateTaskInput!) {
  createTask(input: $input) {
    taskId
    title
    description
    status
    priority
    priorityOrder
    assigneeId
    effort
    startDate
    dueDate
    type
    category
    progressType
    tags
    createdBy
  }
}
```

Variables:
```json
{
  "input": {
    "projectId": "a55169d0-2828-4d2e-867c-3a05ff019016",
    "title": "Test Task",
    "description": "This is a test task with new fields",
    "status": "todo",
    "priority": "medium",
    "priorityOrder": 1,
    "effort": 8,
    "assigneeId": "51694e1b-39ca-437b-a337-b63108727377",
    "type": "feature",
    "category": "frontend",
    "progressType": "not_started",
    "tags": ["ui", "responsive"]
  }
}
```

Headers:
```
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

## Expected Response
```json
{
  "data": {
    "createTask": {
      "taskId": "uuid...",
      "title": "Test Task",
      "description": "This is a test task with new fields",
      "status": "todo",
      "priority": "medium",
      "priorityOrder": 1,
      "assigneeId": "51694e1b-39ca-437b-a337-b63108727377",
      "effort": 8,
      "type": "feature", 
      "category": "frontend",
      "progressType": "not_started",
      "tags": ["ui", "responsive"]
    }
  }
}
```

# Migration Steps

1. Apply database migrations:
```bash
sqlx migrate run
```

2. Restart backend server to load new schema

3. Test creating task with above mutation

4. Verify all fields are saved correctly in database:
```sql
SELECT * FROM tasks ORDER BY created_at DESC LIMIT 1;