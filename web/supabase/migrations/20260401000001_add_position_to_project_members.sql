-- Add position field to project_members table
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS position text;
