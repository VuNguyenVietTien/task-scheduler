# Tài liệu Testing GraphQL API Project Management

## Cấu hình môi trường
```bash
# URL GraphQL endpoint
GRAPHQL_URL=http://localhost:8080/graphql
```

## API Endpoints (GraphQL)

### 1. Tạo Project Mới
```bash
curl -X POST "${GRAPHQL_URL}" \
-H "Content-Type: application/json" \
-d '{
  "query": "mutation CreateProject($input: CreateProjectInput!) { createProject(input: $input) { id name description createdAt } }",
  "variables": {
    "input": {
      "name": "Task Scheduler Project",
      "description": "Xây dựng hệ thống quản lý công việc"
    }
  }
}'
```

Mẫu Response:
```json
{
  "data": {
    "createProject": {
      "id": "proj_01HQ5G2J8W4NS",
      "name": "Task Scheduler Project",
      "description": "Xây dựng hệ thống quản lý công việc",
      "createdAt": "2025-03-03T03:42:11.123Z"
    }
  }
}
```

### 2. Lấy Danh Sách Projects
```bash
curl -X POST "${GRAPHQL_URL}" \
-H "Content-Type: application/json" \
-d '{
  "query": "query GetProjects { projects { id name description createdAt members { user { name email } role } tasks { id title status } } }"
}'
```

Mẫu Response:
```json
{
  "data": {
    "projects": [
      {
        "id": "proj_01HQ5G2J8W4NS",
        "name": "Task Scheduler Project",
        "description": "Xây dựng hệ thống quản lý công việc",
        "createdAt": "2025-03-03T03:42:11.123Z",
        "members": [
          {
            "user": {
              "name": "John Doe",
              "email": "john@example.com"
            },
            "role": "OWNER"
          }
        ],
        "tasks": []
      }
    ]
  }
}
```

### 3. Lấy Chi Tiết Project
```bash
curl -X POST "${GRAPHQL_URL}" \
-H "Content-Type: application/json" \
-d '{
  "query": "query GetProject($id: ID!) { project(id: $id) { id name description createdAt members { user { name email } role } tasks { id title status } } }",
  "variables": {
    "id": "proj_01HQ5G2J8W4NS"
  }
}'
```

Mẫu Response:
```json
{
  "data": {
    "project": {
      "id": "proj_01HQ5G2J8W4NS",
      "name": "Task Scheduler Project",
      "description": "Xây dựng hệ thống quản lý công việc",
      "createdAt": "2025-03-03T03:42:11.123Z",
      "members": [
        {
          "user": {
            "name": "John Doe",
            "email": "john@example.com"
          },
          "role": "OWNER"
        }
      ],
      "tasks": []
    }
  }
}
```

### 4. Tạo Task Trong Project
```bash
curl -X POST "${GRAPHQL_URL}" \
-H "Content-Type: application/json" \
-d '{
  "query": "mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { id title description status priority startDate deadline assignees { name } } }",
  "variables": {
    "input": {
      "projectId": "proj_01HQ5G2J8W4NS",
      "title": "Thiết kế database",
      "description": "Tạo schema và relationships cho các bảng",
      "status": "PLANNED",
      "priority": "HIGH",
      "startDate": "2025-03-03T00:00:00Z",
      "deadline": "2025-03-10T00:00:00Z",
      "assigneeIds": ["usr_01HQ5G2J8W4NT"]
    }
  }
}'
```

Mẫu Response:
```json
{
  "data": {
    "createTask": {
      "id": "task_01HQ5G2J8W4NU",
      "title": "Thiết kế database",
      "description": "Tạo schema và relationships cho các bảng",
      "status": "PLANNED",
      "priority": "HIGH",
      "startDate": "2025-03-03T00:00:00Z",
      "deadline": "2025-03-10T00:00:00Z",
      "assignees": [
        {
          "name": "John Doe"
        }
      ]
    }
  }
}
```

### 5. Thêm Thành Viên Vào Project
```bash
curl -X POST "${GRAPHQL_URL}" \
-H "Content-Type: application/json" \
-d '{
  "query": "mutation AddProjectMember($input: AddProjectMemberInput!) { addProjectMember(input: $input) { projectId userId user { name email } role joinedAt } }",
  "variables": {
    "input": {
      "projectId": "proj_01HQ5G2J8W4NS",
      "userId": "usr_01HQ5G2J8W4NV",
      "role": "EDITOR"
    }
  }
}'
```

Mẫu Response:
```json
{
  "data": {
    "addProjectMember": {
      "projectId": "proj_01HQ5G2J8W4NS",
      "userId": "usr_01HQ5G2J8W4NV",
      "user": {
        "name": "Jane Smith",
        "email": "jane@example.com"
      },
      "role": "EDITOR",
      "joinedAt": "2025-03-03T03:47:33.789Z"
    }
  }
}
```

### 6. Lấy Tasks Của Project
```bash
curl -X POST "${GRAPHQL_URL}" \
-H "Content-Type: application/json" \
-d '{
  "query": "query GetProjectTasks($projectId: ID!) { tasks(projectId: $projectId) { id title description status priority startDate deadline assignees { name } } }",
  "variables": {
    "projectId": "proj_01HQ5G2J8W4NS"
  }
}'
```

Mẫu Response:
```json
{
  "data": {
    "tasks": [
      {
        "id": "task_01HQ5G2J8W4NU",
        "title": "Thiết kế database",
        "description": "Tạo schema và relationships cho các bảng",
        "status": "PLANNED", 
        "priority": "HIGH",
        "startDate": "2025-03-03T00:00:00Z",
        "deadline": "2025-03-10T00:00:00Z",
        "assignees": [
          {
            "name": "John Doe"
          }
        ]
      }
    ]
  }
}
```

## Các Giá Trị Enum

### Project Member Role
- OWNER: Chủ sở hữu project
- MANAGER: Quản lý project  
- EDITOR: Người có quyền chỉnh sửa
- VIEWER: Người chỉ có quyền xem

### Task Priority
- LOW: Thấp
- MEDIUM: Trung bình
- HIGH: Cao 
- URGENT: Khẩn cấp

### Task Status
- BACKLOG: Chưa lên kế hoạch
- PLANNED: Đã lên kế hoạch
- IN_PROGRESS: Đang thực hiện
- IN_REVIEW: Đang review
- DONE: Hoàn thành
- CANCELLED: Đã hủy