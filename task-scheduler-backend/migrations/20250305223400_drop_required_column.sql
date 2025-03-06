-- Modify columns to allow NULL
ALTER TABLE projects
    ALTER COLUMN start_date DROP NOT NULL,
    ALTER COLUMN end_date DROP NOT NULL;