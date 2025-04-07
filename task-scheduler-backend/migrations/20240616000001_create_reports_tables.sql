-- Create enum types for reports
CREATE TYPE report_type AS ENUM ('daily', 'weekly', 'monthly', 'quarterly');
CREATE TYPE bug_severity AS ENUM ('critical', 'major', 'minor');
CREATE TYPE bug_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- Create reports table
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_type report_type NOT NULL,
    report_date DATE NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id),
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    total_tasks INTEGER NOT NULL DEFAULT 0,
    completed_tasks INTEGER NOT NULL DEFAULT 0,
    delayed_tasks INTEGER NOT NULL DEFAULT 0,
    on_schedule_tasks INTEGER NOT NULL DEFAULT 0,
    new_started_tasks INTEGER NOT NULL DEFAULT 0,
    unassigned_resources JSONB,
    total_bugs INTEGER NOT NULL DEFAULT 0,
    critical_bugs INTEGER NOT NULL DEFAULT 0,
    major_bugs INTEGER NOT NULL DEFAULT 0,
    minor_bugs INTEGER NOT NULL DEFAULT 0,
    resolved_bugs INTEGER NOT NULL DEFAULT 0,
    summary TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (report_type, report_date, project_id)
);

-- Create report_tasks table
CREATE TABLE report_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks(task_id),
    task_title VARCHAR(255) NOT NULL,
    assignee_id UUID REFERENCES users(user_id),
    planned_start_date TIMESTAMPTZ,
    planned_end_date TIMESTAMPTZ,
    actual_start_date TIMESTAMPTZ,
    actual_end_date TIMESTAMPTZ,
    status task_status NOT NULL,
    is_delayed BOOLEAN DEFAULT FALSE,
    delay_reason TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create bugs table
CREATE TABLE bugs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(task_id),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity bug_severity NOT NULL,
    status bug_status NOT NULL DEFAULT 'open',
    priority INTEGER CHECK (priority BETWEEN 1 AND 5),
    assignee_id UUID REFERENCES users(user_id),
    reporter_id UUID REFERENCES users(user_id),
    date_discovered DATE NOT NULL,
    date_resolved DATE,
    resolution_time INTEGER, -- Thời gian giải quyết tính bằng giờ
    resolution_description TEXT,
    affected_components JSONB,
    tags JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create task_status_history table
CREATE TABLE task_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    previous_status task_status,
    new_status task_status NOT NULL,
    changed_by UUID REFERENCES users(user_id),
    change_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT
);

-- Create indexes for performance
CREATE INDEX idx_reports_project ON reports(project_id);
CREATE INDEX idx_reports_type_date ON reports(report_type, report_date);
CREATE INDEX idx_report_tasks_report ON report_tasks(report_id);
CREATE INDEX idx_report_tasks_task ON report_tasks(task_id);
CREATE INDEX idx_bugs_project ON bugs(project_id);
CREATE INDEX idx_bugs_task ON bugs(task_id);
CREATE INDEX idx_bugs_severity ON bugs(severity);
CREATE INDEX idx_bugs_status ON bugs(status);
CREATE INDEX idx_task_status_history_task ON task_status_history(task_id);
CREATE INDEX idx_task_status_history_date ON task_status_history(change_date); 