# Firebase Authentication Integration Tasks

## Backend Setup
- [x] Cài đặt Firebase Admin SDK
  - [x] Thêm dependencies
  - [x] Cấu hình service account
  - [x] Khởi tạo Firebase app
- [x] Tạo Firebase service
  - [x] Verify ID tokens
  - [x] Decode user info
  - [x] Handle custom claims
- [x] Cập nhật user model
  - [x] Thêm Firebase UID
  - [x] Thêm các trường provider
  - [x] Handle user metadata

## Backend Integration
- [x] Error Handling
  - [x] Tạo Firebase error types
  - [x] Map Firebase errors
  - [x] HTTP response codes
- [x] Auth Service Integration
  - [x] Firebase login flow
  - [x] User linking
  - [x] Token management
- [x] API Endpoints
  - [x] Firebase login endpoint
  - [x] Token verification
  - [x] Error responses

## Frontend Implementation
- [ ] Cài đặt Firebase client SDK
  - [ ] Thêm dependencies
  - [ ] Cấu hình Firebase app
  - [ ] Set up auth providers
- [ ] Tạo các components
  - [ ] Social login buttons
  - [ ] OAuth popup/redirect
  - [ ] Loading states
- [ ] Cập nhật Auth Context
  - [ ] Thêm Firebase auth state
  - [ ] Handle tokens
  - [ ] Sync với backend

## Testing & Documentation
- [ ] Unit Tests
  - [ ] Token validation
  - [ ] User management
  - [ ] Error handling
- [ ] Integration Tests
  - [ ] Auth flows
  - [ ] Account linking
  - [ ] Session management
- [ ] Documentation
  - [ ] API specs
  - [ ] Auth flows
  - [ ] Setup guide

## Security
- [x] Implement token validation
  - [x] Check signature
  - [x] Verify claims
  - [x] Handle expiration
- [x] Secure user linking
  - [x] Validate providers
  - [x] Prevent duplicates
  - [x] Handle conflicts
- [ ] Session security
  - [ ] Token rotation
  - [ ] Revocation handling
  - [ ] Rate limiting

## Deployment
- [ ] Environment setup
  - [ ] Firebase configs
  - [ ] Service accounts
  - [ ] Cors settings
- [ ] CI/CD updates
  - [ ] Build steps
  - [ ] Test coverage
  - [ ] Security checks