-- Create Plans table for Gantt chart
CREATE TABLE plans (
    plan_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT false,
    plan_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT valid_plan_data CHECK (jsonb_typeof(plan_data) = 'object')
);

COMMENT ON TABLE plans IS 'Lưu trữ các kế hoạch sắp xếp task trên Gantt chart';
COMMENT ON COLUMN plans.plan_id IS 'ID định danh duy nhất của kế hoạch';
COMMENT ON COLUMN plans.project_id IS 'ID dự án mà kế hoạch này thuộc về';
COMMENT ON COLUMN plans.name IS 'Tên kế hoạch';
COMMENT ON COLUMN plans.description IS 'Mô tả kế hoạch';
COMMENT ON COLUMN plans.created_by IS 'ID người dùng tạo kế hoạch';
COMMENT ON COLUMN plans.created_at IS 'Thời gian tạo kế hoạch';
COMMENT ON COLUMN plans.updated_at IS 'Thời gian cập nhật kế hoạch gần nhất';
COMMENT ON COLUMN plans.is_active IS 'Trạng thái kích hoạt của kế hoạch';
COMMENT ON COLUMN plans.plan_data IS 'Dữ liệu chi tiết về các task trong kế hoạch, bao gồm thứ tự ưu tiên và ngày bắt đầu/kết thúc';

-- Create indexes
CREATE INDEX idx_plans_project ON plans(project_id);
CREATE INDEX idx_plans_created_by ON plans(created_by);
CREATE INDEX idx_plans_updated_at ON plans(updated_at);

-- Add constraint to ensure only one active plan per project
CREATE UNIQUE INDEX unique_active_plan_per_project ON plans (project_id) 
WHERE is_active = true;

/*
Cấu trúc JSON cho plan_data:
{
  "tasks": [
    {
      "task_id": "uuid-của-task-1",
      "priority_order": 1,
      "original_priority": "urgent",
      "start_date": "2023-04-10",
      "end_date": "2023-04-15"  // end_date là ngày kết thúc dự kiến (start_date + effort)
    },
    {
      "task_id": "uuid-của-task-2",
      "priority_order": 2,
      "original_priority": "high",
      "start_date": "2023-04-12",
      "end_date": "2023-04-18"
    }
  ],
  "metadata": {
    "last_sorted_date": "2023-04-05T10:15:30Z",
    "sort_criteria": "priority_and_custom"
  }
}

Lưu ý:
- due_date: Là deadline/thời hạn mà task phải hoàn thành theo yêu cầu (lưu trong bảng tasks)
- end_date: Là ngày kết thúc dự kiến theo tính toán từ start_date + effort (lưu trong plan_data)
*/ 