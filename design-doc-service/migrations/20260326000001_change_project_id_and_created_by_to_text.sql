-- Change project_id from BIGINT to TEXT to support UUID project IDs from main backend
ALTER TABLE systems ALTER COLUMN project_id TYPE TEXT USING project_id::TEXT;

-- Change created_by from BIGINT to TEXT to support UUID user IDs from main backend JWT
ALTER TABLE systems ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
ALTER TABLE design_documents ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
