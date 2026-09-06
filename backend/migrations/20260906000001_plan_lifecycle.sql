-- herdr-260906: saved-plan lifecycle + placeholder task assignment.
-- 1) tasks.assignee_resource_member_id: a task may be assigned to a
--    PLACEHOLDER resource member BEFORE any user link exists. Linking the
--    member to a user later keeps the assignment identity (stable
--    resource_member_id PK) and therefore the scheduling key.
ALTER TABLE tasks
    ADD COLUMN assignee_resource_member_id UUID
        REFERENCES resource_members(resource_member_id) ON DELETE SET NULL;

CREATE INDEX idx_tasks_assignee_resource_member
    ON tasks(assignee_resource_member_id);

COMMENT ON COLUMN tasks.assignee_resource_member_id IS
    'Direct assignment to a project resource member (may be an unlinked placeholder). Distinct from assignee_id (users FK): both may be set; scheduling prefers this key when present.';

-- 2) plans: append-only revision chain + config fingerprint for staleness.
--    A saved plan stores a snapshot in plan_data (v2 shape:
--    {version:2, tasks:[{taskId,startDate,endDate,hoursPerDay,assigneeUserId,
--    assigneeResourceMemberId,priorityOrder}], meta:{configFingerprint,...}}).
--    Staleness is COMPUTED AT READ TIME by comparing the stored
--    config_fingerprint with the current project scheduling config
--    fingerprint — capacity/leave/group/commitment changes can never mutate
--    the snapshot itself.
ALTER TABLE plans
    ADD COLUMN revision INT NOT NULL DEFAULT 1,
    ADD COLUMN config_fingerprint TEXT,
    ADD COLUMN parent_plan_id UUID REFERENCES plans(plan_id) ON DELETE SET NULL;

CREATE INDEX idx_plans_parent ON plans(parent_plan_id);

COMMENT ON COLUMN plans.revision IS '1 for a new plan; NEW_REVISION saves append revision+1 (parent_plan_id chain), SAME_REVISION overwrites this row only when the user explicitly chooses it';
COMMENT ON COLUMN plans.config_fingerprint IS 'Deterministic project scheduling-config fingerprint at save time (categories: members, capacity, overrides, days_off, groups, group_members, commitments). Read-time comparison marks the plan stale.';
