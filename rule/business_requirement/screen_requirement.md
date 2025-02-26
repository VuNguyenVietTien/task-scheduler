Dưới đây là danh sách các yêu cầu (requirements) cho dự án quản lý project và task của bạn, được chia thành các phần: màn hình, component, chức năng, menu, và luồng điều hướng.

---

### **1. Các Màn Hình Chính**
#### **1.1. Màn hình Đăng Nhập/Đăng Ký (Auth)**
- **Component**:
  - Form đăng nhập bằng email/password hoặc Google (Firebase Auth).
  - Link chuyển sang đăng ký nếu chưa có tài khoản.
- **Chức năng**:
  - Xác thực bằng Firebase.
  - Lưu thông tin user vào database (user ID, email, tên, avatar).

---

#### **1.2. Dashboard (Trang Tổng Quan)**
- **Component**:
  - Thống kê cá nhân: Số task đang làm, sắp đến hạn, trễ hạn.
  - Danh sách project tham gia (dạng grid/card).
  - Quick actions: "Tạo Project Mới", "Tạo Task Nhanh".
- **Chức năng**:
  - Click vào project để vào **Project Detail**.
  - Click "Tạo Project" → Mở form tạo project.

---

#### **1.3. Màn hình Project Detail**
- **Component**:
  - **Header**: Tên project, menu dropdown (Settings, Delete, Export).
  - **Tab Menu**: 
    - Kanban Board (To Do / In Progress / Done).
    - Task List (Table View).
    - Gantt Chart.
    - Báo cáo.
  - **Left Sidebar**:
    - Danh sách thành viên trong project.
    - Filter task theo status, assignee, priority.
    - Button "Tạo Task Mới".
  - **Right Sidebar** (tuỳ chọn):
    - Thông tin chi tiết task đang chọn.
- **Chức năng**:
  - Kéo thả task giữa các cột trong Kanban.
  - Tự động sắp xếp task theo priority và start date.
  - Xem Gantt Chart với timeline và dependencies.

---

#### **1.4. Màn hình Task Detail**
- **Component**:
  - Thông tin task: Title, description, priority (High/Medium/Low), start/end date, effort (giờ), assignee.
  - Subtask (progress: Study, Investigate, Coding, Review, Testing, Release).
  - **Rich Text Comment Section**:
    - Editor hỗ trợ table, image upload, drag-and-drop.
    - Hiển thị comment theo thời gian (mới nhất ở trên).
  - Lịch sử thay đổi (log activity).
- **Chức năng**:
  - Thêm/remove subtask.
  - Tag người dùng trong comment (@mention).

---

#### **1.5. Màn hình Gantt Chart**
- **Component**:
  - Timeline hiển thị task của project hoặc cá nhân.
  - Có thể kéo thả để điều chỉnh timeline.
  - Màu sắc phân biệt theo priority/status.
- **Chức năng**:
  - Toggle giữa "Project View" và "User View".
  - Export Gantt Chart sang PDF/PNG.

---

#### **1.6. Màn hình Báo Cáo**
- **Component**:
  - Bảng thống kê: Task hoàn thành/trễ hạn, effort theo tuần/tháng.
  - Biểu đồ so sánh kế hoạch vs thực tế.
  - Filter theo project, user, timeframe.
- **Chức năng**:
  - Tự động phát hiện task gấp xen vào.
  - Export báo cáo sang PDF/Excel.

---

### **2. Component Trên Các Thanh Menu**
#### **2.1. Header Menu**
- Logo ứng dụng (link về Dashboard).
- **Search Bar**:
  - Tìm task theo title, description, status, assignee.
- **Notification Bell**:
  - Thông báo khi task được assign, comment, hoặc sắp hết hạn.
- **Profile Dropdown**:
  - Tên user, avatar.
  - Menu: Profile Settings, Logout.

#### **2.2. Nav Bar (Vertical Left Sidebar)**
- **Dashboard**: Trang tổng quan.
- **Projects**: Danh sách project.
- **Reports**: Báo cáo cá nhân/dự án.
- **Calendar**: Xem task theo lịch.

#### **2.3. Right Sidebar (Tuỳ Context)**
- **Project Detail**: Thành viên, filter.
- **Task Detail**: Thông tin task, lịch sử.

---

### **3. Chức Năng Chính**
#### **3.1. Quản lý Task**
- Tạo task với các trường: Title, description, priority, start/end date, effort, assignee.
- Tự động sắp xếp task:
  - Cá nhân: Ưu tiên > start date (nếu không có start date → chỉ xếp theo priority).
  - Project: Song song nhiều task (dựa trên assignee và timeline).
- Chuyển đổi giữa các progress (study → coding → testing...).

#### **3.2. Quản lý Project**
- Tạo project với tên, mô tả, thành viên.
- Phân quyền: Owner, Member (chỉnh sửa/comment).

#### **3.3. Báo Cáo**
- Tự động tổng hợp task đã hoàn thành/trễ hạn.
- So sánh kế hoạch tuần trước vs thực tế.

---

### **4. Luồng Điều Hướng**
- **Dashboard** → **Create Project** → Nhập thông tin → Lưu.
- **Project List** → Click vào project → **Project Detail** → **Create Task**.
- **Task List** → Click vào task → **Task Detail** → Thêm comment/subtask.
- **Header Menu** → Search Task → Hiển thị kết quả trong popup/trang riêng.
- **Profile Dropdown** → Profile Settings → Chỉnh sửa thông tin cá nhân.

---

### **5. Yêu Cầu Kỹ Thuật**
- **Backend**: Firebase (Auth, Firestore).
- **Frontend**: Hỗ trợ drag-and-drop (React Beautiful DnD hoặc similar).
- **Rich Text Editor**: TinyMCE hoặc Slate.js.
- **Gantt Chart**: DHTMLX Gantt hoặc tự xây dựng với D3.js.

---

### **6. Màn Hình Phụ**
- **User Profile**: Chỉnh sửa thông tin, avatar.
- **Calendar View**: Hiển thị task theo lịch cá nhân/dự án.
- **Admin Panel** (nếu cần): Quản lý user toàn hệ thống.

---

### **7. Thiết Kế UI/UX**
- **Dark/Light Mode**: Tuỳ chọn theme.
- **Responsive**: Hỗ trợ mobile/tablet.
- **Animation**: Hiệu ứng khi kéo thả task, chuyển trang.