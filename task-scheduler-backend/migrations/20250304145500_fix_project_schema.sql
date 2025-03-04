-- Convert enum types to VARCHAR first
ALTER TABLE public.projects
    ALTER COLUMN status TYPE VARCHAR(50) USING status::VARCHAR(50),
    ALTER COLUMN priority TYPE VARCHAR(50) USING priority::VARCHAR(50),
    ALTER COLUMN visibility TYPE VARCHAR(50) USING visibility::VARCHAR(50);

-- Drop enum types
DROP TYPE IF EXISTS project_status CASCADE;
DROP TYPE IF EXISTS project_priority CASCADE;
DROP TYPE IF EXISTS project_visibility CASCADE;

-- Add NOT NULL constraints where needed
ALTER TABLE public.projects
    ALTER COLUMN created_at SET NOT NULL,
    ALTER COLUMN updated_at SET NOT NULL,
    ALTER COLUMN status SET NOT NULL,
    ALTER COLUMN priority SET NOT NULL,
    ALTER COLUMN visibility SET NOT NULL,
    ALTER COLUMN progress SET NOT NULL DEFAULT 0;

-- Set default values
UPDATE public.projects SET
    status = 'active' WHERE status IS NULL,
    priority = 'medium' WHERE priority IS NULL,
    visibility = 'private' WHERE visibility IS NULL;

-- Add check constraints
ALTER TABLE public.projects
    ADD CONSTRAINT check_status CHECK (status IN ('active', 'archived', 'completed')),
    ADD CONSTRAINT check_priority CHECK (priority IN ('high', 'medium', 'low')),
    ADD CONSTRAINT check_visibility CHECK (visibility IN ('public', 'private', 'team'));