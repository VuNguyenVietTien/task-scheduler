-- Add new columns to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS icon_url VARCHAR(255),
ADD COLUMN IF NOT EXISTS metadata JSONB,
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(workspace_id),
ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON projects(workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);

-- Update project_members table
DO $$ BEGIN
    CREATE TYPE member_role AS ENUM ('admin', 'member', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS project_members (
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role member_role NOT NULL DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, user_id)
);

-- Add index on member role
CREATE INDEX IF NOT EXISTS idx_project_members_role ON project_members(role);