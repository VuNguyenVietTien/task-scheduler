-- Add new task progress type enum
CREATE TYPE task_progress_type AS ENUM (
    'not_started',
    'in_progress', 
    'completed',
    'blocked',
    'on_hold'
);

-- Add new columns to tasks table
ALTER TABLE tasks
ADD COLUMN type varchar,
ADD COLUMN category varchar,
ADD COLUMN progress_type task_progress_type,
ADD COLUMN tags jsonb;

-- Add comment to describe new columns
COMMENT ON COLUMN tasks.type IS 'Task type (e.g. bug, feature, etc)';
COMMENT ON COLUMN tasks.category IS 'Task category for organization';
COMMENT ON COLUMN tasks.progress_type IS 'Task progress tracking status';
COMMENT ON COLUMN tasks.tags IS 'Array of task tags stored as JSONB';