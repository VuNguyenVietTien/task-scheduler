-- Create member_role enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE member_role AS ENUM ('owner', 'admin', 'member', 'guest');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

BEGIN;

-- Update the roles to use the enum type
UPDATE project_members
SET role = CASE 
    WHEN LOWER(role) = 'owner' THEN 'owner'
    WHEN LOWER(role) = 'admin' THEN 'admin'
    WHEN LOWER(role) = 'member' THEN 'member'
    ELSE 'guest'
END;

-- Alter the role column to use the new enum type
ALTER TABLE project_members
    ALTER COLUMN role TYPE member_role USING role::member_role,
    ALTER COLUMN role SET DEFAULT 'member';

COMMIT;
