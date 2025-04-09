# Database Schema Design

## Overview
The database schema is designed to support the task management system with focus on performance, scalability, and data integrity. Using PostgreSQL for its robust JSONB support, full-text search capabilities, and transactional integrity.

## Core Tables

### users
```sql
CREATE TABLE users (  
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'ADMIN', 'MANAGER', 'MEMBER'
    work_capacity FLOAT DEFAULT 8.0, -- hours per day
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### projects
```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### project_members
```sql
CREATE TABLE project_members (
    project_id UUID REFERENCES projects(id),
    user_id UUID REFERENCES users(id),
    role VARCHAR(50) NOT NULL, -- 'OWNER', 'EDITOR', 'VIEWER'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);
```

### tasks
```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id),
    parent_task_id UUID REFERENCES tasks(id), -- for subtasks
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL, -- 'BACKLOG', 'IN_PROGRESS', 'DONE'
    priority VARCHAR(50) NOT NULL, -- 'HIGH', 'MEDIUM', 'LOW'
    effort_hours FLOAT,
    start_date TIMESTAMP WITH TIME ZONE,
    deadline TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB -- flexible storage for additional properties
);
```

### task_assignments
```sql
CREATE TABLE task_assignments (
    task_id UUID REFERENCES tasks(id),
    user_id UUID REFERENCES users(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    PRIMARY KEY (task_id, user_id)
);
```

### task_dependencies
```sql
CREATE TABLE task_dependencies (
    dependent_task_id UUID REFERENCES tasks(id),
    dependency_task_id UUID REFERENCES tasks(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (dependent_task_id, dependency_task_id)
);
```

### comments
```sql
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id),
    user_id UUID REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    parent_comment_id UUID REFERENCES comments(id) -- for threaded comments
);
```

### attachments
```sql
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id),
    user_id UUID REFERENCES users(id),
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Supporting Tables

### notifications
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    type VARCHAR(50) NOT NULL, -- 'TASK_ASSIGNED', 'COMMENT_ADDED', etc.
    content JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### activity_log
```sql
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL, -- 'TASK', 'PROJECT', 'COMMENT'
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
    user_id UUID REFERENCES users(id),
    changes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Indexes

```sql
-- Users
CREATE INDEX idx_users_email ON users(email);

-- Projects
CREATE INDEX idx_projects_created_by ON projects(created_by);

-- Tasks
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
CREATE INDEX idx_tasks_metadata ON tasks USING gin(metadata);

-- Comments
CREATE INDEX idx_comments_task_id ON comments(task_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);

-- Notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read_at ON notifications(read_at);

-- Activity Log
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
```

## Views

### task_details
```sql
CREATE VIEW task_details AS
SELECT 
    t.*,
    json_agg(DISTINCT ta.user_id) as assignee_ids,
    json_agg(DISTINCT td.dependency_task_id) as dependency_ids,
    COUNT(DISTINCT c.id) as comment_count,
    COUNT(DISTINCT a.id) as attachment_count
FROM tasks t
LEFT JOIN task_assignments ta ON t.id = ta.task_id
LEFT JOIN task_dependencies td ON t.id = td.dependent_task_id
LEFT JOIN comments c ON t.id = c.task_id
LEFT JOIN attachments a ON t.id = a.task_id
GROUP BY t.id;
```

### user_workload
```sql
CREATE VIEW user_workload AS
SELECT 
    u.id as user_id,
    u.name,
    u.work_capacity,
    COUNT(DISTINCT ta.task_id) as assigned_tasks,
    SUM(t.effort_hours) as total_effort
FROM users u
LEFT JOIN task_assignments ta ON u.id = ta.user_id
LEFT JOIN tasks t ON ta.task_id = t.id
WHERE t.status != 'DONE'
GROUP BY u.id, u.name, u.work_capacity;
```

## Functions

### update_task_dates
```sql
CREATE OR REPLACE FUNCTION update_task_dates()
RETURNS TRIGGER AS $$
BEGIN
    -- Update parent task dates based on subtask dates
    IF NEW.parent_task_id IS NOT NULL THEN
        UPDATE tasks
        SET 
            start_date = LEAST(start_date, NEW.start_date),
            deadline = GREATEST(deadline, NEW.deadline)
        WHERE id = NEW.parent_task_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_task_dates
AFTER INSERT OR UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION update_task_dates();
```

This schema design provides:
- Strong referential integrity through foreign keys
- Efficient querying through strategic indexing
- Flexibility through JSONB columns for metadata
- Audit trail through activity logging
- Scalability through proper normalization
- Performance optimization through materialized views
