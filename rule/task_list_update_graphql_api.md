# Cập nhật GraphQL API Frontend

## Tasks

### Authentication
- [x] Cập nhật mutation Register
- [x] Cập nhật mutation Login
- [x] Tạo file authApi.ts để xử lý authentication
- [x] Cập nhật AuthContext để sử dụng GraphQL mutations

### Projects
- [x] Cập nhật mutation CreateProject  
- [x] Cập nhật query GetProject
- [x] Tạo file projectApi.ts để quản lý Project APIs
- [x] Thêm interfaces cho Project types

### Tasks
- [x] Cập nhật mutation CreateTask  
- [x] Cập nhật mutation UpdateTask
- [x] Cập nhật query GetTasks
- [x] Tạo file taskApi.ts để quản lý Task APIs
- [x] Thêm interfaces cho Task types

### Implementation Details
1. Đã tạo graphqlClient.ts để xử lý GraphQL requests
2. Đã tách biệt logic xử lý API thành các modules:
   - authApi.ts: Xử lý authentication
   - projectApi.ts: Xử lý project CRUD
   - taskApi.ts: Xử lý task management
3. Cập nhật response types phù hợp với GraphQL schema mới
4. Đảm bảo type safety cho tất cả API calls

### Next Steps
1. Kiểm tra lại việc xử lý lỗi trong các API calls
2. Thêm unit tests cho các API functions
3. Cập nhật documentation cho API usage
4. Theo dõi hiệu năng của các GraphQL queries