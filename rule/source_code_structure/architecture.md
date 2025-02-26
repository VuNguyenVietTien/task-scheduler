# Application Architecture

## Component Structure

### Task Management Components

#### Task Views
- `TaskListView.tsx`: Hiển thị danh sách task dưới dạng bảng với các chức năng filter và sort
- `KanbanBoard.tsx`: Hiển thị task dưới dạng board với các cột theo status, hỗ trợ drag & drop
- `Timeline.tsx`: Hiển thị Gantt chart với các taskbar theo timeline

#### Task Components
- `TaskBar.tsx`: Component hiển thị task trong Gantt chart
  - Props: task, days
  - Features: 
    - Màu sắc theo status
    - Tooltip khi hover
    - Tự động tính toán vị trí và độ rộng dựa trên ngày
- `TaskTooltip.tsx`: Component tooltip hiển thị chi tiết task
  - Props: task, style
  - Features:
    - Hiển thị thông tin task: title, status, priority, effort, assignees
    - Format ngày tháng
    - Style theo status và priority
- `TaskFilterBar.tsx`: Component filter cho task list
- `TaskBulkActions.tsx`: Component xử lý bulk actions cho task list

### Utilities 

#### Task Scheduling
`taskScheduler.ts`: Module xử lý logic tính toán ngày cho Gantt chart
- Functions:
  - `calculateTaskDates()`: Tính toán ngày bắt đầu/kết thúc cho các task
    - Input: Task[]
    - Output: Task[] với startDate và deadline đã được tính toán
    - Logic:
      1. Ưu tiên dùng startDate và deadline có sẵn
      2. Nếu chỉ có deadline thì tính ngược ngày bắt đầu theo effort
      3. Nếu chỉ có startDate thì tính ngày kết thúc theo effort
      4. Nếu không có ngày thì lấy ngày kết thúc của task trước + 1
      5. Nếu là task đầu tiên thì lấy ngày hiện tại

## Data Flow

1. Tasks được lấy từ API/mock data
2. TaskListView/KanbanBoard/Timeline nhận tasks qua props
3. Các component con (TaskBar, TaskTooltip) nhận task đơn lẻ và hiển thị
4. Khi có thay đổi (kéo thả task, bulk actions):
   - Gọi callback function được truyền từ component cha
   - Cập nhật state ở component cha
   - Re-render các component con với data mới

## State Management

- Local state: useState cho các trạng thái UI (filter, sort, selection)
- Context API: Global state cho user preferences, theme
- Server state: React Query cho data fetching và caching
