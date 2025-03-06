-- Create enum types if not exists
DO $$ BEGIN
    CREATE TYPE project_status AS ENUM ('ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE member_role AS ENUM ('ADMIN', 'MEMBER', 'VIEWER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;