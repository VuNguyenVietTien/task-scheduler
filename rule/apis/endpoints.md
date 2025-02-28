# API Endpoints

## Projects

### POST /api/projects
Tạo project mới
- Request: { name: string, description?: string }
- Response: { id: string, name: string, description: string, createdAt: string }

### PUT /api/projects/:id
Cập nhật thông tin project
- Request: { name?: string, description?: string }
- Response: { id: string, name: string, description: string, updatedAt: string }

### DELETE /api/projects/:id
Xóa project
- Response: 204 No Content

## Tasks

### POST /api/projects/:projectId/tasks
Tạo task mới
- Request: {
    title: string,
    description?: string,
    status: string,
    priority: string,
    deadline?: string,
    assigneeIds?: string[],
    effortHours?: number,
    startDate?: string
  }
- Response: Task object

### PUT /api/projects/:projectId/tasks/:taskId
Cập nhật thông tin task
- Request: {
    title?: string,
    description?: string,
    status?: string,
    priority?: string,
    deadline?: string,
    assigneeIds?: string[],
    effortHours?: number,
    startDate?: string
  }
- Response: Task object

### DELETE /api/projects/:projectId/tasks/:taskId
Xóa task
- Response: 204 No Content

### PUT /api/projects/:projectId/tasks/:taskId/status
Cập nhật status của task (Kanban)
- Request: { status: string }
- Response: Task object

### PUT /api/projects/:projectId/tasks/:taskId/priority
Cập nhật priority của task (Gantt)
- Request: { priority: string }
- Response: Task object

### POST /api/projects/:projectId/tasks/:taskId/subtasks
Tạo subtask
- Request: {
    title: string,
    description?: string,
    status: string
  }
- Response: Task object

## Kanban

### PUT /api/projects/:projectId/kanban/reorder
Cập nhật thứ tự các task trong kanban
- Request: {
    sourceStatus: string,
    destinationStatus: string,
    taskId: string,
    newIndex: number
  }
- Response: { success: true }

## Comments

### POST /api/projects/:projectId/tasks/:taskId/comments
Thêm comment mới
- Request: { content: string }
- Response: Comment object

### PUT /api/projects/:projectId/tasks/:taskId/comments/:commentId
Cập nhật comment
- Request: { content: string }
- Response: Comment object

### DELETE /api/projects/:projectId/tasks/:taskId/comments/:commentId
Xóa comment
- Response: 204 No Content

## Attachments

### POST /api/projects/:projectId/tasks/:taskId/attachments 
Upload file đính kèm
- Request: FormData với file
- Response: Attachment object

### DELETE /api/projects/:projectId/tasks/:taskId/attachments/:attachmentId
Xóa file đính kèm
- Response: 204 No Content

## Error Responses
Tất cả các endpoints trên đều có thể trả về các error responses sau:

- 400 Bad Request: Request không hợp lệ
- 401 Unauthorized: Chưa đăng nhập
- 403 Forbidden: Không có quyền truy cập
- 404 Not Found: Resource không tồn tại
- 500 Internal Server Error: Lỗi server

Mỗi error response có định dạng:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message"
  }
}
