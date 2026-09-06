-- Import provenance (project scheduling & WBS increment 1, task 1.2).
--
-- Design doc §6.2/§9.2: additive source identity fields plus non-schedulable
-- WBS metadata. A WBS group is DISPLAY/PROVENANCE METADATA ONLY:
--  * tasks.parent_task_id keeps referencing tasks(task_id) exclusively, so a
--    WBS group can never be a task parent;
--  * no assignment/allocation/dependency/meeting table may reference
--    wbs_groups (none exists in this increment);
--  * tasks.wbs_group_id is nullable metadata (source heading placement).
--
-- external_import_runs records validated dry-run/apply evidence; the APPLY
-- mode itself does not exist until increment 4.

BEGIN;

CREATE TABLE IF NOT EXISTS external_import_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    source_system TEXT NOT NULL,
    external_root_id TEXT NOT NULL,
    snapshot_sha256 TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'DRY_RUN' CHECK (mode IN ('DRY_RUN', 'APPLY')),
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    outcome TEXT NOT NULL DEFAULT 'PENDING' CHECK (outcome IN ('PENDING', 'PASSED', 'FAILED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    -- One canonical run per project/source root: repeating the same bundle
    -- finds the SAME run row (deterministic reconciliation), never a
    -- duplicate identity.
    CONSTRAINT external_import_runs_root_unique
        UNIQUE (project_id, source_system, external_root_id)
);

CREATE TABLE IF NOT EXISTS wbs_groups (
    group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    source_system TEXT NOT NULL,
    external_id TEXT NOT NULL,
    parent_group_id UUID,
    title TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Source identity: one row per (project, source, external id).
    CONSTRAINT wbs_groups_source_identity_unique
        UNIQUE (project_id, source_system, external_id),
    -- Heading nesting stays inside the same project + source system.
    CONSTRAINT wbs_groups_scope_unique UNIQUE (project_id, source_system, group_id)
);
ALTER TABLE wbs_groups DROP CONSTRAINT IF EXISTS wbs_groups_parent_scope_fk;
ALTER TABLE wbs_groups ADD CONSTRAINT wbs_groups_parent_scope_fk
    FOREIGN KEY (project_id, source_system, parent_group_id)
    REFERENCES wbs_groups(project_id, source_system, group_id)
    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_wbs_groups_project_position
    ON wbs_groups(project_id, source_system, position);

-- Additive task source identity (NULL = locally authored task).
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_system TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_metadata JSONB;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS wbs_group_id UUID
    REFERENCES wbs_groups(group_id) ON DELETE SET NULL;

-- Import identity uniqueness: re-importing the same bundle can never create
-- a second local task for the same source identity.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_source_identity
    ON tasks(project_id, source_system, external_id)
    WHERE source_system IS NOT NULL AND external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_wbs_group_id ON tasks(wbs_group_id);

COMMIT;
