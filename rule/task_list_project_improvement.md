# Task List: Cải thiện Project Management

## Bổ sung các trường thông tin cho Project

Dựa trên phân tích từ các hệ thống quản lý dự án phổ biến như Jira, Trello, Monday.com:

- [ ] Thêm các trường vào database schema:
  - start_date: Ngày bắt đầu dự án
  - due_date: Ngày kết thúc dự án
  - status: Trạng thái dự án (NEW, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED)
  - priority: Độ ưu tiên của dự án (LOW, MEDIUM, HIGH, URGENT)
  - category: Phân loại dự án (DEVELOPMENT, MARKETING, RESEARCH, etc.)
  - metadata: Thông tin bổ sung dạng JSONB (budget, client_info, etc.)
  - visibility: Phạm vi hiển thị (PUBLIC, PRIVATE, TEAM)
  - tags: Các tag để phân loại và tìm kiếm
  - progress: Tiến độ hoàn thành (0-100%)

- [ ] Cập nhật API endpoints:
  - Thêm các trường mới vào CreateProjectRequest
  - Thêm các trường mới vào UpdateProjectRequest  
  - Cập nhật ProjectResponse để trả về đầy đủ thông tin

## Cải thiện Layout Form Create/Update Project

- [ ] Thiết kế form layout theo sections:
  - Basic Information (name, description, category)
  - Timeline (start_date, due_date)
  - Details (status, priority, visibility)
  - Additional Info (tags, metadata)

- [ ] Tối ưu hóa UX/UI:
  - Sử dụng grid layout cho form
  - Thêm field validation và error messages
  - Thêm tooltips giải thích ý nghĩa các trường
  - Tách form thành các section có thể collapse/expand
  - Thêm preview kết quả trước khi submit

## Cập nhật Documentation

- [ ] Cập nhật API documentation
- [ ] Cập nhật database schema documentation
- [ ] Thêm hướng dẫn sử dụng cho người dùng