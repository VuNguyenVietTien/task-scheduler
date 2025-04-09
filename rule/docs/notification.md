Khi user tạo task rồi assign cho 1 member khác mà không phải họ thì sẽ gửi notification đến người đó.  
Khi user comment mà có tag người khác thì sẽ gửi thông báo đến người đó
---
Hiện tại:
- ở phần common header có chuông thông báo với dummy data rồi. hãy bỏ dummy data truyền data thực vào giúp tôi. khi click vào chuông thông báo sẽ show ra list thông báo đã đọc và chưa đọc với background khác nhau, khi click vào thông báo sẽ di chuyển đến task hoặc comment được tag vào.
- chức năng comment chưa có logic dùng @ để tag tên member, hãy implement giúp tôi
- mỗi comment cũng nên có 1 link để khi click vào notification thì sẽ đi đến màn hình task chứa comment đó và hiển thị đúng vị trí comment được tag

Dưới đây là màn hình:
task detail chứa nội dung detail task và có comment: /Users/TienVNV/Desktop/ProjectManager/task-scheduler-frontend/src/app/projects/[id]/tasks/[taskId]/page.tsx
/Users/TienVNV/Desktop/ProjectManager/task-scheduler-frontend/src/components/tasks/TaskDetailPage.tsx

Đã có graphql api để create task và comment cho task rồi, giờ cần thêm là khi create task có gán assignee là người khác và comment có tag tên người khác, hoặc update thay đổi assignee cho task thì thực hiện gửi thông báo đến người đó. Mong muốn là được push real time. nghĩa là khi 2 người cùng mở app, user A thực hiện comment tag tên user B hoặc assign task cho user B thì phía B có chuông thông báo sẽ được cập nhật số thông báo tăng lên. Click vào hiển thị danh sách thông báo, click vào sẽ đi đến task detail nếu là assign cho user đó, hoặc đi đến comment có tag user đó.