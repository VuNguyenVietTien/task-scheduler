# Authentication Fixes

## Token Storage and Usage
- [x] Sửa lỗi đọc token từ cookie sang localStorage trong api.ts
- [x] Sửa API base URL sử dụng port 8080 thay vì port 8000
- [x] Chuyển sang sử dụng localStorage để lưu trữ token
- [x] Đảm bảo token được gắn vào Authorization header khi gọi API

## Kiểm tra và xác nhận
- [ ] Kiểm tra lại flow đăng nhập
- [ ] Xác nhận token được lưu đúng trong localStorage
- [ ] Xác nhận API calls có gắn token trong header
- [ ] Kiểm tra backend nhận được token đúng