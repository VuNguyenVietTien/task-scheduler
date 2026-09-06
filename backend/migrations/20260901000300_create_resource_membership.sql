-- Resource membership (project scheduling & WBS increment 1, task 1.2).
--
-- Design doc §6.3: a project member may be linked to a real user OR remain a
-- PLACEHOLDER with a stable resource_member_id, required display_name, and
-- OPTIONAL email. No fabricated users/emails. Linking preserves the member
-- ID. Companies and project groups are CLASSIFICATION/FILTERING ONLY — never
-- assignees or capacity pools (later increments validate member_kind =
-- 'MEMBER' on every assignment/allocation).
--
-- The legacy project_members table (requires a real user_id) stays untouched.

BEGIN;

CREATE TABLE IF NOT EXISTS resource_members (
    resource_member_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    email TEXT,
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    member_kind TEXT NOT NULL DEFAULT 'MEMBER'
        CHECK (member_kind IN ('MEMBER', 'COMPANY', 'GROUP')),
    linked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One linked user per project across resource members: duplicate linked-user
-- conflicts must be resolved explicitly (unlink or choose another user),
-- never silently rebound. Placeholders (user_id IS NULL) are unrestricted.
CREATE UNIQUE INDEX IF NOT EXISTS resource_members_linked_user_unique
    ON resource_members(project_id, user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_resource_members_project
    ON resource_members(project_id);

-- Classification edges: a concrete MEMBER classified by a COMPANY/GROUP.
-- Domain code (domain::resource_identity::validate_classification) enforces
-- MEMBER-target / COMPANY|GROUP-classifier / same-project; SQL enforces
-- structural sanity (no self-classification, cascade cleanup).
CREATE TABLE IF NOT EXISTS resource_member_classifications (
    resource_member_id UUID NOT NULL
        REFERENCES resource_members(resource_member_id) ON DELETE CASCADE,
    classified_by_resource_member_id UUID NOT NULL
        REFERENCES resource_members(resource_member_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (resource_member_id, classified_by_resource_member_id),
    CONSTRAINT resource_member_classifications_no_self
        CHECK (resource_member_id <> classified_by_resource_member_id)
);

COMMIT;
