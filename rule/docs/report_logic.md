# Logic Báo Cáo Theo Ngày

Dựa trên phân tích cấu trúc dữ liệu và yêu cầu báo cáo ngày, dưới đây là logic xác định trạng thái của các task dựa trên thời gian (hôm qua và hôm nay).

## Các trường dữ liệu quan trọng

### Từ bảng tasks
- `task_id`: ID của task
- `title`: Tiêu đề task
- `assignee_id`: ID người được giao
- `start_date`: Ngày dự kiến bắt đầu
- `due_date`: Ngày dự kiến kết thúc
- `actual_start_date`: Ngày thực tế bắt đầu
- `actual_end_date`: Ngày thực tế kết thúc
- `status`: Trạng thái (todo, doing, review, done)
- `effort`: Nỗ lực ước tính
- `progress`: Tiến độ hoàn thành

### Từ planData
- `task_id`: ID của task
- `title`: Tiêu đề task
- `assignee_id`: ID người được giao
- `assignee_name`: Tên người được giao
- `start_date`: Ngày bắt đầu theo kế hoạch
- `end_date`: Ngày kết thúc theo kế hoạch
- `status`: Trạng thái theo kế hoạch
- `priority`: Mức độ ưu tiên
- `effort`: Nỗ lực ước tính

[
    {
        "__typename": "Plan",
        "id": "07ae303a-09a2-4dfe-bb2f-246ad9a94b56",
        "projectId": "eaaa8f60-85bc-43cf-b224-47b8894d6478",
        "name": "test6",
        "description": null,
        "createdBy": "63554e5f-4b79-4b91-8bf8-f0371e55b3d8",
        "createdAt": "2025-04-07T16:12:54.710819+00:00",
        "updatedAt": "2025-04-07T16:12:54.710819+00:00",
        "isActive": false,
        "planData": {
            "tasks": [
                {
                    "assignee_id": "63554e5f-4b79-4b91-8bf8-f0371e55b3d8",
                    "assignee_name": "Vu Tien",
                    "effort": 6,
                    "end_date": "2025-04-07",
                    "original_priority": null,
                    "priority": "urgent",
                    "priority_order": 1,
                    "start_date": "2025-04-07",
                    "status": "doing",
                    "task_id": "e197bb63-5dfc-4fa7-9f17-adfd156c993f",
                    "title": "test task 8"
                },
                {
                    "assignee_id": "63554e5f-4b79-4b91-8bf8-f0371e55b3d8",
                    "assignee_name": "Vu Tien",
                    "effort": 7,
                    "end_date": "2025-04-08",
                    "original_priority": null,
                    "priority": "high",
                    "priority_order": 2,
                    "start_date": "2025-04-07",
                    "status": "review",
                    "task_id": "b8d5a762-2766-47ba-a9d8-375fbf2614af",
                    "title": "test task 4"
                },
                {
                    "assignee_id": "63554e5f-4b79-4b91-8bf8-f0371e55b3d8",
                    "assignee_name": "Vu Tien",
                    "effort": 17,
                    "end_date": "2025-04-10",
                    "original_priority": null,
                    "priority": "high",
                    "priority_order": 3,
                    "start_date": "2025-04-08",
                    "status": "doing",
                    "task_id": "97a3f0df-c84e-4668-b9df-5cf40c0b550a",
                    "title": "test task 6"
                },
                {
                    "assignee_id": "63554e5f-4b79-4b91-8bf8-f0371e55b3d8",
                    "assignee_name": "Vu Tien",
                    "effort": 2,
                    "end_date": "2025-04-10",
                    "original_priority": null,
                    "priority": "high",
                    "priority_order": 4,
                    "start_date": "2025-04-10",
                    "status": "review",
                    "task_id": "cb3fb2b9-0c16-4fb4-84c0-751426b8f98a",
                    "title": "test task 7"
                },
                {
                    "assignee_id": "a92ebdf7-1a85-48cc-a3dc-58fb9640d745",
                    "assignee_name": "Tiến Vũ",
                    "effort": 8,
                    "end_date": "2025-04-07",
                    "original_priority": null,
                    "priority": "medium",
                    "priority_order": 5,
                    "start_date": "2025-04-07",
                    "status": "doing",
                    "task_id": "c477e453-513b-4829-8e3b-5bce5d906a3a",
                    "title": "test 12345 gdfg kjhkjhkjkkkkkll"
                },
                {
                    "assignee_id": "63554e5f-4b79-4b91-8bf8-f0371e55b3d8",
                    "assignee_name": "Vu Tien",
                    "effort": 4,
                    "end_date": "2025-04-11",
                    "original_priority": null,
                    "priority": "medium",
                    "priority_order": 6,
                    "start_date": "2025-04-11",
                    "status": "doing",
                    "task_id": "15fb2108-d8d1-427d-aad4-e9ed848f9aa5",
                    "title": "test task 2"
                },
                {
                    "assignee_id": "a92ebdf7-1a85-48cc-a3dc-58fb9640d745",
                    "assignee_name": "Tiến Vũ",
                    "effort": 10,
                    "end_date": "2025-04-01",
                    "original_priority": null,
                    "priority": "high",
                    "priority_order": 7,
                    "start_date": "2025-03-31",
                    "status": "done",
                    "task_id": "3958eba5-fc8b-4ef8-908f-2af7f5129578",
                    "title": "test task 3"
                },
                {
                    "assignee_id": "a92ebdf7-1a85-48cc-a3dc-58fb9640d745",
                    "assignee_name": "Tiến Vũ",
                    "effort": 10,
                    "end_date": "",
                    "original_priority": null,
                    "priority": "medium",
                    "priority_order": 8,
                    "start_date": "",
                    "status": "done",
                    "task_id": "f8e4132a-9013-4cdb-8e14-a2ef15d72894",
                    "title": "child task 1"
                }
            ]
        }
    }
]

[
    {
        "task_id": "c477e453-513b-4829-8e3b-5bce5d906a3a",
        "id": "c477e453-513b-4829-8e3b-5bce5d906a3a",
        "project_id": "eaaa8f60-85bc-43cf-b224-47b8894d6478",
        "projectId": "eaaa8f60-85bc-43cf-b224-47b8894d6478",
        "parent_task_id": null,
        "title": "test 12345 gdfg kjhkjhkjkkkkkll",
        "assignee": {
            "userId": "63554e5f-4b79-4b91-8bf8-f0371e55b3d8",
            "username": "Vu Tien",
            "avatarUrl": "",
            "role": "user"
        },
        "start_date": "2025-04-01T00:00:00+00:00",
        "due_date": "2025-04-19T00:00:00+00:00",
        "actual_start_date": null,
        "actual_end_date": null,
        "effort": 6,
        "progress": 0,
        "created_by": "63554e5f-4b79-4b91-8bf8-f0371e55b3d8",
        "created_at": "2025-03-20T11:15:46.967092+00:00",
        "updated_at": "2025-04-08T03:50:31.115565+00:00",
        "is_deleted": false,
        "status": "todo",
        "priority": "high",
        "type": "Bug",
        "category": "Backend",
        "progress_type": "study",
        "tags": [
            "High Priority",
            "In Progress"
        ],
        "child_tasks": [
            {
                "task_id": "c57cdb03-87f2-4e9a-8290-957d7edc2bf5",
                "id": "c57cdb03-87f2-4e9a-8290-957d7edc2bf5",
                "project_id": "eaaa8f60-85bc-43cf-b224-47b8894d6478",
                "projectId": "eaaa8f60-85bc-43cf-b224-47b8894d6478",
                "parent_task_id": "c477e453-513b-4829-8e3b-5bce5d906a3a",
                "title": "test task 5",
                "assignee": {
                    "userId": "a92ebdf7-1a85-48cc-a3dc-58fb9640d745",
                    "username": "Tiến Vũ",
                    "avatarUrl": "",
                    "role": "user"
                },
                "start_date": null,
                "due_date": "2025-03-29T00:00:00+00:00",
                "effort": 8,
                "progress": 0,
                "status": "doing",
                "priority": "high",
                "type": "Bug",
                "category": "Backend"
            }
        ]
    },
    {
        "task_id": "b8d5a762-2766-47ba-a9d8-375fbf2614af",
        "id": "b8d5a762-2766-47ba-a9d8-375fbf2614af",
        "project_id": "eaaa8f60-85bc-43cf-b224-47b8894d6478",
        "projectId": "eaaa8f60-85bc-43cf-b224-47b8894d6478",
        "parent_task_id": null,
        "title": "test task 4",
        "assignee": {
            "userId": "63554e5f-4b79-4b91-8bf8-f0371e55b3d8",
            "username": "Vu Tien",
            "avatarUrl": "",
            "role": "user"
        },
        "start_date": null,
        "due_date": "2025-04-11T00:00:00+00:00",
        "actual_start_date": null,
        "actual_end_date": null,
        "effort": 7,
        "progress": 0,
        "created_by": "63554e5f-4b79-4b91-8bf8-f0371e55b3d8",
        "created_at": "2025-03-27T03:36:56.385897+00:00",
        "updated_at": "2025-04-08T03:48:39.025996+00:00",
        "is_deleted": false,
        "status": "todo",
        "priority": "high",
        "type": "Bug",
        "category": "Design",
        "progress_type": "investigate",
        "tags": null,
        "child_tasks": []
    },
    {
        "task_id": "f8e4132a-9013-4cdb-8e14-a2ef15d72894",
        "id": "f8e4132a-9013-4cdb-8e14-a2ef15d72894",
        "project_id": "eaaa8f60-85bc-43cf-b224-47b8894d6478",
        "projectId": "eaaa8f60-85bc-43cf-b224-47b8894d6478",
        "parent_task_id": null,
        "title": "child task 1",
        "assignee": {
            "userId": "a92ebdf7-1a85-48cc-a3dc-58fb9640d745",
            "username": "Tiến Vũ",
            "avatarUrl": "",
            "role": "user"
        },
        "start_date": null,
        "due_date": "2025-04-11T02:42:00+00:00",
        "actual_start_date": null,
        "actual_end_date": null,
        "effort": 10,
        "progress": 0,
        "created_by": "63554e5f-4b79-4b91-8bf8-f0371e55b3d8",
        "created_at": "2025-04-04T02:43:11.557805+00:00",
        "updated_at": "2025-04-05T01:50:03.189258+00:00",
        "is_deleted": false,
        "status": "done",
        "priority": "medium",
        "type": "Feature",
        "category": "Backend",
        "progress_type": "code",
        "tags": [
            "Urgent",
            "Low Priority"
        ],
        "child_tasks": [
            {
                "task_id": "7c1e6de1-9324-443a-9cc6-8372fc015741",
                "id": "7c1e6de1-9324-443a-9cc6-8372fc015741",
                "project_id": "eaaa8f60-85bc-43cf-b224-47b8894d6478",
                "projectId": "eaaa8f60-85bc-43cf-b224-47b8894d6478",
                "parent_task_id": "f8e4132a-9013-4cdb-8e14-a2ef15d72894",
                "title": "test task 1",
                "assignee": {
                    "userId": "63554e5f-4b79-4b91-8bf8-f0371e55b3d8",
                    "username": "Vu Tien",
                    "avatarUrl": "",
                    "role": "user"
                },
                "start_date": null,
                "due_date": "2025-03-28T11:07:00+00:00",
                "effort": 10,
                "progress": 0,
                "status": "pending",
                "priority": "medium",
                "type": "Bug",
                "category": "Backend"
            }
        ]
    },
    {
        "task_id": "15fb2108-d8d1-427d-aad4-e9ed848f9aa5",
        "id": "15fb2108-d8d1-427d-aad4-e9ed848f9aa5",
        "project_id": "eaaa8f60-85bc-43cf-b224-47b8894d6478",
        "projectId": "eaaa8f60-85bc-43cf-b224-47b8894d6478",
        "parent_task_id": null,
        "title": "test task 2",
        "assignee": {
            "userId": "63554e5f-4b79-4b91-8bf8-f0371e55b3d8",
            "username": "Vu Tien",
            "avatarUrl": "",
            "role": "user"
        },
        "start_date": null,
        "due_date": "2025-04-25T00:00:00+00:00",
        "actual_start_date": null,
        "actual_end_date": null,
        "effort": 4,
        "progress": 0,
        "created_by": "63554e5f-4b79-4b91-8bf8-f0371e55b3d8",
        "created_at": "2025-03-20T11:26:25.970624+00:00",
        "updated_at": "2025-04-08T04:04:57.726178+00:00",
        "is_deleted": false,
        "status": "todo",
        "priority": "medium",
        "type": "Bug",
        "category": "Backend",
        "progress_type": "study",
        "tags": [
            "High Priority",
            "In Progress"
        ],
        "child_tasks": []
    },
    {
        "task_id": "3958eba5-fc8b-4ef8-908f-2af7f5129578",
        "id": "3958eba5-fc8b-4ef8-908f-2af7f5129578",
        "project_id": "eaaa8f60-85bc-43cf-b224-47b8894d6478",
        "projectId": "eaaa8f60-85bc-43cf-b224-47b8894d6478",
        "parent_task_id": null,
        "title": "test task 3",
        "assignee": {
            "userId": "a92ebdf7-1a85-48cc-a3dc-58fb9640d745",
            "username": "Tiến Vũ",
            "avatarUrl": "",
            "role": "user"
        },
        "start_date": null,
        "due_date": "2025-03-28T11:07:00+00:00",
        "actual_start_date": null,
        "actual_end_date": null,
        "effort": 10,
        "progress": 0,
        "created_by": "63554e5f-4b79-4b91-8bf8-f0371e55b3d8",
        "created_at": "2025-03-20T11:13:16.418762+00:00",
        "updated_at": "2025-04-04T16:02:25.437016+00:00",
        "is_deleted": false,
        "status": "done",
        "priority": "high",
        "type": "Bug",
        "category": "Backend",
        "progress_type": "study",
        "tags": [
            "High Priority",
            "In Progress"
        ],
        "child_tasks": []
    },
    {
        "task_id": "cb3fb2b9-0c16-4fb4-84c0-751426b8f98a",
        "id": "cb3fb2b9-0c16-4fb4-84c0-751426b8f98a",
        "project_id": "eaaa8f60-85bc-43cf-b224-47b8894d6478",
        "projectId": "eaaa8f60-85bc-43cf-b224-47b8894d6478",
        "parent_task_id": null,
        "title": "test task 7",
        "assignee": {
            "userId": "63554e5f-4b79-4b91-8bf8-f0371e55b3d8",
            "username": "Vu Tien",
            "avatarUrl": "",
            "role": "user"
        },
        "start_date": null,
        "due_date": "2025-04-24T00:00:00+00:00",
        "actual_start_date": null,
        "actual_end_date": null,
        "effort": 5,
        "progress": 0,
        "created_by": "63554e5f-4b79-4b91-8bf8-f0371e55b3d8",
        "created_at": "2025-03-27T03:41:38.990577+00:00",
        "updated_at": "2025-04-08T03:54:48.348856+00:00",
        "is_deleted": false,
        "status": "todo",
        "priority": "high",
        "type": "Bug",
        "category": "Testing",
        "progress_type": "test",
        "tags": [
            "High Priority",
            "In Progress"
        ],
        "child_tasks": []
    },
    {
        "task_id": "97a3f0df-c84e-4668-b9df-5cf40c0b550a",
        "id": "97a3f0df-c84e-4668-b9df-5cf40c0b550a",
        "project_id": "eaaa8f60-85bc-43cf-b224-47b8894d6478",
        "projectId": "eaaa8f60-85bc-43cf-b224-47b8894d6478",
        "parent_task_id": null,
        "title": "test task 6",
        "assignee": {
            "userId": "63554e5f-4b79-4b91-8bf8-f0371e55b3d8",
            "username": "Vu Tien",
            "avatarUrl": "",
            "role": "user"
        },
        "start_date": null,
        "due_date": "2025-04-16T00:00:00+00:00",
        "actual_start_date": null,
        "actual_end_date": null,
        "effort": 17,
        "progress": 0,
        "created_by": "63554e5f-4b79-4b91-8bf8-f0371e55b3d8",
        "created_at": "2025-03-21T09:49:50.924458+00:00",
        "updated_at": "2025-04-08T03:56:00.413655+00:00",
        "is_deleted": false,
        "status": "todo",
        "priority": "high",
        "type": "Bug",
        "category": "Frontend",
        "progress_type": "test",
        "tags": [
            "High Priority",
            "In Progress"
        ],
        "child_tasks": []
    },
    {
        "task_id": "e197bb63-5dfc-4fa7-9f17-adfd156c993f",
        "id": "e197bb63-5dfc-4fa7-9f17-adfd156c993f",
        "project_id": "eaaa8f60-85bc-43cf-b224-47b8894d6478",
        "projectId": "eaaa8f60-85bc-43cf-b224-47b8894d6478",
        "parent_task_id": null,
        "title": "test task 8",
        "assignee": {
            "userId": "63554e5f-4b79-4b91-8bf8-f0371e55b3d8",
            "username": "Vu Tien",
            "avatarUrl": "",
            "role": "user"
        },
        "start_date": null,
        "due_date": "2025-04-15T00:00:00+00:00",
        "actual_start_date": null,
        "actual_end_date": null,
        "effort": 6,
        "progress": 0,
        "created_by": "63554e5f-4b79-4b91-8bf8-f0371e55b3d8",
        "created_at": "2025-03-27T03:42:53.757390+00:00",
        "updated_at": "2025-04-08T04:06:04.483473+00:00",
        "is_deleted": false,
        "status": "doing",
        "priority": "urgent",
        "type": "Bug",
        "category": "Design",
        "progress_type": "test",
        "tags": null,
        "child_tasks": []
    }
]

      

## Logic xác định trạng thái task

### Biến thời gian
```
today = ngày hiện tại (00:00:00)
yesterday = ngày hôm qua (00:00:00)
tomorrow = ngày mai (00:00:00)
```

### 1. Task đã hoàn thành hôm qua
```
IF (task.status == 'done' AND
    task.actual_end_date IS NOT NULL AND
    task.actual_end_date >= yesterday AND
    task.actual_end_date < today)
THEN
    Task đã hoàn thành hôm qua
```

### 2. Task bị trễ so với kế hoạch
```
IF (task.due_date < today AND
    task.status != 'done')
THEN
    Task bị trễ so với kế hoạch
```

### 3. Task đã bắt đầu hôm qua
```
IF (task.actual_start_date IS NOT NULL AND
    task.actual_start_date >= yesterday AND
    task.actual_start_date < today)
THEN
    Task đã bắt đầu hôm qua
```

### 4. Task dự kiến bắt đầu hôm nay
```
// Ưu tiên dữ liệu từ planData nếu có
IF (Tồn tại planTask trong planData với planTask.task_id == task.task_id AND
    planTask.start_date tương ứng với ngày today AND
    task.status == 'todo')
THEN
    Task dự kiến bắt đầu hôm nay theo kế hoạch

// Nếu không có dữ liệu từ planData, dùng dữ liệu từ task
ELSE IF (task.start_date tương ứng với ngày today AND
         task.status == 'todo')
THEN
    Task dự kiến bắt đầu hôm nay theo dữ liệu task
```

### 5. Task dự kiến hoàn thành hôm nay
```
// Ưu tiên dữ liệu từ planData nếu có
IF (Tồn tại planTask trong planData với planTask.task_id == task.task_id AND
    planTask.end_date tương ứng với ngày today AND
    task.status != 'done')
THEN
    Task dự kiến hoàn thành hôm nay theo kế hoạch

// Nếu không có dữ liệu từ planData, dùng dữ liệu từ task
ELSE IF (task.due_date tương ứng với ngày today AND
         task.status != 'done')
THEN
    Task dự kiến hoàn thành hôm nay theo dữ liệu task
```

### 6. Task đang tiếp tục thực hiện
```
IF (task.status == 'doing' OR task.status == 'review')
THEN
    Task đang tiếp tục thực hiện
```

### 7. Task bị trễ không bắt đầu theo kế hoạch
```
IF ((Tồn tại planTask trong planData với planTask.task_id == task.task_id AND
    planTask.start_date <= today AND
    task.status == 'todo') OR
    (task.start_date <= today AND 
     task.status == 'todo' AND 
     !Tồn tại planTask trong planData với planTask.task_id == task.task_id))
THEN
    Task bị trễ không bắt đầu theo kế hoạch (Lẽ ra phải ở trạng thái doing trở lên)
```

### 8. Task không kết thúc theo kế hoạch
```
IF ((Tồn tại planTask trong planData với planTask.task_id == task.task_id AND
    planTask.end_date <= today AND
    task.status != 'done') OR
    (task.due_date <= today AND 
     task.status != 'done' AND 
     !Tồn tại planTask trong planData với planTask.task_id == task.task_id))
THEN
    Task không kết thúc theo kế hoạch (Lẽ ra phải ở trạng thái done)
```

### 9. Xác định task on schedule hay late
```
// Xác định trạng thái on-schedule hay late
IF (task.status == 'done')
THEN
    // Kiểm tra nếu task hoàn thành đúng hoặc sớm hơn kế hoạch
    IF ((Tồn tại planTask trong planData với planTask.task_id == task.task_id AND
        task.actual_end_date <= DATE(planTask.end_date)) OR
        (task.actual_end_date <= task.due_date AND
         !Tồn tại planTask trong planData với planTask.task_id == task.task_id))
    THEN
        Task on schedule - Hoàn thành đúng tiến độ
    ELSE
        Task late - Hoàn thành trễ tiến độ
    
ELSE IF (task.status == 'todo')
THEN
    // Kiểm tra nếu vẫn ở trạng thái todo nhưng đã quá thời gian bắt đầu
    IF ((Tồn tại planTask trong planData với planTask.task_id == task.task_id AND
         today > DATE(planTask.start_date)) OR
         (today > task.start_date AND
          !Tồn tại planTask trong planData với planTask.task_id == task.task_id))
    THEN
        Task late - Trễ tiến độ bắt đầu (Lẽ ra phải ở trạng thái doing trở lên)
    ELSE IF ((Tồn tại planTask trong planData với planTask.task_id == task.task_id AND
             today <= DATE(planTask.start_date)) OR
             (today <= task.start_date AND
              !Tồn tại planTask trong planData với planTask.task_id == task.task_id))
    THEN
        Task on schedule - Chưa đến thời gian bắt đầu

ELSE IF (task.status == 'doing' OR task.status == 'review' OR task.status == 'pending' OR task.status == 'blocked')
THEN
    // Kiểm tra nếu task đang thực hiện và chưa đến thời hạn
    IF ((Tồn tại planTask trong planData với planTask.task_id == task.task_id AND
        today <= DATE(planTask.end_date)) OR
        (today <= task.due_date AND
         !Tồn tại planTask trong planData với planTask.task_id == task.task_id))
    THEN
        Task on schedule - Đang thực hiện đúng tiến độ
    ELSE
        Task late - Đang thực hiện trễ tiến độ (Lẽ ra phải ở trạng thái done)

ELSE
    // Nếu là các trạng thái khác (archived, rejected, close)
    IF (task.status == 'done' OR task.status == 'close' OR task.status == 'archived')
    THEN
        Task on schedule - Đã hoàn thành
    ELSE
        // Các trạng thái rejected
        Task on schedule - Đã bị từ chối hoặc đóng
```

## Phân loại theo từng ngày

### Báo cáo hôm qua
1. **Các task đã hoàn thành**
   - Task với status = 'done' và actual_end_date là ngày hôm qua
   
2. **Các task bị trễ so với kế hoạch**
   - Task có due_date/end_date ≤ hôm qua nhưng status chưa phải 'done'
   - Task có start_date ≤ hôm qua nhưng status vẫn là 'todo'
   
3. **Các task đã bắt đầu đúng kế hoạch**
   - Task có actual_start_date là ngày hôm qua và khớp với start_date hoặc planTask.start_date
   
4. **Tổng hợp công việc theo thành viên**
   - Thống kê số lượng task theo các trạng thái: hoàn thành, đang làm, bị trễ

### Báo cáo hôm nay
1. **Các task dự kiến bắt đầu**
   - Task có start_date hoặc planTask.start_date là ngày hôm nay và status = 'todo'
   
2. **Các task dự kiến hoàn thành**
   - Task có due_date hoặc planTask.end_date là ngày hôm nay và status khác 'done'
   
3. **Các thành viên không có task được phân công**
   - Các thành viên không có task nào có start_date, due_date hoặc planTask có start_date, end_date là ngày hôm nay, và không có task nào với status = 'doing' hoặc 'review'

## Thực hiện trong code

Để thực hiện logic này trong code, chúng ta cần:

1. Lấy dữ liệu tasks và planData
2. Xác định các ngày (today, yesterday, tomorrow)
3. Áp dụng các hàm lọc dựa trên logic trên để phân loại tasks
4. Hiển thị kết quả phân loại lên giao diện người dùng

Việc kết hợp giữa dữ liệu tasks và planData sẽ giúp chúng ta có cái nhìn chính xác hơn về tiến độ công việc, so sánh kế hoạch với thực tế, từ đó đưa ra báo cáo hữu ích cho người dùng. 