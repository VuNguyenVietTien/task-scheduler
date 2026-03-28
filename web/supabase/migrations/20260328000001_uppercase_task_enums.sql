-- Migrate task_status and task_priority enums to uppercase values
-- Ensures consistency between frontend TypeScript types and database enums

BEGIN;

-- Step 1: Rename old enum types
ALTER TYPE task_status RENAME TO task_status_old;
ALTER TYPE task_priority RENAME TO task_priority_old;

-- Step 2: Create new enum types with uppercase values
CREATE TYPE task_status AS ENUM ('TODO', 'DOING', 'DONE', 'CLOSE', 'PENDING', 'REVIEW', 'BLOCKED', 'REJECTED', 'ARCHIVED');
CREATE TYPE task_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL');

-- Step 3: Update tasks table
ALTER TABLE tasks ALTER COLUMN status DROP DEFAULT;
ALTER TABLE tasks ALTER COLUMN status TYPE task_status USING (UPPER(status::text)::task_status);
ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'TODO';

ALTER TABLE tasks ALTER COLUMN priority DROP DEFAULT;
ALTER TABLE tasks ALTER COLUMN priority TYPE task_priority USING (UPPER(priority::text)::task_priority);
ALTER TABLE tasks ALTER COLUMN priority SET DEFAULT 'MEDIUM';

-- Step 4: Update task_status_history table
ALTER TABLE task_status_history
  ALTER COLUMN previous_status TYPE task_status
  USING (CASE WHEN previous_status IS NULL THEN NULL ELSE UPPER(previous_status::text)::task_status END);
ALTER TABLE task_status_history
  ALTER COLUMN new_status TYPE task_status USING (UPPER(new_status::text)::task_status);

-- Step 5: Drop old enum types
DROP TYPE task_status_old;
DROP TYPE task_priority_old;

COMMIT;
