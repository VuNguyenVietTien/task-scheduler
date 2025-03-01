# Cải thiện chất lượng code

## Auth Module
- [ ] Add comment để giải thích cho việc re-export Auth middleware
- [ ] Kiểm tra và xử lý các unused functions trong mod.rs:
  - find_by_id  
  - verify_email_token
  - find_by_verification_token

## API Module
- [ ] Kiểm tra và xử lý các unused fields trong auth requests:
  - VerifyEmailRequest.token
  - SetNewPasswordRequest.token và password

## Auth Service
- [ ] Review và cập nhật phương thức get_user_by_firebase_uid nếu cần thiết

## Config
- [ ] Review và cập nhật các fields không được sử dụng:
  - supabase_url
  - supabase_key  
  - smtp_port
  - allowed_origins
  - max_file_size

## Firebase Module
- [ ] Review và cập nhật phương thức verify_token_and_get_claims

## Auth Error
- [ ] Kiểm tra và cập nhật các error variants không được sử dụng:
  - TokenExpired
  - ResetTokenExpired  
  - ResetTokenInvalid
  - PasswordResetFailed
  - NotAuthenticated
  - NotAuthorized

## Đã hoàn thành
- [x] Thêm log chi tiết cho authorization middleware
- [x] Thêm log chi tiết cho API projects
- [x] Sửa lỗi borrow sau khi move trong auth middleware