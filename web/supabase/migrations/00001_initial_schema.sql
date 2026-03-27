-- =============================================================================
-- Unified Supabase Migration: Initial Schema
-- Combined from backend/ and design-doc-service/ migrations
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

CREATE TYPE member_role AS ENUM ('admin', 'member', 'viewer', 'manager', 'leader', 'guest');
CREATE TYPE project_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE project_status AS ENUM ('active', 'completed', 'on_hold', 'cancelled');
CREATE TYPE project_visibility AS ENUM ('public', 'private', 'team');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent', 'critical');
CREATE TYPE task_status AS ENUM ('todo', 'doing', 'done', 'close', 'pending', 'review', 'blocked', 'rejected', 'archived');
CREATE TYPE task_progress_type AS ENUM ('study', 'investigate', 'code', 'test', 'review_code', 'review_test_report', 'release');
CREATE TYPE user_provider AS ENUM ('email', 'google', 'github');
CREATE TYPE user_role AS ENUM ('admin', 'user');
CREATE TYPE report_type AS ENUM ('daily', 'weekly', 'monthly', 'quarterly');
CREATE TYPE bug_severity AS ENUM ('critical', 'major', 'minor');
CREATE TYPE bug_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- =============================================================================
-- TABLES: Core (users, projects, members)
-- =============================================================================

-- Users
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR NOT NULL UNIQUE,
    password_hash VARCHAR,
    full_name VARCHAR,
    username VARCHAR NOT NULL UNIQUE,
    avatar_url VARCHAR,
    bio TEXT,
    google_id VARCHAR,
    is_email_verified BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMPTZ,
    name VARCHAR,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    verification_token VARCHAR,
    verification_token_expires TIMESTAMPTZ,
    reset_token VARCHAR,
    reset_token_expires TIMESTAMPTZ,
    firebase_uid VARCHAR,
    role user_role NOT NULL DEFAULT 'user',
    provider user_provider NOT NULL DEFAULT 'email',
    work_capacity INTEGER,
    metadata JSONB,
    fcm_tokens JSONB DEFAULT '[]'::jsonb
);

COMMENT ON COLUMN users.fcm_tokens IS 'Array of FCM tokens for push notification';

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    project_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    priority project_priority NOT NULL DEFAULT 'medium',
    visibility project_visibility NOT NULL DEFAULT 'private',
    tags JSONB,
    progress DOUBLE PRECISION NOT NULL DEFAULT 0,
    category VARCHAR,
    metadata JSONB,
    start_date DATE,
    end_date DATE,
    icon_url VARCHAR,
    is_public BOOLEAN NOT NULL DEFAULT false,
    status project_status NOT NULL DEFAULT 'active'
);

-- Project Members
CREATE TABLE IF NOT EXISTS project_members (
    member_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    invited_by UUID REFERENCES users(user_id),
    role member_role NOT NULL DEFAULT 'member',
    UNIQUE (project_id, user_id)
);

-- =============================================================================
-- TABLES: Task Management
-- =============================================================================

-- Task Statuses (custom per project)
CREATE TABLE IF NOT EXISTS task_statuses (
    status_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(20),
    display_order INTEGER NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_done BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tags (project-level)
CREATE TABLE IF NOT EXISTS tags (
    tag_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
    task_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    parent_task_id UUID REFERENCES tasks(task_id),
    title VARCHAR NOT NULL,
    description TEXT,
    assignee_id UUID REFERENCES users(user_id),
    priority_order INTEGER NOT NULL DEFAULT 0,
    start_date TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    actual_start_date TIMESTAMPTZ,
    actual_end_date TIMESTAMPTZ,
    effort DOUBLE PRECISION,
    progress DOUBLE PRECISION DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT false,
    status task_status NOT NULL DEFAULT 'todo',
    priority task_priority NOT NULL DEFAULT 'medium',
    type VARCHAR,
    category VARCHAR,
    tags JSONB,
    progress_type task_progress_type
);

-- Task Tags (junction)
CREATE TABLE IF NOT EXISTS task_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(tag_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (task_id, tag_id)
);

-- Task Durations
CREATE TABLE IF NOT EXISTS task_durations (
    duration_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    start_datetime TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_datetime TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL,
    note TEXT,
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Task Status History
CREATE TABLE IF NOT EXISTS task_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    previous_status task_status,
    new_status task_status NOT NULL,
    changed_by UUID REFERENCES users(user_id),
    change_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT
);

-- =============================================================================
-- TABLES: Comments & Mentions
-- =============================================================================

-- Comments
CREATE TABLE IF NOT EXISTS comments (
    comment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id),
    content TEXT NOT NULL,
    parent_id UUID REFERENCES comments(comment_id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT false,
    metadata JSONB
);

-- Comment Mentions
CREATE TABLE IF NOT EXISTS comment_mentions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES comments(comment_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id),
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (comment_id, user_id)
);

-- =============================================================================
-- TABLES: Attachments
-- =============================================================================

CREATE TABLE IF NOT EXISTS attachments (
    attachment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_type VARCHAR(50) NOT NULL,
    owner_id UUID NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES users(user_id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- =============================================================================
-- TABLES: Notifications
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    reference_type VARCHAR(50) NOT NULL,
    reference_id UUID NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sender_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL DEFAULT 'notification',
    metadata JSONB DEFAULT '{}'::jsonb
);

-- =============================================================================
-- TABLES: Plans (Gantt chart)
-- =============================================================================

CREATE TABLE IF NOT EXISTS plans (
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

COMMENT ON TABLE plans IS 'Stores task arrangement plans for Gantt chart';
COMMENT ON COLUMN plans.plan_data IS 'Detailed task data including priority order and start/end dates';

-- =============================================================================
-- TABLES: Snapshots
-- =============================================================================

CREATE TABLE IF NOT EXISTS snapshots (
    snapshot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_id UUID NOT NULL REFERENCES snapshots(snapshot_id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assignee_id UUID REFERENCES users(user_id),
    status task_status NOT NULL,
    priority_order INTEGER NOT NULL,
    start_date TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    effort DECIMAL(8,2),
    progress INTEGER
);

-- =============================================================================
-- TABLES: Reports & Bugs
-- =============================================================================

-- Reports
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_type report_type NOT NULL,
    report_date DATE NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(plan_id),
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
    rejected_tasks INTEGER NOT NULL DEFAULT 0,
    on_schedule_percentage NUMERIC(5,2) DEFAULT 0,
    delay_percentage NUMERIC(5,2) DEFAULT 0,
    CONSTRAINT reports_type_period_project_unique
        UNIQUE (report_type, period_start_date, period_end_date, project_id)
);

-- Report Tasks
CREATE TABLE IF NOT EXISTS report_tasks (
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

-- Bugs
CREATE TABLE IF NOT EXISTS bugs (
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
    resolution_time INTEGER,
    resolution_description TEXT,
    affected_components JSONB,
    tags JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- TABLES: Activity Logs
-- =============================================================================

CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(task_id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(user_id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- TABLES: Design Doc Service - Systems & Modules
-- =============================================================================

CREATE TABLE IF NOT EXISTS systems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- TABLES: Design Doc Service - Documents & Screens
-- =============================================================================

CREATE TABLE IF NOT EXISTS design_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    description TEXT,
    source_tool VARCHAR(50),
    last_imported_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS screens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES design_documents(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    svg_content TEXT,
    svg_layers JSONB DEFAULT '[]',
    frame_width INT,
    frame_height INT,
    breakpoint VARCHAR(20) DEFAULT 'pc',
    sort_order INT DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    content_type VARCHAR(10) NOT NULL DEFAULT 'svg'
);

-- =============================================================================
-- TABLES: Design Doc Service - Components & Mappings
-- =============================================================================

CREATE TABLE IF NOT EXISTS components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    screen_id UUID NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
    custom_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    component_type VARCHAR(100),
    data_type VARCHAR(100),
    display_logic TEXT,
    position JSONB NOT NULL,
    svg_element_id VARCHAR(255),
    descriptions JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(screen_id, custom_id)
);

CREATE TABLE IF NOT EXISTS field_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    db_table VARCHAR(255) NOT NULL,
    db_column VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- TABLES: Design Doc Service - Flows
-- =============================================================================

CREATE TABLE IF NOT EXISTS flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES design_documents(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    mermaid_definition TEXT,
    flow_type VARCHAR(50) DEFAULT 'business',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flow_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
    screen_id UUID REFERENCES screens(id) ON DELETE SET NULL,
    component_id UUID REFERENCES components(id) ON DELETE SET NULL,
    step_order INT NOT NULL,
    label VARCHAR(255),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- TABLES: Design Doc Service - Tags & External Links
-- =============================================================================

-- Note: This is a separate tags table for the design-doc-service (design_tags),
-- distinct from the project-level tags table above.
CREATE TABLE IF NOT EXISTS design_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entity_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_id UUID NOT NULL REFERENCES design_tags(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tag_id, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS external_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    provider VARCHAR(50) NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    external_url VARCHAR(500),
    sync_status VARCHAR(50) DEFAULT 'linked',
    last_synced_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entity_type, entity_id, provider, external_id)
);

-- =============================================================================
-- TABLES: Design Doc Service - Audit
-- =============================================================================

CREATE TABLE IF NOT EXISTS document_audit (
    id BIGSERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_by TEXT NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES: Backend
-- =============================================================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);

-- Projects
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);

-- Project Members
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

-- Tasks
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);

-- Task Statuses
CREATE INDEX IF NOT EXISTS idx_task_statuses_project ON task_statuses(project_id);

-- Tags
CREATE INDEX IF NOT EXISTS idx_tags_project ON tags(project_id);

-- Comments
CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sender ON notifications(sender_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Activity Logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_project ON activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_task ON activity_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);

-- Plans
CREATE INDEX IF NOT EXISTS idx_plans_project ON plans(project_id);
CREATE INDEX IF NOT EXISTS idx_plans_created_by ON plans(created_by);
CREATE INDEX IF NOT EXISTS idx_plans_updated_at ON plans(updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_plan_per_project ON plans (project_id)
    WHERE is_active = true;

-- Reports
CREATE INDEX IF NOT EXISTS idx_reports_project ON reports(project_id);
CREATE INDEX IF NOT EXISTS idx_reports_type_date ON reports(report_type, report_date);
CREATE INDEX IF NOT EXISTS idx_reports_period ON reports(period_start_date, period_end_date);

-- Report Tasks
CREATE INDEX IF NOT EXISTS idx_report_tasks_report ON report_tasks(report_id);
CREATE INDEX IF NOT EXISTS idx_report_tasks_task ON report_tasks(task_id);

-- Bugs
CREATE INDEX IF NOT EXISTS idx_bugs_project ON bugs(project_id);
CREATE INDEX IF NOT EXISTS idx_bugs_task ON bugs(task_id);
CREATE INDEX IF NOT EXISTS idx_bugs_severity ON bugs(severity);
CREATE INDEX IF NOT EXISTS idx_bugs_status ON bugs(status);

-- Task Status History
CREATE INDEX IF NOT EXISTS idx_task_status_history_task ON task_status_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_status_history_date ON task_status_history(change_date);

-- =============================================================================
-- INDEXES: Design Doc Service
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_systems_project ON systems(project_id);
CREATE INDEX IF NOT EXISTS idx_modules_system ON modules(system_id);
CREATE INDEX IF NOT EXISTS idx_documents_module ON design_documents(module_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON design_documents(status);
CREATE INDEX IF NOT EXISTS idx_screens_document ON screens(document_id);
CREATE INDEX IF NOT EXISTS idx_components_screen ON components(screen_id);
CREATE INDEX IF NOT EXISTS idx_field_mappings_component ON field_mappings(component_id);
CREATE INDEX IF NOT EXISTS idx_field_mappings_table_col ON field_mappings(db_table, db_column);
CREATE INDEX IF NOT EXISTS idx_flows_document ON flows(document_id);
CREATE INDEX IF NOT EXISTS idx_flow_steps_flow ON flow_steps(flow_id);
CREATE INDEX IF NOT EXISTS idx_entity_tags_lookup ON entity_tags(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_external_links_lookup ON external_links(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON document_audit(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON document_audit(changed_at DESC);

-- GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_components_position_gin ON components USING gin(position jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_components_descriptions_gin ON components USING gin(descriptions jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_components_metadata_gin ON components USING gin(metadata jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_screens_metadata_gin ON screens USING gin(metadata jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_screens_svg_layers_gin ON screens USING gin(svg_layers jsonb_path_ops);

-- =============================================================================
-- AUDIT TRIGGER FUNCTION & TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id TEXT;
BEGIN
    BEGIN
        current_user_id := current_setting('app.user_id')::TEXT;
    EXCEPTION WHEN OTHERS THEN
        current_user_id := '0';
    END;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO document_audit(entity_type, entity_id, action, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), current_user_id);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO document_audit(entity_type, entity_id, action, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), current_user_id);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO document_audit(entity_type, entity_id, action, old_data, changed_by)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), current_user_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_design_documents
    AFTER INSERT OR UPDATE OR DELETE ON design_documents
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_screens
    AFTER INSERT OR UPDATE OR DELETE ON screens
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_components
    AFTER INSERT OR UPDATE OR DELETE ON components
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- =============================================================================
-- SUPABASE REALTIME
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE design_documents;
