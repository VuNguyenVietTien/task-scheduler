# Authentication Layout Fixes

## Đã hoàn thành
- [x] Tách riêng layout cho trang authentication
- [x] Cập nhật root layout để điều kiện hiển thị Layout chính (header và sidebar)
- [x] Sắp xếp lại thứ tự các providers:
  - AuthProvider (ngoài cùng)
  - QueryProvider
  - ApolloProvider
  - SyncProvider

## Cấu trúc hiện tại
```
Root Layout (app/layout.tsx)
├── AuthProvider
├── QueryProvider
├── ApolloProvider
└── SyncProvider
    └── Layout (chỉ hiển thị khi không phải auth route)
        ├── Header
        ├── Sidebar
        └── Main Content

Auth Layout (app/auth/layout.tsx)
├── QueryProvider
└── AuthProvider
    └── Auth Content
```

## Giải thích thay đổi
1. Trang authentication (/auth/*) sử dụng layout riêng không có header và sidebar
2. Các trang khác sử dụng layout chính có đầy đủ header và sidebar
3. Providers được giữ ở root layout để đảm bảo toàn bộ ứng dụng có thể truy cập
4. Sử dụng usePathname để kiểm tra và render layout phù hợp