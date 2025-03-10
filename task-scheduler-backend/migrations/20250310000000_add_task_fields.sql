CREATE TYPE task_status AS ENUM (
    'todo',
    'doing',
    'done',
    'close',
    'pending',
    'review',
    'blocked',
    'rejected',
    'archived'
);

CREATE TYPE task_priority AS ENUM (
    'low',
    'medium', 
    'high',
    'urgent',
    'critical'
);

CREATE TYPE task_progress_type AS ENUM (
    'study',
    'investigate',
    'code',
    'test',
    'review_code',
    'review_test_report',
    'release'
);

CREATE TABLE IF NOT EXISTS tasks (
    task_id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(project_id),
    parent_task_id UUID REFERENCES tasks(task_id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status task_status NOT NULL DEFAULT 'todo',
    priority task_priority NOT NULL DEFAULT 'low',
    priority_order INTEGER NOT NULL DEFAULT 0,
    start_date TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    actual_start_date TIMESTAMPTZ,
    actual_end_date TIMESTAMPTZ,
    effort DOUBLE PRECISION,
    progress DOUBLE PRECISION DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    assignee_id UUID REFERENCES users(user_id),
    type VARCHAR(50),
    category VARCHAR(50),
    progress_type task_progress_type,
    tags JSONB
);

CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_parent_id ON tasks(parent_task_id); 
