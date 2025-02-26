### **Tổng hợp Business Requirements**  
Dự án SaaS của bạn nhằm mục tiêu **tự động hóa việc lập kế hoạch (plan) và lịch trình (schedule)** cho các task trong dự án dựa trên input của quản lý (priority, effort, dependencies) và trạng thái thực tế của công việc. Hệ thống sẽ giúp doanh nghiệp **đo lường khả năng hoàn thành dự án**, tối ưu hóa phân công nhân sự, và phản ứng linh hoạt với các thay đổi.

---

### **I. Yêu cầu nghiệp vụ chính**  
#### **1. Quản lý Task & Subtask**  
- **Task cha**:  
  - Thuộc tính cơ bản: Title, mô tả, độ ưu tiên, effort tổng, assignee (người chịu trách nhiệm), nhóm chức năng (design, coding...), dependencies (task phụ thuộc), trạng thái (backlog, in progress, done...).  
  - Quản lý file đính kèm (tài liệu, hình ảnh) và trao đổi nội bộ (comments).  
- **Subtask**:  
  - Phân loại theo giai đoạn: Study → Estimate → Design → Coding → Testing → Review → Release.  
  - Mỗi subtask có effort (thời gian ước tính), assignee, deadline tự động hoặc manual.  
  - Subtask có thể có dependencies (VD: "Testing" chỉ bắt đầu sau khi "Coding" hoàn thành).  

#### **2. Tự động lập Schedule**  
- **Input**:  
  - Độ ưu tiên của task (thứ tự trong danh sách).  
  - Effort của từng subtask.  
  - Dependencies giữa các task và subtask.  
  - Phân công nhân sự (PIC) và năng lực làm việc (VD: 1 developer chỉ làm 8h/ngày).  
- **Output**:  
  - Timeline tổng thể của dự án.  
  - Deadline cho từng task/subtask.  
  - Cảnh báo nếu dự án không thể hoàn thành đúng hạn (dựa trên effort và resource).  

#### **3. Tái lập Schedule động**  
- Khi có thay đổi:  
  - Thêm/xóa task, thay đổi độ ưu tiên.  
  - Thay đổi effort, dependencies, hoặc assignee.  
  - Trễ deadline hoặc thay đổi trạng thái task.  
- Hệ thống tự động điều chỉnh timeline và thông báo impact (VD: delay 2 ngày do chèn task khẩn cấp).  

#### **4. Báo cáo & So sánh**  
- Chụp snapshot plan hiện tại để lưu trữ.  
- So sánh các version plan (trước/sau khi thay đổi) để đánh giá hiệu quả.  
- Xuất báo cáo dưới dạng PDF/Excel.  

#### **5. Phân quyền & Collaboration**  
- **Vai trò**:  
  - Manager: Tạo task, set priority, xem tổng quan dự án.  
  - Member: Tạo subtask, cập nhật trạng thái, trao đổi nội bộ.  
- Thông báo real-time khi task được giao hoặc thay đổi.  

---

### **II. Các chức năng cần thiết**  
#### **A. Chức năng chính**  
1. **Task Management**:  
   - Tạo/sửa/xóa task và subtask.  
   - Kéo thả để sắp xếp độ ưu tiên.  
   - Gán dependencies (task A → task B).  
   - Upload tài liệu và trao đổi qua comments.  

2. **Scheduling Engine**:  
   - Tự động tính toán timeline dựa trên thuật toán (Critical Path Method, Resource Leveling).  
   - Hiển thị timeline dạng Gantt Chart hoặc Kanban.  
   - Cảnh báo xung đột resource hoặc quá tải công việc.  

3. **Dynamic Rescheduling**:  
   - Tự động cập nhật timeline khi có thay đổi.  
   - Highlight các task bị ảnh hưởng (delay/accelerate).  

4. **Reporting & Analytics**:  
   - Báo cáo tiến độ tổng thể (% hoàn thành, effort còn lại).  
   - So sánh plan cũ vs plan mới.  
   - Dự đoán ngày kết thúc dự án.  

5. **User Dashboard**:  
   - Manager: Xem timeline tổng, resource allocation, cảnh báo rủi ro.  
   - Member: Xem task được giao, deadline, và dependencies.  

#### **B. Chức năng phụ trợ**  
1. **Integrations**:  
   - Kết nối với công cụ chat (Slack), lưu trữ (Google Drive), hoặc DevOps tools (Jira, GitHub).  
2. **Notifications**:  
   - Thông báo qua email/app khi có thay đổi task hoặc deadline.  
3. **Time Tracking**:  
   - Member cập nhật thời gian thực tế làm task để hệ thống điều chỉnh effort.  

---

### **III. Yêu cầu kỹ thuật (Non-functional)**  
1. **Scalability**:  
   - Xử lý được nhiều dự án cùng lúc, hỗ trợ 1000+ task.  
2. **Security**:  
   - RBAC (Role-Based Access Control), mã hóa dữ liệu.  
3. **Performance**:  
   - Tải timeline trong <3s dù có 500 task.  
4. **UI/UX**:  
   - Giao diện trực quan, drag-and-drop, dark/light mode.  

---

### **IV. Ví dụ nghiệp vụ**  
**Scenario**:  
- **Task cha**: "Phát triển tính năng Login" (effort 40h, độ ưu tiên cao).  
- **Subtask**:  
  - Study (4h) → Design (8h) → Coding (20h) → Testing (6h) → Release (2h).  
- **Dependencies**: Coding phải hoàn thành trước Testing.  
- **Resource**: 1 developer (8h/ngày), 1 tester (4h/ngày).  
- **Kết quả**:  
  - Hệ thống lên lịch Coding trong 2.5 ngày, Testing trong 1.5 ngày.  
  - Nếu manager chèn task "Fix bug UI" (effort 10h, độ ưu tiên cao hơn), hệ thống tự delay Release và thông báo impact.  

---

### **V. Định hướng phát triển**  
- **AI Enhancement**: Dùng AI để đề xuất phân công task hoặc dự đoán rủi ro.  
- **Mobile App**: Cho member cập nhật task trên điện thoại.  
- **Time Tracking Automation**: Tích hợp với tools như Toggl.  

Hệ thống này sẽ giúp doanh nghiệp **tối ưu hóa quy trình**, giảm thời gian lập kế hoạch thủ công và tăng độ chính xác trong quản lý dự án.
### **Bổ sung và Tổng hợp Chi tiết Yêu cầu**  
Dưới đây là các yêu cầu chi tiết được mở rộng từ đề bài, bao gồm chức năng, màn hình, đối tượng, và yêu cầu kỹ thuật:

---

### **I. Yêu cầu nghiệp vụ chính (Bổ sung)**  
#### **6. Quản lý Người dùng & Phân quyền**  
- **Đối tượng**:  
  - **User**: Tài khoản người dùng với thông tin cơ bản (email, tên, role, năng lực làm việc).  
  - **Role**: Manager, Member, Admin (toàn quyền hệ thống).  
  - **Project**: Mỗi dự án có danh sách thành viên được thêm vào.  
- **Chức năng**:  
  - Admin có thể tạo, chỉnh sửa, xóa user.  
  - Manager thêm/xóa user vào dự án và phân quyền (chỉnh sửa task, xem báo cáo...).  
  - User chỉ xem và thao tác trên task được gán.  

#### **7. Task Ticket & Collaboration**  
- **Task Ticket**:  
  - Trang chi tiết task bao gồm:  
    - Title, mô tả (markdown), status (backlog, in progress, done...).  
    - Start date, deadline, effort (giờ), priority (high/medium/low).  
    - Danh sách subtask theo giai đoạn (study, design, coding...).  
    - Assignees (một hoặc nhiều user).  
    - File đính kèm (PDF, hình ảnh, tài liệu).  
    - Bình luận với hỗ trợ markdown, bảng biểu, upload ảnh kéo thả.  
- **Chức năng**:  
  - Lọc task theo tên, assignee, status, priority, deadline.  
  - Tự động nhắc nhở qua email/app khi deadline sắp đến.  

---

### **II. Các chức năng cần thiết (Bổ sung)**  
#### **C. Chức năng Quản lý Người dùng**  
1. **User Management**:  
   - Tạo/sửa/xóa user (Admin).  
   - Reset mật khẩu, cập nhật thông tin cá nhân.  
2. **Project Membership**:  
   - Thêm/xóa user vào dự án (Manager/Admin).  
   - Phân quyền trong dự án (VD: Member chỉ cập nhật task được gán).  
3. **Profile Management**:  
   - User tự cập nhật avatar, thông tin liên hệ, thiết lập notification preferences.  

#### **D. Chức năng Hiển thị & Tương tác**  
1. **Dashboard**:  
   - **Manager View**:  
     - Gantt Chart tổng thể dự án, resource allocation (biểu đồ phân bổ nhân sự).  
     - Cảnh báo quá tải công việc (VD: user được gán quá 8h/ngày).  
   - **Member View**:  
     - Danh sách task được gán với deadline và tiến độ.  
     - Timeline cá nhân (xem task theo tuần/tháng).  
2. **Task List & Filter**:  
   - Hiển thị dạng danh sách hoặc Kanban, kéo thả để thay đổi status.  
   - Lọc task theo:  
     - Từ khóa, assignee, status, priority, nhóm chức năng (coding/testing...).  
     - Deadline (quá hạn, sắp đến hạn).  
3. **Rich Text Editor cho Comments**:  
   - Hỗ trợ markdown, chèn ảnh (kéo thả hoặc upload), tạo bảng.  
   - Định dạng văn bản (font, màu sắc, căn lề) như Microsoft Word.  

---

### **III. Yêu cầu kỹ thuật (Bổ sung)**  
1. **Backend Architecture**:  
   - **Ngôn ngữ**: Rust (đảm bảo hiệu suất cao, xử lý đa luồng).  
   - **Database**: PostgreSQL (hỗ trợ JSONB để lưu trạng thái động của task).  
   - **API**: RESTful API hoặc GraphQL (tối ưu cho mobile app).  
2. **Frontend Architecture**:  
   - Framework: React.js hoặc Vue.js (SPA với khả năng tương tác cao).  
   - Thư viện hỗ trợ:  
     - DnD (Drag-and-Drop) cho Kanban và Gantt Chart.  
     - Markdown Editor (VD: TipTap hoặc ProseMirror).  
3. **Security**:  
   - Xác thực 2 lớp (2FA) cho tài khoản Admin/Manager.  
   - Mã hóa dữ liệu nhạy cảm (VD: thông tin user, file đính kèm).  

---

### **IV. Màn hình & Luồng nghiệp vụ**  
#### **1. Màn hình Đăng nhập & Quản lý User**  
- **Login Screen**:  
  - Form đăng nhập với email/mật khẩu, nút "Quên mật khẩu".  
  - Tùy chọn đăng nhập bằng Google/Microsoft (OAuth2).  
- **User Management Screen** (Admin):  
  - Danh sách user với các cột: Tên, Email, Role, Trạng thái.  
  - Nút "Thêm User" mở form điền thông tin.  

#### **2. Màn hình Quản lý Dự án**  
- **Project Dashboard**:  
  - Thống kê tổng quan: % task hoàn thành, effort còn lại, top task trễ deadline.  
  - Nút "Tạo Task" mở form với các trường: Title, Mô tả, Priority, Assignees.  
- **Project Settings**:  
  - Thêm/xóa thành viên, phân quyền (quyền chỉnh sửa task, xóa comment...).  

#### **3. Màn hình Chi tiết Task**  
- **Task Details**:  
  - Tab thông tin chính (title, mô tả, subtask).  
  - Tab comments (hiển thị theo thread, có thể @mention user).  
  - Tab files (upload/download/delete file).  
  - Nút "Chỉnh sửa" để cập nhật effort, deadline, assignees.  

#### **4. Màn hình Timeline**  
- **Gantt Chart View**:  
  - Hiển thị timeline task và subtask, kéo thả để điều chỉnh thời gian.  
  - Màu sắc phân biệt trạng thái (đỏ: quá hạn, xanh lá: hoàn thành).  
- **User-Specific Timeline**:  
  - Xem lịch làm việc cá nhân (task được gán theo ngày/tuần).  

---

### **V. Đối tượng (Models) chính**  
1. **User**:  
   ```rust  
   struct User {  
       id: Uuid,  
       email: String,  
       name: String,  
       role: Role, // Admin, Manager, Member  
       capacity: f32, // Số giờ làm việc/ngày (mặc định 8h)  
       projects: Vec<Project>,  
   }  
   ```  
2. **Project**:  
   ```rust  
   struct Project {  
       id: Uuid,  
       name: String,  
       members: Vec<User>,  
       tasks: Vec<Task>,  
       created_at: DateTime,  
   }  
   ```  
3. **Task**:  
   ```rust  
   struct Task {  
       id: Uuid,  
       title: String,  
       description: String, // Markdown  
       status: TaskStatus, // Backlog, In Progress, Done  
       priority: Priority, // High, Medium, Low  
       effort: f32, // Tổng giờ ước tính  
       subtasks: Vec<Subtask>,  
       assignees: Vec<User>,  
       dependencies: Vec<Task>,  
       comments: Vec<Comment>,  
       files: Vec<File>,  
   }  
   ```  
4. **Subtask**:  
   ```rust  
   struct Subtask {  
       id: Uuid,  
       stage: Stage, // Study, Design, Coding...  
       effort: f32,  
       status: SubtaskStatus,  
       deadline: DateTime,  
   }  
   ```  

### **VII. Tài liệu Tham khảo**  
- UI/UX: Trello (Kanban), Monday.com (Gantt Chart), Notion (Markdown Editor).  
- Technical: Actix-Web (Rust framework), React Flow (Gantt Chart), TipTap (Editor).  

Hệ thống này sẽ kết hợp sức mạnh của Rust cho backend và các thư viện frontend hiện đại, đáp ứng yêu cầu về hiệu suất và trải nghiệm người dùng.