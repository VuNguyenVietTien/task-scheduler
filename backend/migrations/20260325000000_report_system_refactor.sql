-- Report System Refactor Migration
-- 1. Update member_role enum: add 'manager', 'leader', 'guest' values
-- 2. Add new columns to reports table
-- 3. Update unique constraint on reports

-- Step 1: Add new values to member_role enum
ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'leader';
ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'guest';

-- Step 2: Reset all existing member roles to 'member' (per validation decision)
UPDATE project_members SET role = 'member';

-- Step 3: Add new columns to reports table
ALTER TABLE reports ADD COLUMN IF NOT EXISTS rejected_tasks INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS on_schedule_percentage NUMERIC(5,2) DEFAULT 0;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS delay_percentage NUMERIC(5,2) DEFAULT 0;

-- Step 4: Drop old unique constraint and add new one
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_report_type_report_date_project_id_key;
ALTER TABLE reports ADD CONSTRAINT reports_type_period_project_unique
  UNIQUE (report_type, period_start_date, period_end_date, project_id);

-- Step 5: Add index for period-based queries
CREATE INDEX IF NOT EXISTS idx_reports_period ON reports(period_start_date, period_end_date);
