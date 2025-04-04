ở màn hình task detail projects/[id]/tasks/[id] tôi có tab là các task con. Tôi muốn tạo thêm chức năng add subtask để hiển thị vào đây. Hãy giúp tôi làm các việc sau:
1. khi click vào button add sub task đang có sẵn trong tab subtask thì hiển thị tab mới là màn hình create task đã có sẵn nhưng link là projects/[id]/tasks/[id]/create-subtask/ để tạo subtask cho task hiện tại, và khi call graphql api thì truyền nội dung parent task id vào giúp tôi. tham khảo các mutation khác để làm
/Users/TienVNV/Desktop/ProjectManager/task-scheduler-frontend/src/app/projects/[id]/tasks/[taskId]/page.tsx
/Users/TienVNV/Desktop/ProjectManager/task-scheduler-frontend/src/app/projects/[id]/add-task/page.tsx
2. Thêm api get subtasks(childtasks) cho task hiện tại. Kiểm tra trong table tasks, task nào có parent id là task hiện tại thì lấy ra hiện thì giúp tôi.
3. Khi hiện thị sub task thì hiển thị theo list có title, status, assignee, start date, due date, effort. Khi click vào title thì hiển thị màn hình task id cho sub task đó. Các thông tin detail như status, assignee, start date, due date, effort đều có thể thay đổi giống như màn hình projects/[id] khi edit các field này thì sử dụng lại api có sẵn để update task giúp tôi
/Users/TienVNV/Desktop/ProjectManager/task-scheduler-frontend/src/app/projects/[id]/page.tsx
4. Trong api GetTaskById($taskId: ID!) hiện tại có get childTasks, hãy đưa thông tin này vào api get subTasks(childTasks) mới và bỏ childTasks trong api GetTaskById($taskId: ID!) đi, sửa api ở frontend và backend giúp tôi, tham khảo các api khác vì nó đang hoạt động tốt, tránh tự ý sửa lại theo cách khác vì có thể sẽ không hoạt động và gây lỗi
/Users/TienVNV/Desktop/ProjectManager/task-scheduler-frontend/src/graphql
/Users/TienVNV/Desktop/ProjectManager/task-scheduler-backend/src/graphql
/Users/TienVNV/Desktop/ProjectManager/task-scheduler-backend/src/db

Query: query GetTaskById($taskId: ID!) {
  task(taskId: $taskId) {
    taskId
    title
    description
    status
    priority
    effort
    progress
    startDate
    dueDate
    actualStartDate
    actualEndDate
    createdAt
    updatedAt
    projectId
    parentTaskId
    assignee {
      userId
      username
      avatarUrl
      role
      __typename
    }
    creator {
      userId
      username
      avatarUrl
      role
      __typename
    }
    priorityOrder
    type
    category
    progressType
    tags
    childTasks {
      taskId
      title
      status
      priority
      effort
      progress
      __typename
    }
    __typename
  }
}