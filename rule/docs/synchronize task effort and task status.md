ở màn hình task detail projects/[id]/tasks/[id], có tab task con, trong tab task con hiển thị danh sách các task có status, priority,... Đang không edit được. Hãy sửa lại để nó hiển thị nằm ngang có thể edit được giống như màn @TaskListView.tsx giúp tôi. 
/Users/TienVNV/Desktop/ProjectManager/task-scheduler-frontend/src/components/tasks/TaskListView.tsx
Có 1 spec tôi muốn thay đổi là hiện tại task effort đang cho nhập effort, nhưng nếu task đó có task con (subtask) thì sẽ tính effort = tổng các task con. Và nếu có task con nào đã chuyển thành trạng thái hoàn thành. thì sẽ hiển thị effort của task cha là số giờ effort còn lại/tổng effort.
Chỗ task progress cũng vậy, nếu có task con thì sẽ tính progress là số task con hoàn thành / tổng số task của task cha.
tôi muốn dùng redux để làm cái này tương tự như màn hình project detail: projects/[id] có sự liên kết data lẫn nhau giữa các task.
Xử lý như sau: khi edit effort hoặc status của task con => dispatch tới slice trong redux => call api đến backend => backend response ok => update data vào store. Phía task detail sẽ có useEffect lắng nghe thay đổi của store => phản ánh lên UI.
Để làm được cái này thì khi mở màn hình task detail projects/[id]/tasks/[id], sau khi call api get data task by id và data tasks xong thì cần lưu vào store, và phía UI khi render cũng dùng selector để lấy data trong store ra tương tự xử lý ở các màn hình khác
/Users/TienVNV/Desktop/ProjectManager/task-scheduler-frontend/src/components/timeline/Timeline.tsx
/Users/TienVNV/Desktop/ProjectManager/task-scheduler-frontend/src/redux