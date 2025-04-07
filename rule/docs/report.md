# Thiết kế chi tiết chức năng Báo cáo (Report)

## Cấu trúc bảng dữ liệu

### Bảng reports

```sql
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly', 'quarterly')),
    report_date DATE NOT NULL,
    plan_id INTEGER REFERENCES plans(id),
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    total_tasks INTEGER NOT NULL DEFAULT 0,
    completed_tasks INTEGER NOT NULL DEFAULT 0,
    delayed_tasks INTEGER NOT NULL DEFAULT 0,
    on_schedule_tasks INTEGER NOT NULL DEFAULT 0,
    new_started_tasks INTEGER NOT NULL DEFAULT 0,
    unassigned_resources TEXT[],
    total_bugs INTEGER NOT NULL DEFAULT 0,
    critical_bugs INTEGER NOT NULL DEFAULT 0,
    major_bugs INTEGER NOT NULL DEFAULT 0,
    minor_bugs INTEGER NOT NULL DEFAULT 0,
    resolved_bugs INTEGER NOT NULL DEFAULT 0,
    summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (report_type, report_date, plan_id)
);
```

### Bảng report_tasks

```sql
CREATE TABLE report_tasks (
    id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES reports(id) ON DELETE CASCADE,
    task_id INTEGER REFERENCES tasks(id),
    task_title VARCHAR(255) NOT NULL,
    assignee VARCHAR(100),
    planned_start_date DATE,
    planned_end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('not_started', 'ongoing', 'completed', 'delayed', 'canceled')),
    is_delayed BOOLEAN DEFAULT FALSE,
    delay_reason TEXT,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Bảng bugs

```sql
CREATE TABLE bugs (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id),
    plan_id INTEGER REFERENCES plans(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'major', 'minor')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority INTEGER CHECK (priority BETWEEN 1 AND 5),
    assignee_id INTEGER REFERENCES users(id),
    reporter_id INTEGER REFERENCES users(id),
    date_discovered DATE NOT NULL,
    date_resolved DATE,
    resolution_time INTEGER, -- Thời gian giải quyết tính bằng giờ
    resolution_description TEXT,
    affected_components TEXT[],
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Bảng task_status_history

```sql
CREATE TABLE task_status_history (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by INTEGER REFERENCES users(id),
    change_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT
);
```

## Cấu trúc màn hình báo cáo

### 1. Dashboard tổng quan

- **Thông tin hiển thị**:
  - Tổng số task theo trạng thái (biểu đồ tròn)
  - Tiến độ dự án so với kế hoạch (biểu đồ đường)
  - Số lượng bug theo mức độ nghiêm trọng (biểu đồ cột)
  - Thứ tự các assignee có task bị trễ nhiều nhất, và có số task trễ tương ứng tuần, tháng, quý
  - Tỷ lệ hoàn thành công việc theo kế hoạch
  - Lịch sử báo cáo gần đây

### 2. Báo cáo ngày (Daily Report)

- **Tabs phụ**:
  - **Hôm qua**:
    - Liệt kê các task đã hoàn thành hoặc đang làm (dựa vào task_status_history)
    - Các task bị trễ so với kế hoạch
    - Các task được bắt đầu đúng kế hoạch
    - Tổng hợp công việc của từng thành viên
  
  - **Hôm nay**:
    - Các task dự kiến sẽ bắt đầu
    - Các task dự kiến sẽ hoàn thành
    - Phân công công việc theo kế hoạch
    - Các thành viên không có task được phân công

- **Bộ lọc**: Theo plan, theo người thực hiện, theo trạng thái

### 3. Báo cáo tuần (Weekly Report)

- **Tabs phụ**:
  - **Tuần trước**:
    - Biểu đồ tiến độ hoàn thành (% hoàn thành so với kế hoạch)
    - Tổng hợp các task đã hoàn thành, đang làm, bị trễ
    - Biểu đồ Gantt hiển thị tiến độ công việc
    - Các bug phát sinh và trạng thái xử lý
  
  - **Tuần tới**:
    - Dự kiến công việc theo kế hoạch
    - Phân bổ nguồn lực
    - Các deadline cần lưu ý
    - Các rủi ro tiềm ẩn

- **Bộ lọc**: Theo plan, theo sprint, theo team

### 4. Báo cáo tháng (Monthly Report)

- **Tabs phụ**:
  - **Tháng này**:
    - Tổng quan tiến độ dự án (biểu đồ đường)
    - Hiệu suất làm việc của team (biểu đồ cột)
    - Thống kê bug theo mức độ nghiêm trọng
    - So sánh kế hoạch và thực tế (biểu đồ kết hợp)
  
  - **Tháng tới**:
    - Dự báo tiến độ
    - Các milestone quan trọng
    - Kế hoạch phân bổ nguồn lực

- **Bộ lọc**: Theo plan, theo quarter, theo team

### 5. Báo cáo quý (Quarterly Report)

- **Nội dung**:
  - Tổng quan toàn bộ dự án (tiến độ, chất lượng, nguồn lực)
  - So sánh các KPI với mục tiêu ban đầu
  - Biểu đồ xu hướng (trend) về hiệu suất làm việc
  - Thống kê lỗi và thời gian xử lý
  - Đánh giá rủi ro và đề xuất giải pháp

- **Bộ lọc**: Theo plan, theo năm

### 6. Quản lý Bug

- **Thông tin hiển thị**:
  - Danh sách bug theo mức độ nghiêm trọng
  - Thời gian phát hiện và thời gian xử lý
  - Biểu đồ phân bố bug theo thành phần (component)
  - Tỷ lệ bug theo trạng thái (open, in progress, resolved, closed)
  - Thời gian trung bình để xử lý bug

- **Bộ lọc**: Theo mức độ nghiêm trọng, theo status, theo assignee

### 7. So sánh Plan vs Actual

- **Thông tin hiển thị**:
  - Biểu đồ Gantt so sánh kế hoạch và thực tế
  - Chênh lệch thời gian (planned vs actual)
  - Tỷ lệ hoàn thành đúng tiến độ theo thời gian
  - Phân tích nguyên nhân chậm trễ

- **Bộ lọc**: Theo plan, theo giai đoạn, theo team

### 8. Export và chia sẻ báo cáo

- Xuất báo cáo dưới dạng PDF, Excel, CSV
- Gửi email báo cáo tự động theo lịch
- Tạo link chia sẻ báo cáo

## Tính năng bổ sung

1. **Tự động tạo báo cáo định kỳ**: Tự động tạo báo cáo ngày, tuần, tháng, quý và lưu vào hệ thống
2. **Cảnh báo tự động**: Thông báo khi có task bị trễ hoặc bug nghiêm trọng
3. **Dự báo tiến độ**: Sử dụng dữ liệu lịch sử để dự đoán khả năng hoàn thành đúng tiến độ
4. **Phân tích xu hướng**: Theo dõi và phân tích xu hướng hiệu suất làm việc theo thời gian
5. **Đánh giá hiệu suất**: So sánh hiệu suất làm việc của các thành viên và team

