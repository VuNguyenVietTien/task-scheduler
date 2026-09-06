-- Timesheet / logwork entries (herdr-260905 requirement 8).
-- No existing logwork entity existed (verified repo-wide), so this is the new
-- canonical store. (user_id, task_id, work_date) is UNIQUE and save uses
-- ON CONFLICT DO UPDATE => re-saving a day can never duplicate entries.

CREATE TABLE timesheet_entries (
    entry_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    hours DOUBLE PRECISION NOT NULL CHECK (hours > 0 AND hours <= 24),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, task_id, work_date)
);

CREATE INDEX idx_timesheet_entries_project_date ON timesheet_entries(project_id, user_id, work_date);
