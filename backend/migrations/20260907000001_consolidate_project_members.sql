-- Canonical project member identity. This is a forward-only, fail-closed
-- consolidation: resource_members becomes a compatibility view over the
-- project_members base table. No source ID, scheduling record, or plan JSON
-- is rewritten.
BEGIN;

SET LOCAL lock_timeout = '5s';
LOCK TABLE projects, users, project_members, resource_members, tasks,
    resource_member_classifications, resource_groups, resource_group_members,
    member_capacity_settings, member_capacity_overrides, member_days_off,
    recurring_commitments IN SHARE ROW EXCLUSIVE MODE;

-- This migration is deliberately tied to the schema produced by the preceding
-- migrations. Unknown dependants are an integrity concern, never a reason to
-- use DROP ... CASCADE.
DO $$
DECLARE
    unexpected integer;
BEGIN
    IF (SELECT relkind FROM pg_class WHERE oid = 'project_members'::regclass) <> 'r'
       OR (SELECT relkind FROM pg_class WHERE oid = 'resource_members'::regclass) <> 'r' THEN
        RAISE EXCEPTION 'member consolidation requires project_members and resource_members base tables';
    END IF;

    SELECT count(*) INTO unexpected
    FROM pg_constraint fk
    JOIN pg_class source ON source.oid = fk.conrelid
    WHERE fk.contype = 'f' AND fk.confrelid = 'resource_members'::regclass
      AND source.relname NOT IN (
        'resource_member_classifications', 'resource_group_members',
        'member_capacity_settings', 'member_capacity_overrides',
        'member_days_off', 'tasks'
      );
    IF unexpected <> 0 THEN
        RAISE EXCEPTION 'member consolidation found unexpected resource_members foreign-key dependants';
    END IF;

    -- All known references are required. A missing edge means this is not the
    -- expected old schema and must be reviewed rather than guessed at.
    IF (SELECT count(*) FROM pg_constraint WHERE contype = 'f'
          AND confrelid = 'resource_members'::regclass) <> 7 THEN
        RAISE EXCEPTION 'member consolidation expected seven resource_members foreign keys';
    END IF;
END $$;

-- Stop before any DDL/data rewrite on ambiguous or corrupt source data.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM resource_members WHERE btrim(display_name) = ''
    ) THEN
        RAISE EXCEPTION 'member consolidation refused blank resource display name';
    END IF;
    IF EXISTS (
        SELECT 1 FROM users GROUP BY lower(btrim(email)) HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'member consolidation refused ambiguous normalized user email';
    END IF;
    IF EXISTS (
        SELECT 1 FROM resource_members
        WHERE member_kind = 'MEMBER' AND NULLIF(btrim(email), '') IS NOT NULL
        GROUP BY project_id, lower(btrim(email)) HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'member consolidation refused duplicate normalized resource email';
    END IF;
    -- A resource already linked to a different account must never be paired
    -- through an email match with a legacy access row.
    IF EXISTS (
        SELECT 1
        FROM project_members pm
        JOIN users u ON u.user_id = pm.user_id
        JOIN resource_members rm
          ON rm.project_id = pm.project_id
         AND lower(btrim(rm.email)) = lower(btrim(u.email))
        WHERE rm.user_id IS NOT NULL AND rm.user_id <> pm.user_id
    ) THEN
        RAISE EXCEPTION 'member consolidation refused conflicting resource/email user links';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM tasks t
        JOIN resource_members rm ON rm.resource_member_id = t.assignee_resource_member_id
        WHERE t.assignee_resource_member_id IS NOT NULL
          AND rm.project_id <> t.project_id
    ) THEN
        RAISE EXCEPTION 'member consolidation refused cross-project task resource assignment';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM tasks t
        JOIN resource_members rm ON rm.resource_member_id = t.assignee_resource_member_id
        WHERE t.assignee_resource_member_id IS NOT NULL
          AND rm.member_kind <> 'MEMBER'
    ) THEN
        RAISE EXCEPTION 'member consolidation refused non-MEMBER task assignment';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM tasks t
        JOIN resource_members rm ON rm.resource_member_id = t.assignee_resource_member_id
        WHERE t.assignee_resource_member_id IS NOT NULL
          AND t.assignee_id IS NOT NULL
          AND t.assignee_id IS DISTINCT FROM rm.user_id
    ) THEN
        RAISE EXCEPTION 'member consolidation refused conflicting task user/resource assignment';
    END IF;
END $$;

-- Expand the existing access table in place. Its member_id remains the old
-- access handle; resource_member_id is the old scheduling handle.
ALTER TABLE project_members
    ADD COLUMN resource_member_id UUID,
    ADD COLUMN display_name TEXT,
    ADD COLUMN email TEXT,
    ADD COLUMN member_kind TEXT NOT NULL DEFAULT 'MEMBER',
    ADD COLUMN linked_at TIMESTAMPTZ,
    ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE project_members ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE project_members ALTER COLUMN role DROP NOT NULL;
ALTER TABLE project_members ALTER COLUMN role DROP DEFAULT;

-- Exact project/user pairs are the only unconditional merge rule.
UPDATE project_members pm
SET resource_member_id = rm.resource_member_id,
    display_name = rm.display_name,
    email = NULLIF(btrim(rm.email), ''),
    member_kind = rm.member_kind,
    linked_at = rm.linked_at,
    created_at = rm.created_at,
    updated_at = rm.updated_at
FROM resource_members rm
WHERE rm.project_id = pm.project_id AND rm.user_id = pm.user_id;

-- The only secondary merge rule: exactly one unlinked MEMBER resource whose
-- normalized email matches that access account. The preflight makes an
-- incompatible linked candidate an error; the partial email check makes this
-- candidate one-to-one.
UPDATE project_members pm
SET resource_member_id = rm.resource_member_id,
    display_name = rm.display_name,
    email = NULLIF(btrim(rm.email), ''),
    member_kind = rm.member_kind,
    linked_at = rm.linked_at,
    created_at = rm.created_at,
    updated_at = rm.updated_at
FROM users u, resource_members rm
WHERE pm.resource_member_id IS NULL
  AND u.user_id = pm.user_id
  AND rm.project_id = pm.project_id
  AND rm.user_id IS NULL
  AND rm.member_kind = 'MEMBER'
  AND NULLIF(btrim(rm.email), '') IS NOT NULL
  AND lower(btrim(rm.email)) = lower(btrim(u.email));

-- Carry the pre-existing access account into the approved email pair. This is
-- not an access grant: pm.role was already present and is unchanged.
UPDATE resource_members rm
SET user_id = pm.user_id,
    linked_at = COALESCE(rm.linked_at, now()),
    updated_at = now()
FROM project_members pm
WHERE pm.resource_member_id = rm.resource_member_id
  AND rm.user_id IS NULL
  AND pm.user_id IS NOT NULL;

-- An access-only row becomes a canonical MEMBER. Prefer its old access ID as
-- the scheduling ID only when no resource source ID owns it; otherwise retain
-- the access ID and generate a separate resource ID.
UPDATE project_members pm
SET resource_member_id = CASE
        WHEN NOT EXISTS (
            SELECT 1 FROM resource_members rm
            WHERE rm.resource_member_id = pm.member_id
        ) THEN pm.member_id
        ELSE uuid_generate_v4()
    END,
    display_name = COALESCE(
        NULLIF(btrim(u.full_name), ''), NULLIF(btrim(u.name), ''),
        NULLIF(btrim(u.username), ''), u.email
    ),
    email = u.email,
    member_kind = 'MEMBER',
    linked_at = now(),
    created_at = now(),
    updated_at = now()
FROM users u
WHERE pm.resource_member_id IS NULL AND u.user_id = pm.user_id;

-- Preserve every remaining resource row (including linked but no-access
-- identities). Its role is NULL: linking is not permission elevation.
INSERT INTO project_members (
    member_id, resource_member_id, project_id, user_id, joined_at, invited_by,
    role, display_name, email, member_kind, linked_at, created_at, updated_at
)
SELECT
    CASE WHEN EXISTS (SELECT 1 FROM project_members pm WHERE pm.member_id = rm.resource_member_id)
         THEN uuid_generate_v4() ELSE rm.resource_member_id END,
    rm.resource_member_id, rm.project_id, rm.user_id, NULL, NULL, NULL,
    rm.display_name, NULLIF(btrim(rm.email), ''), rm.member_kind,
    rm.linked_at, rm.created_at, rm.updated_at
FROM resource_members rm
WHERE NOT EXISTS (
    SELECT 1 FROM project_members pm WHERE pm.resource_member_id = rm.resource_member_id
);

-- Owners and old account-only task assignments must have scheduling identities
-- even if a historical database omitted an access row. These are real users,
-- never fabricated accounts, and receive no new role.
INSERT INTO project_members (
    member_id, resource_member_id, project_id, user_id, joined_at, invited_by,
    role, display_name, email, member_kind, linked_at, created_at, updated_at
)
SELECT uuid_generate_v4(), uuid_generate_v4(), required.project_id, required.user_id,
       NULL, NULL, NULL,
       COALESCE(NULLIF(btrim(u.full_name), ''), NULLIF(btrim(u.name), ''), NULLIF(btrim(u.username), ''), u.email),
       u.email, 'MEMBER', now(), now(), now()
FROM (
    SELECT p.project_id, p.owner_id AS user_id FROM projects p
    UNION
    SELECT t.project_id, t.assignee_id FROM tasks t
    WHERE t.assignee_id IS NOT NULL
) required
JOIN users u ON u.user_id = required.user_id
WHERE NOT EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = required.project_id AND pm.user_id = required.user_id
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM project_members WHERE resource_member_id IS NULL
               OR btrim(display_name) = '') THEN
        RAISE EXCEPTION 'member consolidation failed to map every canonical member';
    END IF;
    IF EXISTS (
        SELECT 1 FROM project_members
        WHERE role IS NOT NULL AND (user_id IS NULL OR member_kind <> 'MEMBER')
    ) THEN
        RAISE EXCEPTION 'member consolidation found invalid role/member identity pair';
    END IF;
    IF EXISTS (
        SELECT 1 FROM project_members
        WHERE member_kind = 'MEMBER' AND email IS NOT NULL
        GROUP BY project_id, lower(btrim(email)) HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'member consolidation final normalized email conflict';
    END IF;
END $$;

ALTER TABLE project_members
    ALTER COLUMN resource_member_id SET NOT NULL,
    ALTER COLUMN display_name SET NOT NULL;
ALTER TABLE project_members
    ADD CONSTRAINT project_members_resource_member_id_key UNIQUE (resource_member_id),
    ADD CONSTRAINT project_members_project_resource_key UNIQUE (project_id, resource_member_id),
    ADD CONSTRAINT project_members_display_name_nonempty CHECK (length(btrim(display_name)) > 0),
    ADD CONSTRAINT project_members_kind_check CHECK (member_kind IN ('MEMBER', 'COMPANY', 'GROUP')),
    ADD CONSTRAINT project_members_access_requires_linked_member
        CHECK (role IS NULL OR (user_id IS NOT NULL AND member_kind = 'MEMBER'));
CREATE UNIQUE INDEX project_members_member_email_normalized_unique
    ON project_members(project_id, lower(btrim(email)))
    WHERE email IS NOT NULL AND member_kind = 'MEMBER';
CREATE INDEX idx_project_members_resource_project
    ON project_members(project_id, resource_member_id);

-- Repoint every known scheduling FK without dropping unknown dependencies.
DO $$
DECLARE
    fk record;
    replacement text;
BEGIN
    FOR fk IN
        SELECT n.nspname AS schema_name, c.relname AS table_name, con.conname,
               pg_get_constraintdef(con.oid) AS definition
        FROM pg_constraint con
        JOIN pg_class c ON c.oid = con.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE con.contype = 'f' AND con.confrelid = 'resource_members'::regclass
    LOOP
        IF position('REFERENCES resource_members(resource_member_id)' IN fk.definition) = 0
           OR position('resource_member_id' IN fk.definition) = 0 THEN
            RAISE EXCEPTION 'unexpected resource FK %.%: %', fk.table_name, fk.conname, fk.definition;
        END IF;
        replacement := replace(
            fk.definition,
            'REFERENCES resource_members(resource_member_id)',
            'REFERENCES project_members(resource_member_id)'
        );
        -- Hard deleting a canonical identity is intentionally restricted. It
        -- must not silently erase a task assignment while leaving its user
        -- mirror inconsistent.
        IF fk.table_name = 'tasks' THEN
            replacement := replace(replacement, ' ON DELETE SET NULL', ' ON DELETE RESTRICT');
        END IF;
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', fk.schema_name, fk.table_name, fk.conname);
        EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I %s',
                       fk.schema_name, fk.table_name, fk.conname, replacement);
    END LOOP;
END $$;

-- Task mirrors are populated only from the canonical stable resource key.
UPDATE tasks t
SET assignee_resource_member_id = pm.resource_member_id
FROM project_members pm
WHERE t.assignee_resource_member_id IS NULL
  AND t.assignee_id IS NOT NULL
  AND pm.project_id = t.project_id
  AND pm.user_id = t.assignee_id;
UPDATE tasks t
SET assignee_id = pm.user_id
FROM project_members pm
WHERE t.assignee_resource_member_id = pm.resource_member_id
  AND t.assignee_id IS DISTINCT FROM pm.user_id;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM tasks t
        LEFT JOIN project_members pm ON pm.resource_member_id = t.assignee_resource_member_id
        WHERE (t.assignee_resource_member_id IS NULL AND t.assignee_id IS NOT NULL)
           OR (t.assignee_resource_member_id IS NOT NULL AND (
                pm.member_id IS NULL OR pm.project_id <> t.project_id
                OR pm.member_kind <> 'MEMBER' OR t.assignee_id IS DISTINCT FROM pm.user_id
           ))
    ) THEN
        RAISE EXCEPTION 'member consolidation could not normalize task assignment mirrors';
    END IF;
END $$;

-- User deletion preserves the canonical scheduling row and all associated
-- configuration. The legacy account mirror is cleared atomically.
DO $$
DECLARE old_fk name;
BEGIN
    SELECT conname INTO old_fk
    FROM pg_constraint
    WHERE conrelid = 'project_members'::regclass
      AND contype = 'f'
      AND confrelid = 'users'::regclass
      AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
                           WHERE attrelid = 'project_members'::regclass
                             AND attname = 'user_id' AND NOT attisdropped)];
    IF old_fk IS NULL THEN
        RAISE EXCEPTION 'member consolidation cannot find project_members user FK';
    END IF;
    EXECUTE format('ALTER TABLE project_members DROP CONSTRAINT %I', old_fk);
END $$;
ALTER TABLE project_members
    ADD CONSTRAINT project_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION clear_canonical_member_user_links()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    -- Clear the canonical mirror first: the deferrable task check observes a
    -- member's current linked user, so task rows follow in the same trigger.
    UPDATE project_members
    SET user_id = NULL, role = NULL, linked_at = NULL, updated_at = now()
    WHERE user_id = OLD.user_id;
    UPDATE tasks SET assignee_id = NULL WHERE assignee_id = OLD.user_id;
    RETURN OLD;
END $$;
CREATE TRIGGER users_clear_canonical_member_links
BEFORE DELETE ON users
FOR EACH ROW EXECUTE FUNCTION clear_canonical_member_user_links();

-- Database consistency boundary for writes that bypass GraphQL.
CREATE OR REPLACE FUNCTION validate_canonical_task_assignment()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE member project_members%ROWTYPE;
BEGIN
    IF NEW.assignee_resource_member_id IS NULL THEN
        IF NEW.assignee_id IS NOT NULL THEN
            RAISE EXCEPTION 'task assignee_id requires canonical resource assignment';
        END IF;
        RETURN NEW;
    END IF;
    SELECT * INTO member FROM project_members
    WHERE resource_member_id = NEW.assignee_resource_member_id;
    IF NOT FOUND OR member.project_id <> NEW.project_id OR member.member_kind <> 'MEMBER'
       OR NEW.assignee_id IS DISTINCT FROM member.user_id THEN
        RAISE EXCEPTION 'task assignment must be a same-project MEMBER with matching user mirror';
    END IF;
    RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER tasks_canonical_assignment_check
AFTER INSERT OR UPDATE OF project_id, assignee_id, assignee_resource_member_id ON tasks
DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION validate_canonical_task_assignment();

CREATE OR REPLACE FUNCTION validate_resource_group_member_project()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE group_project uuid; member_project uuid; resolved_member_kind text;
BEGIN
    SELECT rg.project_id INTO group_project FROM resource_groups AS rg WHERE rg.group_id = NEW.group_id;
    SELECT pm.project_id, pm.member_kind INTO member_project, resolved_member_kind
      FROM project_members AS pm WHERE pm.resource_member_id = NEW.resource_member_id;
    IF group_project IS NULL OR member_project IS NULL OR group_project <> member_project
       OR resolved_member_kind <> 'MEMBER' THEN
        RAISE EXCEPTION 'resource group member must be a same-project MEMBER';
    END IF;
    RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER resource_group_members_project_check
AFTER INSERT OR UPDATE ON resource_group_members
DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION validate_resource_group_member_project();

CREATE OR REPLACE FUNCTION validate_resource_classification()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target project_members%ROWTYPE; classifier project_members%ROWTYPE;
BEGIN
    SELECT * INTO target FROM project_members WHERE resource_member_id = NEW.resource_member_id;
    SELECT * INTO classifier FROM project_members WHERE resource_member_id = NEW.classified_by_resource_member_id;
    IF NOT FOUND OR target.project_id <> classifier.project_id OR target.member_kind <> 'MEMBER'
       OR classifier.member_kind NOT IN ('COMPANY', 'GROUP') THEN
        RAISE EXCEPTION 'resource classification requires same-project COMPANY/GROUP -> MEMBER';
    END IF;
    RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER resource_member_classifications_canonical_check
AFTER INSERT OR UPDATE ON resource_member_classifications
DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION validate_resource_classification();

CREATE OR REPLACE FUNCTION validate_member_capacity_target()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE kind text;
BEGIN
    SELECT member_kind INTO kind FROM project_members WHERE resource_member_id = NEW.resource_member_id;
    IF kind IS DISTINCT FROM 'MEMBER' THEN
        RAISE EXCEPTION 'capacity configuration requires a MEMBER';
    END IF;
    RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER member_capacity_settings_member_check
AFTER INSERT OR UPDATE ON member_capacity_settings
DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION validate_member_capacity_target();
CREATE CONSTRAINT TRIGGER member_capacity_overrides_member_check
AFTER INSERT OR UPDATE ON member_capacity_overrides
DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION validate_member_capacity_target();

-- Project identity/kind is immutable after consolidation: changing either can
-- otherwise make existing tasks/configuration cross-project or non-MEMBER.
CREATE OR REPLACE FUNCTION prevent_canonical_identity_edge_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.project_id <> OLD.project_id OR NEW.member_kind <> OLD.member_kind THEN
        RAISE EXCEPTION 'canonical member project and kind are immutable';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER project_members_identity_edge_immutable
BEFORE UPDATE OF project_id, member_kind ON project_members
FOR EACH ROW EXECUTE FUNCTION prevent_canonical_identity_edge_mutation();

CREATE OR REPLACE FUNCTION validate_member_days_off_scope()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_project uuid;
BEGIN
    IF NEW.scope = 'INDIVIDUAL' THEN
        SELECT pm.project_id INTO target_project FROM project_members AS pm
        WHERE pm.resource_member_id = NEW.resource_member_id AND pm.member_kind = 'MEMBER';
    ELSIF NEW.scope = 'GROUP' THEN
        SELECT rg.project_id INTO target_project FROM resource_groups AS rg WHERE rg.group_id = NEW.group_id;
    ELSE
        target_project := NEW.project_id;
    END IF;
    IF target_project IS NULL OR target_project <> NEW.project_id THEN
        RAISE EXCEPTION 'day off target must belong to its project';
    END IF;
    RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER member_days_off_project_check
AFTER INSERT OR UPDATE ON member_days_off
DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION validate_member_days_off_scope();

CREATE OR REPLACE FUNCTION validate_recurring_commitment_scope()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE group_project uuid;
BEGIN
    IF NEW.scope = 'GROUP' THEN
        SELECT rg.project_id INTO group_project FROM resource_groups AS rg WHERE rg.group_id = NEW.group_id;
        IF group_project IS NULL OR group_project <> NEW.project_id THEN
            RAISE EXCEPTION 'commitment group must belong to its project';
        END IF;
    END IF;
    RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER recurring_commitments_project_check
AFTER INSERT OR UPDATE ON recurring_commitments
DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION validate_recurring_commitment_scope();

-- Existing rows do not fire new triggers; reject a source state that would
-- violate the same durable boundaries.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM resource_member_classifications c
        LEFT JOIN project_members target ON target.resource_member_id = c.resource_member_id
        LEFT JOIN project_members classifier ON classifier.resource_member_id = c.classified_by_resource_member_id
        WHERE target.member_id IS NULL OR classifier.member_id IS NULL
           OR target.project_id <> classifier.project_id
           OR target.member_kind <> 'MEMBER'
           OR classifier.member_kind NOT IN ('COMPANY', 'GROUP')
    ) OR EXISTS (
        SELECT 1 FROM resource_group_members gm
        JOIN resource_groups rg ON rg.group_id = gm.group_id
        JOIN project_members pm ON pm.resource_member_id = gm.resource_member_id
        WHERE rg.project_id <> pm.project_id OR pm.member_kind <> 'MEMBER'
    ) OR EXISTS (
        SELECT 1 FROM member_days_off d
        LEFT JOIN project_members pm ON pm.resource_member_id = d.resource_member_id
        LEFT JOIN resource_groups rg ON rg.group_id = d.group_id
        WHERE (d.scope = 'INDIVIDUAL' AND (pm.member_id IS NULL OR pm.project_id <> d.project_id OR pm.member_kind <> 'MEMBER'))
           OR (d.scope = 'GROUP' AND (rg.group_id IS NULL OR rg.project_id <> d.project_id))
    ) OR EXISTS (
        SELECT 1 FROM recurring_commitments c
        LEFT JOIN resource_groups rg ON rg.group_id = c.group_id
        WHERE c.scope = 'GROUP' AND (rg.group_id IS NULL OR rg.project_id <> c.project_id)
    ) OR EXISTS (
        SELECT 1 FROM member_capacity_settings s
        LEFT JOIN project_members pm ON pm.resource_member_id = s.resource_member_id
        WHERE pm.member_id IS NULL OR pm.member_kind <> 'MEMBER'
    ) OR EXISTS (
        SELECT 1 FROM member_capacity_overrides o
        LEFT JOIN project_members pm ON pm.resource_member_id = o.resource_member_id
        WHERE pm.member_id IS NULL OR pm.member_kind <> 'MEMBER'
    ) THEN
        RAISE EXCEPTION 'member consolidation found cross-project or non-MEMBER scheduling configuration';
    END IF;
END $$;

-- Fail if old storage cannot be removed without an explicit mapped dependency.
DROP TABLE resource_members;
CREATE VIEW resource_members AS
SELECT resource_member_id, project_id, display_name, email, user_id, member_kind,
       linked_at, created_at, updated_at
FROM project_members;
REVOKE INSERT, UPDATE, DELETE ON resource_members FROM PUBLIC;

COMMIT;
