-- Create enum types for project fields
DO $$ BEGIN
    CREATE TYPE project_status AS ENUM (
        'active',
        'on_hold', 
        'completed',
        'cancelled'
    );

    CREATE TYPE project_priority AS ENUM (
        'low',
        'medium',
        'high',
        'urgent'
    );

    CREATE TYPE project_visibility AS ENUM (
        'public',
        'private',
        'team'
    );
END $$;

-- Update existing columns to use new enum types
ALTER TABLE projects 
    ALTER COLUMN status TYPE project_status USING status::project_status,
    ALTER COLUMN priority TYPE project_priority USING priority::project_priority,
    ALTER COLUMN visibility TYPE project_visibility USING visibility::project_visibility;
