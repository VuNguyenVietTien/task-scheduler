# Thiết kế Schema Tổng hợp cho Hệ thống Quản lý Dự án Phần mềm

Sau khi phân tích và kết hợp kết quả từ các mô hình AI khác nhau, dưới đây là thiết kế schema toàn diện cho hệ thống quản lý dự án của bạn:

## 1. Bảng Users (Người dùng)

| column_name                | data_type                | is_nullable | is_primary_key |
| -------------------------- | ------------------------ | ----------- | -------------- |
| user_id                    | uuid                     | NO          | YES            |
| user_id                    | uuid                     | NO          | YES            |
| email                      | character varying        | NO          | NO             |
| password_hash              | character varying        | YES         | NO             |
| full_name                  | character varying        | YES         | NO             |
| username                   | character varying        | NO          | NO             |
| avatar_url                 | character varying        | YES         | NO             |
| bio                        | text                     | YES         | NO             |
| google_id                  | character varying        | YES         | NO             |
| is_email_verified          | boolean                  | YES         | NO             |
| created_at                 | timestamp with time zone | YES         | NO             |
| updated_at                 | timestamp with time zone | YES         | NO             |
| last_login_at              | timestamp with time zone | YES         | NO             |
| name                       | character varying        | YES         | NO             |
| email_verified             | boolean                  | NO          | NO             |
| verification_token         | character varying        | YES         | NO             |
| verification_token_expires | timestamp with time zone | YES         | NO             |
| reset_token                | character varying        | YES         | NO             |
| reset_token_expires        | timestamp with time zone | YES         | NO             |
| firebase_uid               | character varying        | YES         | NO             |
| role                       | character varying        | NO          | NO             |
| provider                   | character varying        | NO          | NO             |
| work_capacity              | integer                  | YES         | NO             |
| metadata                   | jsonb                    | YES         | NO             |

## 2. Bảng Projects (Dự án)

| column_name | data_type                | is_nullable | is_primary_key |
| ----------- | ------------------------ | ----------- | -------------- |
| project_id  | uuid                     | NO          | YES            |
| name        | character varying        | NO          | NO             |
| description | text                     | YES         | NO             |
| owner_id    | uuid                     | NO          | NO             |
| created_at  | timestamp with time zone | NO          | NO             |
| updated_at  | timestamp with time zone | NO          | NO             |
| priority    | USER-DEFINED             | NO          | NO             |
| visibility  | USER-DEFINED             | NO          | NO             |
| tags        | jsonb                    | YES         | NO             |
| progress    | double precision         | NO          | NO             |
| category    | character varying        | YES         | NO             |
| metadata    | jsonb                    | YES         | NO             |
| start_date  | date                     | YES         | NO             |
| end_date    | date                     | YES         | NO             |
| icon_url    | character varying        | YES         | NO             |
| is_public   | boolean                  | NO          | NO             |
| status      | USER-DEFINED             | NO          | NO             |

## 3. Bảng Project_Members (Thành viên dự án)

| column_name | data_type                | is_nullable | is_primary_key |
| ----------- | ------------------------ | ----------- | -------------- |
| member_id   | uuid                     | NO          | YES            |
| project_id  | uuid                     | NO          | NO             |
| project_id  | uuid                     | NO          | NO             |
| user_id     | uuid                     | NO          | NO             |
| user_id     | uuid                     | NO          | NO             |
| joined_at   | timestamp with time zone | YES         | NO             |
| invited_by  | uuid                     | YES         | NO             |
| role        | USER-DEFINED             | YES         | NO             |

## 4. Bảng Task_Statuses (Trạng thái công việc)

| Field          | Type           | Description                                       |
|----------------|----------------|---------------------------------------------------|
| status_id      | UUID/INT (PK)  | ID định danh duy nhất của trạng thái             |
| project_id     | UUID/INT (FK)  | ID dự án mà trạng thái này thuộc về              |
| name           | VARCHAR(100)   | Tên trạng thái (ví dụ: Todo, In Progress, Done)  |
| description    | TEXT           | Mô tả về trạng thái                              |
| color          | VARCHAR(20)    | Mã màu hiển thị (HEX)                           |
| display_order  | INTEGER        | Thứ tự hiển thị trên board                       |
| is_default     | BOOLEAN        | Là trạng thái mặc định hay không                 |
| is_done        | BOOLEAN        | Các task ở trạng thái này được coi là hoàn thành |
| created_at     | TIMESTAMP      | Thời gian tạo                                    |
| updated_at     | TIMESTAMP      | Thời gian cập nhật gần nhất                      |

## 5. Bảng Tags (Nhãn)

| Field          | Type           | Description                                      |
|----------------|----------------|--------------------------------------------------|
| tag_id         | UUID/INT (PK)  | ID định danh duy nhất của nhãn                   |
| project_id     | UUID/INT (FK)  | ID dự án mà nhãn này thuộc về                    |
| name           | VARCHAR(100)   | Tên nhãn                                         |
| color          | VARCHAR(20)    | Mã màu hiển thị (HEX)                            |
| created_at     | TIMESTAMP      | Thời gian tạo nhãn                               |

## 6. Bảng Tasks (Công việc)

| column_name       | data_type                | is_nullable | is_primary_key |
| ----------------- | ------------------------ | ----------- | -------------- |
| task_id           | uuid                     | NO          | YES            |
| project_id        | uuid                     | NO          | NO             |
| parent_task_id    | uuid                     | YES         | NO             |
| title             | character varying        | NO          | NO             |
| description       | text                     | YES         | NO             |
| assignee_id       | uuid                     | YES         | NO             |
| priority_order    | integer                  | NO          | NO             |
| start_date        | timestamp with time zone | YES         | NO             |
| due_date          | timestamp with time zone | YES         | NO             |
| actual_start_date | timestamp with time zone | YES         | NO             |
| actual_end_date   | timestamp with time zone | YES         | NO             |
| effort            | numeric                  | YES         | NO             |
| progress          | integer                  | YES         | NO             |
| created_by        | uuid                     | NO          | NO             |
| created_at        | timestamp with time zone | YES         | NO             |
| updated_at        | timestamp with time zone | YES         | NO             |
| is_deleted        | boolean                  | YES         | NO             |
| status            | USER-DEFINED             | NO          | NO             |
| priority          | USER-DEFINED             | NO          | NO             |

## 7. Bảng Task_Tags (Liên kết Công việc-Nhãn)

| Field          | Type           | Description                                      |
|----------------|----------------|--------------------------------------------------|
| id             | UUID/INT (PK)  | ID định danh duy nhất của bản ghi                |
| task_id        | UUID/INT (FK)  | ID công việc                                     |
| tag_id         | UUID/INT (FK)  | ID nhãn                                          |
| created_at     | TIMESTAMP      | Thời gian gán nhãn                               |

## 8. Bảng Task_Durations (Khoảng thời gian làm việc)

| Field          | Type           | Description                                      |
|----------------|----------------|--------------------------------------------------|
| duration_id    | UUID/INT (PK)  | ID định danh duy nhất của khoảng thời gian       |
| task_id        | UUID/INT (FK)  | ID công việc                                     |
| start_datetime | TIMESTAMP      | Thời gian bắt đầu khoảng thời gian              |
| end_datetime   | TIMESTAMP      | Thời gian kết thúc (NULL nếu chưa kết thúc)     |
| status         | VARCHAR(50)    | Trạng thái (active, paused, completed)           |
| note           | TEXT           | Ghi chú về lý do tạm dừng hoặc loại duration    |
| created_by     | UUID/INT (FK)  | ID người dùng tạo bản ghi                        |
| created_at     | TIMESTAMP      | Thời gian tạo bản ghi                           |
| updated_at     | TIMESTAMP      | Thời gian cập nhật gần nhất                      |

## 9. Bảng Comments (Bình luận)

| column_name | data_type                | is_nullable | is_primary_key |
| ----------- | ------------------------ | ----------- | -------------- |
| comment_id  | uuid                     | NO          | YES            |
| task_id     | uuid                     | NO          | NO             |
| user_id     | uuid                     | NO          | NO             |
| content     | text                     | NO          | NO             |
| parent_id   | uuid                     | YES         | NO             |
| created_at  | timestamp with time zone | YES         | NO             |
| updated_at  | timestamp with time zone | YES         | NO             |
| is_deleted  | boolean                  | YES         | NO             |
| metadata    | jsonb                    | YES         | NO             |

## 10. Bảng Comment_Mentions (Đề cập người dùng)

| Field          | Type           | Description                                      |
|----------------|----------------|--------------------------------------------------|
| id             | UUID/INT (PK)  | ID định danh duy nhất của bản ghi                |
| comment_id     | UUID/INT (FK)  | ID bình luận chứa đề cập                         |
| user_id        | UUID/INT (FK)  | ID người dùng được đề cập                        |
| is_read        | BOOLEAN        | Đã đọc thông báo hay chưa                        |
| created_at     | TIMESTAMP      | Thời gian tạo bản ghi                            |

## 11. Bảng Attachments (Tệp đính kèm)

| Field          | Type           | Description                                        |
|----------------|-----------------|----------------------------------------------------|
| attachment_id  | UUID/INT (PK)  | ID định danh duy nhất của tệp đính kèm              |
| owner_type     | VARCHAR(50)    | Loại đối tượng sở hữu ('project', 'task', 'comment') |
| owner_id       | INTEGER        | ID của đối tượng sở hữu                             |
| file_name      | VARCHAR(255)   | Tên tệp                                             |
| file_path      | VARCHAR(255)   | Đường dẫn lưu trữ tệp                              |
| file_size      | BIGINT         | Kích thước tệp (byte)                              |
| file_type      | VARCHAR(100)   | Loại tệp (MIME type)                               |
| uploaded_by    | UUID/INT (FK)  | ID người dùng tải lên tệp                          |
| uploaded_at    | TIMESTAMP      | Thời gian tải lên                                  |
| is_deleted     | BOOLEAN        | Đánh dấu đã xóa (xóa mềm)                          |

## 12. Bảng Snapshots (Bản chụp trạng thái)

| Field          | Type           | Description                                      |
|----------------|----------------|--------------------------------------------------|
| snapshot_id    | UUID/INT (PK)  | ID định danh duy nhất của bản chụp               |
| project_id     | UUID/INT (FK)  | ID dự án                                         |
| name           | VARCHAR(255)   | Tên bản chụp                                     |
| description    | TEXT           | Mô tả về bản chụp                                |
| created_by     | UUID/INT (FK)  | ID người dùng tạo bản chụp                       |
| created_at     | TIMESTAMP      | Thời gian tạo bản chụp                           |

## 13. Bảng Task_Snapshots (Bản chụp công việc)

| Field             | Type           | Description                                      |
|-------------------|----------------|--------------------------------------------------|
| id                | UUID/INT (PK)  | ID định danh duy nhất của bản ghi                |
| snapshot_id       | UUID/INT (FK)  | ID bản chụp                                      |
| task_id           | UUID/INT (FK)  | ID công việc                                     |
| title             | VARCHAR(255)   | Tiêu đề công việc tại thời điểm chụp             |
| description       | TEXT           | Mô tả công việc tại thời điểm chụp               |
| assignee_id       | UUID/INT (FK)  | ID người được giao tại thời điểm chụp            |
| status            | VARCHAR(50)    | Trạng thái tại thời điểm chụp                    |
| priority_order    | INTEGER        | Thứ tự ưu tiên tại thời điểm chụp                |
| start_date        | TIMESTAMP      | Thời gian bắt đầu tại thời điểm chụp             |
| due_date          | TIMESTAMP      | Thời hạn tại thời điểm chụp                      |
| effort            | DECIMAL(8,2)   | Công sức ước tính tại thời điểm chụp             |
| progress          | INTEGER        | Tiến độ tại thời điểm chụp                       |

## 14. Bảng Notifications (Thông báo)

| Field            | Type           | Description                                       |
|------------------|----------------|---------------------------------------------------|
| notification_id  | UUID/INT (PK)  | ID định danh duy nhất của thông báo               |
| user_id          | UUID/INT (FK)  | ID người dùng nhận thông báo                      |
| type             | VARCHAR(50)    | Loại thông báo (mention, task_assignment, etc.)   |
| reference_type   | VARCHAR(50)    | Loại tham chiếu (task, comment, project)          |
| reference_id     | INTEGER        | ID của đối tượng được tham chiếu                  |
| message          | TEXT           | Nội dung thông báo                                |
| is_read          | BOOLEAN        | Đã đọc hay chưa                                   |
| created_at       | TIMESTAMP      | Thời gian tạo thông báo                           |

## 15. Bảng Activity_Logs (Nhật ký hoạt động)

| Field          | Type           | Description                                       |
|----------------|----------------|---------------------------------------------------|
| id             | UUID/INT (PK)  | ID định danh duy nhất của bản ghi                 |
| project_id     | UUID/INT (FK)  | ID dự án liên quan                               |
| task_id        | UUID/INT (FK)  | ID công việc liên quan (nếu có)                  |
| user_id        | UUID/INT (FK)  | ID người dùng thực hiện hành động                 |
| action         | VARCHAR(100)   | Loại hành động (create, update, delete, etc.)     |
| entity_type    | VARCHAR(50)    | Loại đối tượng (task, comment, project, etc.)    |
| entity_id      | INTEGER        | ID của đối tượng bị tác động                     |
| details        | JSONB/JSON     | Chi tiết thay đổi                                |
| created_at     | TIMESTAMP      | Thời gian thực hiện hành động                    |

## Enums type
| ENUM TYPE             | ENUM VALUE                 |
| --------------------- | -------------------------- |
| member_role           | admin, member, viewer      |
| project_priority      | low, medium, high, urgent |
| project_status        | active, completed, on_hold, cancelled |
| project_visibility    | public, private, team      |
| task_priority         | low, medium, high, urgent, critical |
| task_status           | todo, doing, done, close, pending, review, blocked, rejected, archived |
| user_provider         | email, google, github       |
| user_role             | admin, user                |


## Ghi chú về thiết kế

1. **Kiểu dữ liệu ID**: Bạn có thể chọn UUID hoặc INT (AUTO_INCREMENT) tùy theo chiến lược ID bạn muốn sử dụng.

2. **Các mối quan hệ**:
   - 1 user → nhiều project (tạo dự án)
   - 1 project → nhiều member (thông qua bảng Project_Members)
   - 1 project → nhiều task
   - 1 task → nhiều task con
   - 1 task → 1 assignee (người thực hiện)
   - 1 task → nhiều comment
   - 1 task → nhiều duration (khoảng thời gian làm việc)

3. **Xử lý tự động lập lịch**:
   - Hệ thống sẽ dùng priority_order, start_date và effort để tự động sắp xếp task
   - Khi một task không có start_date, hệ thống sẽ tính toán dựa trên end_date của task ưu tiên trước đó
   - 1 ngày = 8 giờ làm việc

4. **Xử lý gián đoạn task**:
   - Bảng Task_Durations ghi lại các khoảng thời gian làm việc trên task
   - Khi task bị gián đoạn bởi task khẩn cấp, hệ thống tạo duration mới với status = 'paused'
   - Task khẩn cấp được bắt đầu với duration mới
   - Sau khi hoàn thành task khẩn cấp, task ban đầu được tiếp tục với duration mới

Schema này được thiết kế đầy đủ để hỗ trợ tất cả các chức năng mà bạn yêu cầu, bao gồm quản lý project, task phân cấp, sắp xếp ưu tiên, theo dõi thời gian, gantt chart, kanban board, notifications, và snapshot để so sánh kế hoạch.