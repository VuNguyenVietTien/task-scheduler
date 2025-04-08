# Logic Báo Cáo Theo Ngày

Dựa trên phân tích cấu trúc dữ liệu và yêu cầu báo cáo ngày, dưới đây là logic xác định trạng thái của các task dựa trên thời gian (hôm qua và hôm nay).

## Các trường dữ liệu quan trọng

### Từ bảng tasks
- `task_id`: ID của task
- `title`: Tiêu đề task
- `assignee_id`: ID người được giao
- `start_date`: Ngày dự kiến bắt đầu
- `due_date`: Ngày dự kiến kết thúc
- `actual_start_date`: Ngày thực tế bắt đầu
- `actual_end_date`: Ngày thực tế kết thúc
- `status`: Trạng thái (todo, doing, review, done)
- `effort`: Nỗ lực ước tính
- `progress`: Tiến độ hoàn thành

### Từ planData
- `task_id`: ID của task
- `title`: Tiêu đề task
- `assignee_id`: ID người được giao
- `assignee_name`: Tên người được giao
- `start_date`: Ngày bắt đầu theo kế hoạch
- `end_date`: Ngày kết thúc theo kế hoạch
- `status`: Trạng thái theo kế hoạch
- `priority`: Mức độ ưu tiên
- `effort`: Nỗ lực ước tính

## Logic xác định trạng thái task

### Biến thời gian
```
today = ngày hiện tại (00:00:00)
yesterday = ngày hôm qua (00:00:00)
tomorrow = ngày mai (00:00:00)
```

### 1. Task đã hoàn thành hôm qua
```
IF (task.status == 'done' AND
    task.actual_end_date IS NOT NULL AND
    task.actual_end_date >= yesterday AND
    task.actual_end_date < today)
THEN
    Task đã hoàn thành hôm qua
```

### 2. Task bị trễ so với kế hoạch
```
IF (task.due_date < today AND
    task.status != 'done')
THEN
    Task bị trễ so với kế hoạch
```

### 3. Task đã bắt đầu hôm qua
```
IF (task.actual_start_date IS NOT NULL AND
    task.actual_start_date >= yesterday AND
    task.actual_start_date < today)
THEN
    Task đã bắt đầu hôm qua
```

### 4. Task dự kiến bắt đầu hôm nay
```
// Ưu tiên dữ liệu từ planData nếu có
IF (Tồn tại planTask trong planData với planTask.task_id == task.task_id AND
    planTask.start_date tương ứng với ngày today AND
    task.status == 'todo')
THEN
    Task dự kiến bắt đầu hôm nay theo kế hoạch

// Nếu không có dữ liệu từ planData, dùng dữ liệu từ task
ELSE IF (task.start_date tương ứng với ngày today AND
         task.status == 'todo')
THEN
    Task dự kiến bắt đầu hôm nay theo dữ liệu task
```

### 5. Task dự kiến hoàn thành hôm nay
```
// Ưu tiên dữ liệu từ planData nếu có
IF (Tồn tại planTask trong planData với planTask.task_id == task.task_id AND
    planTask.end_date tương ứng với ngày today AND
    task.status != 'done')
THEN
    Task dự kiến hoàn thành hôm nay theo kế hoạch

// Nếu không có dữ liệu từ planData, dùng dữ liệu từ task
ELSE IF (task.due_date tương ứng với ngày today AND
         task.status != 'done')
THEN
    Task dự kiến hoàn thành hôm nay theo dữ liệu task
```

### 6. Task đang tiếp tục thực hiện
```
IF (task.status == 'doing' OR task.status == 'review')
THEN
    Task đang tiếp tục thực hiện
```

### 7. Task bị trễ không bắt đầu theo kế hoạch
```
IF ((Tồn tại planTask trong planData với planTask.task_id == task.task_id AND
    planTask.start_date < today AND
    task.status == 'todo') OR
    (task.start_date < today AND 
     task.status == 'todo' AND 
     !Tồn tại planTask trong planData với planTask.task_id == task.task_id))
THEN
    Task bị trễ không bắt đầu theo kế hoạch
```

### 8. Task không kết thúc theo kế hoạch
```
IF ((Tồn tại planTask trong planData với planTask.task_id == task.task_id AND
    planTask.end_date < today AND
    task.status != 'done') OR
    (task.due_date < today AND 
     task.status != 'done' AND 
     !Tồn tại planTask trong planData với planTask.task_id == task.task_id))
THEN
    Task không kết thúc theo kế hoạch
```

### 9. Xác định task on schedule hay late
```
// Xác định trạng thái on-schedule hay late
IF (task.status == 'done')
THEN
    // Kiểm tra nếu task hoàn thành đúng hoặc sớm hơn kế hoạch
    IF ((Tồn tại planTask trong planData với planTask.task_id == task.task_id AND
        task.actual_end_date <= DATE(planTask.end_date)) OR
        (task.actual_end_date <= task.due_date AND
         !Tồn tại planTask trong planData với planTask.task_id == task.task_id))
    THEN
        Task on schedule - Hoàn thành đúng tiến độ
    ELSE
        Task late - Hoàn thành trễ tiến độ
    
ELSE IF (task.status == 'todo' AND
        ((Tồn tại planTask trong planData với planTask.task_id == task.task_id AND
          today <= DATE(planTask.start_date)) OR
         (today <= task.start_date AND
          !Tồn tại planTask trong planData với planTask.task_id == task.task_id)))
THEN
    Task on schedule - Chưa đến thời gian bắt đầu

ELSE IF (task.status == 'doing' OR task.status == 'review')
THEN
    // Kiểm tra nếu task đang thực hiện và chưa đến thời hạn
    IF ((Tồn tại planTask trong planData với planTask.task_id == task.task_id AND
        today <= DATE(planTask.end_date)) OR
        (today <= task.due_date AND
         !Tồn tại planTask trong planData với planTask.task_id == task.task_id))
    THEN
        Task on schedule - Đang thực hiện đúng tiến độ
    ELSE
        Task late - Đang thực hiện trễ tiến độ

ELSE
    // Nếu là các trạng thái khác
    IF ((Tồn tại planTask trong planData với planTask.task_id == task.task_id AND
        (today > DATE(planTask.start_date) OR today > DATE(planTask.end_date))) OR
        (today > task.start_date OR today > task.due_date) AND
         !Tồn tại planTask trong planData với planTask.task_id == task.task_id))
    THEN
        Task late - Trễ tiến độ
    ELSE
        Task on schedule - Đúng tiến độ
```

## Phân loại theo từng ngày

### Báo cáo hôm qua
1. **Các task đã hoàn thành**
   - Task với status = 'done' và actual_end_date là ngày hôm qua
   
2. **Các task bị trễ so với kế hoạch**
   - Task có due_date ≤ hôm qua nhưng status chưa phải 'done'
   
3. **Các task đã bắt đầu đúng kế hoạch**
   - Task có actual_start_date là ngày hôm qua và khớp với start_date hoặc planTask.start_date
   
4. **Tổng hợp công việc theo thành viên**
   - Thống kê số lượng task theo các trạng thái: hoàn thành, đang làm, bị trễ

### Báo cáo hôm nay
1. **Các task dự kiến bắt đầu**
   - Task có start_date hoặc planTask.start_date là ngày hôm nay và status = 'todo'
   
2. **Các task dự kiến hoàn thành**
   - Task có due_date hoặc planTask.end_date là ngày hôm nay và status khác 'done'
   
3. **Các thành viên không có task được phân công**
   - Các thành viên không có task nào có start_date, due_date hoặc planTask có start_date, end_date là ngày hôm nay, và không có task nào với status = 'doing' hoặc 'review'

## Thực hiện trong code

Để thực hiện logic này trong code, chúng ta cần:

1. Lấy dữ liệu tasks và planData
2. Xác định các ngày (today, yesterday, tomorrow)
3. Áp dụng các hàm lọc dựa trên logic trên để phân loại tasks
4. Hiển thị kết quả phân loại lên giao diện người dùng

Việc kết hợp giữa dữ liệu tasks và planData sẽ giúp chúng ta có cái nhìn chính xác hơn về tiến độ công việc, so sánh kế hoạch với thực tế, từ đó đưa ra báo cáo hữu ích cho người dùng. 