# Cải thiện Authentication Flow

## Các thay đổi đã thực hiện

### Frontend
- [x] Cập nhật AuthContext để xử lý refresh token tự động mỗi 15 phút
- [x] Lưu token trong HttpOnly cookie thay vì localStorage
- [x] Cập nhật API client để lấy token từ cookie
- [x] Thêm xử lý refresh token khi gọi API bị 401
- [x] Thêm SameSite=Strict cho cookie để tăng bảo mật

### API Authentication
- [x] Backend có middleware verify token
- [x] GraphQL handler xử lý token trong header
- [x] Kiểm tra token cho các protected routes
- [x] Tối ưu flow đăng nhập/đăng ký để trả về token
- [x] Thêm refresh token endpoint

## Kiểm tra
- [x] Login bằng Google account thành công
- [x] Token được lưu trong cookie
- [x] Protected routes yêu cầu token
- [x] Token tự động refresh
- [x] Logout xóa token