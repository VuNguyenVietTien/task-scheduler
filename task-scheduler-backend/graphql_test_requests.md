# GraphQL Test Requests

## Register User
```graphql
mutation Register($input: RegisterInput!) {
  register(input: $input) {
    accessToken
    refreshToken
    user {
      id
      email 
      name
    }
  }
}

Variables:
{
  "input": {
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }
}

Curl command:
```bash
curl -X POST http://localhost:8080/graphql \
-H "Content-Type: application/json" \
-d '{
  "query": "mutation Register($input: RegisterInput!) { register(input: $input) { accessToken refreshToken user { id email name } } }",
  "variables": {
    "input": {
      "email": "test@example.com",
      "password": "password123",
      "name": "Test User"
    }
  }
}'
```
```

## Login User
```graphql
mutation Login($input: LoginInput!) {
  login(input: $input) {
    accessToken
    refreshToken
    user {
      id
      email
      name
    }
  }
}

Variables:
{
  "input": {
    "email": "test@example.com", 
    "password": "password123"
  }
}

Curl command:
```bash
curl -X POST http://localhost:8080/graphql \
-H "Content-Type: application/json" \
-d '{
  "query": "mutation Login($input: LoginInput!) { login(input: $input) { accessToken refreshToken user { userId email username } } }",
  "variables": {
    "input": {
      "email": "test@example.com",
      "password": "password123"
    }
  }
}'
```
```

## Get Projects List
```graphql
query GetProjects {
  projects {
    project_id
    name
    description
    owner_id
    created_at
    priority
    visibility
    tags
    progress
    category
    metadata
    start_date
    end_date
    icon_url
    is_public
    status
    member_count
    owner {
      user_id
      email
      full_name
      avatar_url
    }
  }
}

Curl command:
```bash
curl -X POST http://localhost:8080/graphql \
-H "Content-Type: application/json" \
-H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI1Zjc2MmUyYy03NTEwLTQ2NTEtYjBlZS0zNmYzNDJlOTM0M2MiLCJleHAiOjE3NDE0MTY4NzcsImlhdCI6MTc0MTMzMDQ3NywiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZGlzcGxheV9uYW1lIjoiVGVzdCBVc2VyIn0.VZ_ETZSCb8NjPu3Wx_o2prZwOA2_O33CVw2SVYnuqO4" \
-d '{
  "query": "query GetUserProjects($userId: ID!) { projects(userId: $userId) { id name startDate endDate status memberCount progress category priority visibility iconUrl owner { userId email username fullName avatarUrl } } }",
  "variables": {
    "userId": "5f762e2c-7510-4651-b0ee-36f342e9343c"
  }
}'
## Get Project By ID
```graphql
query GetProjectById($projectId: UUID!) {
  project(project_id: $projectId) {
    project_id
    name
    description
    owner_id
    created_at
    priority
    visibility
    tags
    progress
    category
    metadata
    start_date
    end_date
    icon_url
    is_public
    status
    member_count
    owner {
      user_id
      email
      full_name
      avatar_url
    }
    members {
      user_id
      email
      full_name
      avatar_url
      role
      joined_at
    }
  }
}

Variables:
{
  "projectId": "a55169d0-2828-4d2e-867c-3a05ff019016"
}

Curl command:
```bash
curl -X POST http://localhost:8080/graphql \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
-d '{
  "query": "query GetProjectById($projectId: UUID!) { project(project_id: $projectId) { project_id name description owner_id created_at priority visibility tags progress category metadata start_date end_date icon_url is_public status member_count owner { user_id email full_name avatar_url } members { user_id email full_name avatar_url role joined_at } } }",
  "variables": {
    "projectId": "a55169d0-2828-4d2e-867c-3a05ff019016"
  }
}'
```
```

## Create Project
```graphql
mutation CreateProject($input: CreateProjectInput!) {
  createProject(input: $input) {
    id
    name
    description
    startDate
    endDate
    status
    members {
      id
      role
      user {
        id
        name
      }
    }
  }
}

Variables:
{
  "input": {
    "name": "Test Project",
    "description": "This is a test project",
    "ownerId": "5f762e2c-7510-4651-b0ee-36f342e9343c",
    "members": [
      {
        "userId": "5f762e2c-7510-4651-b0ee-36f342e9343c",
        "role": "admin"
      }
    ]
  }
}

Curl command:
```bash
curl -X POST http://localhost:8080/graphql \
-H "Content-Type: application/json" \
-H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI1Zjc2MmUyYy03NTEwLTQ2NTEtYjBlZS0zNmYzNDJlOTM0M2MiLCJleHAiOjE3NDEzMjU4NzksImlhdCI6MTc0MTIzOTQ3OSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZGlzcGxheV9uYW1lIjoiVGVzdCBVc2VyIn0.4ydIgwLPxoZnX36iQgCnJZP-5wsae3GjH6UA5MoTM6c" \
-d '{
  "query": "mutation CreateProject($input: CreateProjectInput!) { createProject(input: $input) { id name description startDate endDate status members { id role user { id name } } } }",
  "variables": {
    "input": {
      "name": "Test Project",
      "description": "This is a test project", 
      "ownerId": "5f762e2c-7510-4651-b0ee-36f342e9343c",
      "members": [
        {
          "userId": "5f762e2c-7510-4651-b0ee-36f342e9343c",
          "role": "admin"
        }
      ]
    }
  }
}'
```
```

## Create Task
```graphql
mutation CreateTask($input: CreateTaskInput!) {
  createTask(input: $input) {
    taskId
    title
    description
    status
    assigneeId
  }
}

Variables:
{
  "input": {
    "projectId": "a55169d0-2828-4d2e-867c-3a05ff019016",
    "title": "Test Task",
    "description": "This is a test task",
    "status": "doing",
    "priority": "medium",
    "effort": 8,
    "assigneeIds": ["51694e1b-39ca-437b-a337-b63108727377"]
  }
}

Curl command:
```bash
curl -X POST http://localhost:8080/graphql \
-H "Content-Type: application/json" \
-H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI1Zjc2MmUyYy03NTEwLTQ2NTEtYjBlZS0zNmYzNDJlOTM0M2MiLCJleHAiOjE3NDEzMjU4NzksImlhdCI6MTc0MTIzOTQ3OSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZGlzcGxheV9uYW1lIjoiVGVzdCBVc2VyIn0.4ydIgwLPxoZnX36iQgCnJZP-5wsae3GjH6UA5MoTM6c" \
-d '{
  "query": "mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { taskId title description status assigneeId } }",
  "variables": {
    "input": {
      "projectId": "a55169d0-2828-4d2e-867c-3a05ff019016",
      "title": "Test Task",
      "description": "This is a test task",
      "status": "doing",
      "priority": "medium",
      "effort": 8,
      "assigneeId": "51694e1b-39ca-437b-a337-b63108727377"
    }
  }
}'
```
```

## Update Task
```graphql
mutation UpdateTask($input: UpdateTaskInput!) {
  updateTask(input: $input) {
    taskId
    title
    description
    status
    priorityOrder
    startDate
    dueDate
    updatedAt
  }
}

Variables:
{
  "input": {
    "taskId": "f3457c6e-f03a-4aa3-abff-c56408af18a2",
    "title": "Updated Task Title",
    "description": "Updated task description", 
    "status": "doing",
    "priority": "high",
    "priorityOrder": 1,
    "startDate": "2025-03-07T00:00:00Z",
    "dueDate": "2025-03-14T00:00:00Z"
  }
}

Curl command:
```bash
curl -X POST http://localhost:8080/graphql \
-H "Content-Type: application/json" \
-H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI1Zjc2MmUyYy03NTEwLTQ2NTEtYjBlZS0zNmYzNDJlOTM0M2MiLCJleHAiOjE3NDEzMjU4NzksImlhdCI6MTc0MTIzOTQ3OSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZGlzcGxheV9uYW1lIjoiVGVzdCBVc2VyIn0.4ydIgwLPxoZnX36iQgCnJZP-5wsae3GjH6UA5MoTM6c" \
-d '{
  "query": "mutation UpdateTask($input: UpdateTaskInput!) { updateTask(input: $input) { taskId title description status priorityOrder startDate dueDate updatedAt } }",
  "variables": {
    "input": {
      "taskId": "f3457c6e-f03a-4aa3-abff-c56408af18a2",
      "title": "Updated Task Title",
      "description": "Updated task description",
      "status": "doing", 
      "priority": "high",
      "priorityOrder": 1,
      "startDate": "2025-03-07T00:00:00Z",
      "dueDate": "2025-03-14T00:00:00Z"
    }
  }
}'
```
```

## Get Tasks in Project
```graphql
query GetTasks($projectId: ID!) {
  tasks(projectId: $projectId) {
    taskId
    title
    description
    status
    effort
    priority_order
    priority
    assigneeId
    progress
    start_date
    due_date
    actual_start_date
    actual_end_date
    created_at
    updated_at
  }
}

Variables:
{
  "projectId": "a55169d0-2828-4d2e-867c-3a05ff019016"
}

Curl command:
```bash
curl -X POST http://localhost:8080/graphql \
-H "Content-Type: application/json" \
-H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI1Zjc2MmUyYy03NTEwLTQ2NTEtYjBlZS0zNmYzNDJlOTM0M2MiLCJleHAiOjE3NDEzMjU4NzksImlhdCI6MTc0MTIzOTQ3OSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZGlzcGxheV9uYW1lIjoiVGVzdCBVc2VyIn0.4ydIgwLPxoZnX36iQgCnJZP-5wsae3GjH6UA5MoTM6c" \
-d '{
  "query": "query GetTasks($projectId: ID!) { tasks(projectId: $projectId) { taskId title description status effort priorityOrder assigneeId progress startDate dueDate actualStartDate actualEndDate createdAt updatedAt } }",
  "variables": {
    "projectId": "a55169d0-2828-4d2e-867c-3a05ff019016"
  }
}'