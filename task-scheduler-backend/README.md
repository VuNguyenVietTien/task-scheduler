# Task Scheduler Backend

Backend service cho ứng dụng quản lý công việc và dự án, được xây dựng với Rust, GraphQL và PostgreSQL.

## Tính năng

- Xác thực và phân quyền người dùng
- Quản lý dự án và thành viên dự án
- Quản lý công việc với các tính năng:
  - Phân công công việc
  - Phụ thuộc giữa các công việc
  - Bình luận và trao đổi
  - Tải lên tài liệu đính kèm
- Thông báo realtime qua WebSocket
- GraphQL API với playground để thử nghiệm

## Yêu cầu

- Rust 1.70+ và Cargo
- PostgreSQL 15+
- Docker (tùy chọn)

## Cài đặt

1. Clone repository:
```bash
git clone https://github.com/your-username/task-scheduler-backend.git
cd task-scheduler-backend
```

2. Cài đặt các dependencies:
```bash
cargo build
```

3. Thiết lập cơ sở dữ liệu:
```bash
# Với PostgreSQL cài đặt local
createdb task_scheduler

# Hoặc sử dụng Docker
docker run -d \
  --name task-scheduler-db \
  -e POSTGRES_DB=task_scheduler \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15
```

4. Tạo file .env:
```bash
cp .env.example .env
```

5. Chạy migrations:
```bash
cargo run --bin migrate
```

## Chạy ứng dụng

1. Development mode:
```bash
cargo run
```

2. Production mode:
```bash
cargo run --release
```

Ứng dụng sẽ chạy tại: http://localhost:8080

GraphQL playground: http://localhost:8080/playground

## API Endpoints

- `/graphql` - GraphQL API endpoint
- `/playground` - GraphQL playground
- `/ws` - WebSocket endpoint cho thông báo realtime

## Cấu hình môi trường

File `.env`:

```env
HOST=127.0.0.1
PORT=8080
DATABASE_URL=postgres://postgres:postgres@localhost:5432/task_scheduler
JWT_SECRET=your-secret-key
JWT_EXPIRY=86400
CORS_ORIGIN=http://localhost:3000
UPLOAD_DIR=uploads
MAX_UPLOAD_SIZE=10485760
```

## Testing

Chạy unit tests:
```bash
cargo test
```

## Docker

Build image:
```bash
docker build -t task-scheduler-backend .
```

Chạy container:
```bash
docker run -d \
  --name task-scheduler-backend \
  -p 8080:8080 \
  --env-file .env \
  task-scheduler-backend
```

## Tài liệu API

Chi tiết API có thể xem trong GraphQL playground hoặc tại thư mục `docs/`

## Contributing

1. Fork repository
2. Tạo branch cho tính năng mới (`git checkout -b feature/amazing-feature`)
3. Commit thay đổi (`git commit -m 'Add some amazing feature'`)
4. Push lên branch (`git push origin feature/amazing-feature`)
5. Tạo Pull Request

## License

MIT License
