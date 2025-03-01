# Task List: Additional Files to Merge

## API Routes
- [ ] Auth API Routes
  - task-scheduler-frontend/src/app/api/auth/firebase/login/route.ts
  - task-scheduler-frontend/src/app/api/auth/google/route.ts
  - task-scheduler-frontend/src/app/api/auth/login/route.ts
  - task-scheduler-frontend/src/app/api/auth/logout/route.ts
  - task-scheduler-frontend/src/app/api/auth/me/route.ts
  - task-scheduler-frontend/src/app/api/auth/register/route.ts

- [ ] Notification API Routes
  - task-scheduler-frontend/src/app/api/notifications/route.ts
  - task-scheduler-frontend/src/app/api/notifications/[id]/read/route.ts

- [ ] Project & Task API Routes
  - task-scheduler-frontend/src/app/api/projects/route.ts
  - task-scheduler-frontend/src/app/api/projects/[id]/route.ts
  - task-scheduler-frontend/src/app/api/projects/[id]/tasks/route.ts
  - task-scheduler-frontend/src/app/api/projects/[id]/tasks/[taskId]/priority/route.ts
  - task-scheduler-frontend/src/app/api/projects/[id]/tasks/[taskId]/status/route.ts
  - task-scheduler-frontend/src/app/api/projects/[id]/tasks/kanban/reorder/route.ts

## Authentication Components
- [ ] Auth Components
  - task-scheduler-frontend/src/components/auth/EmailVerification.tsx
  - task-scheduler-frontend/src/components/auth/LoginForm.tsx
  - task-scheduler-frontend/src/components/auth/RegisterForm.tsx

## Dashboard Components
- [ ] Dashboard Components
  - task-scheduler-frontend/src/components/dashboard/UserDashboard.tsx
  - task-scheduler-frontend/src/components/dashboard/__tests__/UserDashboard.test.tsx

## Project Components
- [ ] Project Components
  - task-scheduler-frontend/src/components/project/StatusUpdateModal.tsx
  - task-scheduler-frontend/src/components/projects/ProjectForm.tsx

## Task Components
- [ ] Task Components
  - task-scheduler-frontend/src/components/task/TaskFilters.tsx
  - task-scheduler-frontend/src/components/task/TaskItem.tsx
  - task-scheduler-frontend/src/components/task/TaskList.tsx
  - task-scheduler-frontend/src/components/tasks/__tests__/*

## UI Components
- [ ] Navigation Components
  - task-scheduler-frontend/src/components/ui/navigation/AccountDropdown.tsx
  - task-scheduler-frontend/src/components/ui/navigation/Layout.tsx
  - task-scheduler-frontend/src/components/ui/navigation/NotificationDropdown.tsx
  - task-scheduler-frontend/src/components/ui/navigation/Sidebar.tsx

- [ ] UI Common Components
  - task-scheduler-frontend/src/components/ui/accordion.tsx
  - task-scheduler-frontend/src/components/ui/ConfirmationModal.tsx
  - task-scheduler-frontend/src/components/ui/date-picker.tsx
  - task-scheduler-frontend/src/components/ui/ErrorBoundary.tsx
  - task-scheduler-frontend/src/components/ui/__tests__/Dialog.test.tsx

## Contexts and Providers
- [ ] Context
  - task-scheduler-frontend/src/contexts/AuthContext.tsx

- [ ] Providers
  - task-scheduler-frontend/src/components/providers/QueryClientProvider.tsx
  - task-scheduler-frontend/src/providers/SyncProvider.tsx

## Hooks
- [ ] Additional Hooks
  - task-scheduler-frontend/src/hooks/useAuth.ts
  - task-scheduler-frontend/src/hooks/useNotifications.ts
  - task-scheduler-frontend/src/hooks/useProject.ts
  - task-scheduler-frontend/src/hooks/useProjects.ts
  - task-scheduler-frontend/src/hooks/useStorageSync.ts
  - task-scheduler-frontend/src/hooks/useTaskFilters.ts

## Configuration and Utils
- [ ] Configuration
  - task-scheduler-frontend/src/lib/config.ts
  - task-scheduler-frontend/src/lib/firebase.ts
  - task-scheduler-frontend/src/lib/googleAuth.ts
  - task-scheduler-frontend/src/lib/queryClient.ts
  - task-scheduler-frontend/src/lib/__tests__/utils.test.ts

- [ ] Utils
  - task-scheduler-frontend/src/utils/storage.ts

## Project Setup Files
- [ ] Setup Files
  - task-scheduler-frontend/src/setupTests.ts
  - task-scheduler-frontend/src/middleware.ts

## Additional Data and Schemas
- [ ] Data
  - task-scheduler-frontend/src/data/mockProjects.ts
  - task-scheduler-frontend/src/data/tasks.json

- [ ] Schemas
  - task-scheduler-frontend/src/schemas/projectForm.ts

## Next Steps
1. [ ] Checkout to nhánh merge/feat-1.02-screens
2. [ ] Copy các file từ feature/v2.03 sang
3. [ ] Cài đặt dependencies
4. [ ] Kiểm tra và sửa các lỗi nếu có
5. [ ] Chạy thử NextJS để đảm bảo hoạt động

## Notes
- Các file này bổ sung thêm cho task list gốc trong task_list_migrate_v102_features.md
- Cần đảm bảo tích hợp suôn sẻ với các file đã có trong nhánh merge/feat-1.02-screens
- Chú ý đến các dependencies mới có thể được thêm vào