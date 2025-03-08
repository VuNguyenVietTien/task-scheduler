# Sửa lại API truy xuất Projects

## Các thay đổi đã thực hiện

- [x] Frontend:
  - [x] Sửa GraphQL query GetUserProjects để bỏ tham số userId
  - [x] Cập nhật ProjectList component để không truyền userId vào query
  - [x] Lấy danh sách project dựa vào thông tin auth token

- [x] Backend:
  - [x] Sửa resolver projects để lấy userId từ auth context
  - [x] Cập nhật logic để lấy tất cả project mà user là thành viên
  - [x] Thêm owner vào project_members khi tạo project mới

## Cần test

- [ ] Test việc lấy projects:
  - [ ] Đăng nhập thành công và lấy được token
  - [ ] Gọi API GetUserProjects không cần truyền userId
  - [ ] Kiểm tra kết quả trả về có đúng các project mà user là thành viên
  - [ ] Kiểm tra error handling khi chưa đăng nhập
  
- [ ] Test việc tạo project:
  - [ ] Owner tự động được thêm vào project_members
  - [ ] Các member khác được thêm vào thành công
  - [ ] Kiểm tra quyền truy cập project sau khi tạo

## Security Checks

- [ ] Xác nhận rằng user chỉ có thể xem các project mà họ là thành viên
- [ ] Kiểm tra token validation hoạt động chính xác
- [ ] Đảm bảo không có lỗ hổng bảo mật khi truy xuất dữ liệu