-- Create enum types first
DROP TYPE IF EXISTS project_status CASCADE;
DROP TYPE IF EXISTS project_priority CASCADE;
DROP TYPE IF EXISTS project_visibility CASCADE;
DROP TYPE IF EXISTS member_role CASCADE;

CREATE TYPE project_status AS ENUM ('active', 'archived', 'completed');
CREATE TYPE project_priority AS ENUM ('high', 'medium', 'low');
CREATE TYPE project_visibility AS ENUM ('public', 'private', 'team');
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'member', 'guest');

BEGIN;

-- Drop constraints and obsolete columns
ALTER TABLE public.projects 
    DROP CONSTRAINT IF EXISTS projects_owner_id_fkey;

ALTER TABLE public.projects
    DROP COLUMN IF EXISTS start_date,
    DROP COLUMN IF EXISTS end_date,
    DROP COLUMN IF EXISTS icon_url,
    DROP COLUMN IF EXISTS is_public;

-- Update the status column with enum values first
UPDATE public.projects 
SET status = CASE 
    WHEN status IS NULL OR status = '' THEN 'active'
    WHEN LOWER(status) = 'active' THEN 'active'
    WHEN LOWER(status) = 'archived' THEN 'archived'
    WHEN LOWER(status) = 'completed' THEN 'completed'
    ELSE 'active'
END;

-- Update member roles
UPDATE public.project_members
SET role = CASE 
    WHEN LOWER(role) = 'owner' THEN 'owner'
    WHEN LOWER(role) = 'admin' THEN 'admin'
    WHEN LOWER(role) = 'member' THEN 'member'
    ELSE 'guest'
END;

-- Add new columns and convert types
ALTER TABLE public.projects 
    ALTER COLUMN owner_id TYPE UUID USING owner_id::UUID,
    ALTER COLUMN status TYPE project_status USING status::project_status,
    ADD COLUMN IF NOT EXISTS priority project_priority NOT NULL DEFAULT 'medium',
    ADD COLUMN IF NOT EXISTS visibility project_visibility NOT NULL DEFAULT 'private',
    ADD COLUMN IF NOT EXISTS tags JSONB,
    ADD COLUMN IF NOT EXISTS progress FLOAT DEFAULT 0.0,
    ADD COLUMN IF NOT EXISTS category VARCHAR(100),
    ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Update project_members table
ALTER TABLE public.project_members
    ALTER COLUMN role TYPE member_role USING role::member_role;

-- Add constraints
ALTER TABLE public.projects 
    ADD CONSTRAINT projects_owner_id_fkey 
    FOREIGN KEY (owner_id) REFERENCES users(user_id);

ALTER TABLE public.projects
    ADD CONSTRAINT check_progress CHECK (progress >= 0 AND progress <= 100);

COMMIT;
