# GraphQL Test Requests

Tất cả các requests dưới đây sử dụng endpoint: `http://localhost:8080/graphql`

## 1. Register User

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

## 2. Login

```bash
curl -X POST http://localhost:8080/graphql \
-H "Content-Type: application/json" \
-d '{
  "query": "mutation Login($email: String!, $password: String!) { login(email: $email, password: $password) { accessToken refreshToken user { id email name } } }",
  "variables": {
    "email": "test@example.com",
    "password": "password123"
  }
}'
```

## 3. Create Project
Sử dụng access token từ bước login:

```bash
curl -X POST http://localhost:8080/graphql \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
-d '{
  "query": "mutation CreateProject($input: CreateProjectInput!) { createProject(input: $input) { id name description } }",
  "variables": {
    "input": {
      "name": "Test Project",
      "description": "This is a test project"
    }
  }
}'
```

## 4. Get Projects List

```bash
curl -X POST http://localhost:8080/graphql \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
-d '{
  "query": "query { projects { id name description createdBy { name } } }"
}'
```

## 5. Get Project by ID

```bash
curl -X POST http://localhost:8080/graphql \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
-d '{
  "query": "query GetProject($id: ID!) { project(id: $id) { id name description members { user { name } role } tasks { id title } } }",
  "variables": {
    "id": "YOUR_PROJECT_ID"
  }
}'
```

## 6. Add Member to Project

```bash
curl -X POST http://localhost:8080/graphql \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
-d '{
  "query": "mutation AddProjectMember($input: AddProjectMemberInput!) { addProjectMember(input: $input) { projectId userId role user { name } } }",
  "variables": {
    "input": {
      "projectId": "YOUR_PROJECT_ID",
      "userId": "MEMBER_USER_ID",
      "role": "EDITOR"
    }
  }
}'
```

## 7. Create Task

```bash
curl -X POST http://localhost:8080/graphql \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
-d '{
  "query": "mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { id title description status priority assignees { name } } }",
  "variables": {
    "input": {
      "projectId": "YOUR_PROJECT_ID",
      "title": "Test Task",
      "description": "This is a test task",
      "status": "BACKLOG",
      "priority": "HIGH",
      "assigneeIds": ["MEMBER_USER_ID"],
      "effortHours": 8,
      "startDate": "2025-03-05T00:00:00Z",
      "deadline": "2025-03-10T00:00:00Z"
    }
  }
}'
```

## 8. Get Tasks List

```bash
curl -X POST http://localhost:8080/graphql \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
-d '{
  "query": "query GetTasks($projectId: ID) { tasks(projectId: $projectId) { id title status priority assignees { name } } }",
  "variables": {
    "projectId": "YOUR_PROJECT_ID"
  }
}'
```

## 9. Assign Member to Task

```bash
curl -X POST http://localhost:8080/graphql \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
-d '{
  "query": "mutation AssignTask($taskId: ID!, $userId: ID!) { assignTask(taskId: $taskId, userId: $userId) { id title assignees { id name } } }",
  "variables": {
    "taskId": "YOUR_TASK_ID",
    "userId": "MEMBER_USER_ID"
  }
}'
```

## Test Flow Guide

1. Đăng ký tài khoản mới (Register)
2. Đăng nhập để lấy access token (Login)
3. Tạo project mới (Create Project)
4. Đăng ký thêm một tài khoản khác để test add member
5. Add member vào project
6. Tạo task và assign cho member
7. Kiểm tra danh sách tasks và thông tin chi tiết project

Lưu ý:
- Thay `YOUR_ACCESS_TOKEN` bằng token nhận được sau khi login
- Thay `YOUR_PROJECT_ID` bằng ID của project đã tạo
- Thay `YOUR_TASK_ID` bằng ID của task đã tạo
- Thay `MEMBER_USER_ID` bằng ID của user member

## Error Response Example

Nếu có lỗi, response sẽ có dạng:
```json
{
  "errors": [
    {
      "message": "Error message here",
      "locations": [
        {
          "line": 1,
          "column": 20
        }
      ],
      "path": ["fieldName"]
    }
  ]
}