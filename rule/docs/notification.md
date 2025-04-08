Khi user tạo task rồi assign cho 1 member khác mà không phải họ thì sẽ gửi notification đến người đó.  
Khi user comment mà có tag người khác thì sẽ gửi thông báo đến người đó
---
Hiện tại:
- ở phần common header có chuông thông báo với dummy data rồi. hãy bỏ dummy data truyền data thực vào giúp tôi. khi click vào chuông thông báo sẽ show ra list thông báo đã đọc và chưa đọc với background khác nhau, khi click vào thông báo sẽ di chuyển đến task hoặc comment được tag vào.
- chức năng comment chưa có logic dùng @ để tag tên member, hãy implement giúp tôi
- mỗi comment cũng nên có 1 link để khi click vào notification thì sẽ đi đến màn hình task chứa comment đó và hiển thị đúng vị trí comment được tag

Dưới đây là màn hình:
task detail chứa nội dung detail task và có comment: /Users/TienVNV/Desktop/ProjectManager/task-scheduler-frontend/src/app/projects/[id]/tasks/[taskId]/page.tsx
/Users/TienVNV/Desktop/ProjectManager/task-scheduler-frontend/src/components/tasks/TaskDetailPage.tsx

Đã có graphql api để create task và comment cho task rồi, giờ cần thêm là khi create task có gán assignee là người khác và comment có tag tên người khác, hoặc update thay đổi assignee cho task thì thực hiện gửi thông báo đến người đó. Mong muốn là được push real time. nghĩa là khi 2 người cùng mở app, user A thực hiện comment tag tên user B hoặc assign task cho user B thì phía B có chuông thông báo sẽ được được cập nhật số thông báo tăng lên. Click vào hiển thị danh sách thông báo, click vào sẽ đi đến task detail nếu là assign cho user đó, hoặc đi đến comment có tag user đó.

## Phân tích và danh sách công việc cần thực hiện

### 1. Cập nhật cấu trúc database
- [ ] Thêm trường `project_id` vào bảng `notifications` để liên kết với project
- [ ] Thêm trường `sender_id` vào bảng `notifications` để biết người gửi thông báo
- [ ] Thêm trường `action` vào bảng `notifications` để phân biệt loại hành động (assign, mention, etc.)
- [ ] Thêm trường `metadata` vào bảng `notifications` để lưu thông tin bổ sung (JSONB)

### 2. Backend Implementation
- [ ] Tạo GraphQL mutation để tạo notification
- [ ] Tạo GraphQL query để lấy danh sách notifications của user
- [ ] Tạo GraphQL mutation để đánh dấu notification đã đọc
- [ ] Tạo GraphQL mutation để đánh dấu tất cả notifications đã đọc
- [ ] Tạo GraphQL subscription để push real-time notifications
- [ ] Cập nhật logic tạo task để gửi notification khi assign task cho user khác
- [ ] Cập nhật logic update task để gửi notification khi thay đổi assignee
- [ ] Cập nhật logic tạo comment để gửi notification khi mention user khác
- [ ] Tạo service để xử lý việc gửi notification

### 3. Frontend Implementation
- [ ] Cập nhật component chuông thông báo để hiển thị số lượng thông báo chưa đọc
- [ ] Tạo component hiển thị danh sách thông báo (đã đọc và chưa đọc với background khác nhau)
- [ ] Tạo component dropdown hiển thị danh sách thông báo khi click vào chuông
- [ ] Tạo trang quản lý thông báo (nếu cần)
- [ ] Cập nhật component comment để hỗ trợ @ mention
- [ ] Tạo component hiển thị danh sách user khi gõ @ trong comment
- [ ] Tạo component hiển thị user được mention trong comment
- [ ] Cập nhật logic điều hướng khi click vào notification

### 4. Real-time Implementation
- [ ] Cài đặt WebSocket hoặc GraphQL Subscription để push real-time notifications
- [ ] Tạo service để xử lý WebSocket/Subscription connection
- [ ] Cập nhật frontend để lắng nghe real-time notifications
- [ ] Cập nhật UI để hiển thị thông báo mới ngay lập tức

### 5. Testing
- [ ] Tạo unit test cho các service xử lý notification
- [ ] Tạo integration test cho các API notification
- [ ] Tạo end-to-end test cho luồng notification
- [ ] Test real-time notification giữa các user

### 6. Documentation
- [ ] Cập nhật API documentation
- [ ] Tạo hướng dẫn sử dụng cho người dùng
- [ ] Tạo hướng dẫn phát triển cho team