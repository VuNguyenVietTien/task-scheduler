# Sửa lỗi Layout và Authentication

## Đã hoàn thành
- [x] Thêm useReorderTasks hook vào useTasks.ts
- [x] Cập nhật TaskResponse và TaskData interface để thêm projectId
- [x] Tạo layout riêng cho trang authentication (auth/layout.tsx)
- [x] Tạo protected layout cho các trang yêu cầu đăng nhập
- [x] Đơn giản hóa root layout, loại bỏ Header và Sidebar
- [x] Chuyển trang dashboard vào thư mục (protected)
- [x] Chuyển trang project detail vào thư mục (protected)
- [x] Loại bỏ ProtectedRoute component khỏi project detail page
- [x] Sửa lỗi TypeScript trong project detail page:
  - Thêm projectId vào transformTaskResponse
  - Thêm import React
  - Cập nhật đường dẫn API endpoint

## Cần kiểm tra
- [ ] Kiểm tra luồng chuyển hướng sau khi đăng nhập/đăng xuất
- [ ] Kiểm tra việc hiển thị/ẩn Header và Sidebar trong các trang khác nhau
- [ ] Kiểm tra lại việc sắp xếp tasks có hoạt động đúng
- [ ] Kiểm tra hiệu năng loading của các trang
- [ ] Đảm bảo không có trang nào bị vỡ layout

## Các vấn đề đã giải quyết
1. Lỗi useReorderTasks không được định nghĩa
   - Đã thêm hook useReorderTasks vào useTasks.ts
   - Đã cập nhật interface để thêm projectId

2. Vấn đề layout
   - Tạo layout riêng cho auth pages
   - Tạo protected layout cho các trang yêu cầu đăng nhập
   - Đơn giản hóa root layout
   - Di chuyển các trang yêu cầu authentication vào thư mục protected

## Ghi chú
- Layout mới đã được tổ chức theo cấu trúc:
  * Root layout: Chỉ chứa providers cơ bản
  * Auth layout: Layout đơn giản cho trang đăng nhập
  * Protected layout: Layout đầy đủ với Header và Sidebar cho các trang đã đăng nhập
- Sử dụng user object từ AuthContext để kiểm tra trạng thái đăng nhập
- Đã cập nhật các interface và hook để hỗ trợ tốt hơn cho việc quản lý tasks