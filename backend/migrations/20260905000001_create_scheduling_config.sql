-- Scheduling configuration (herdr-260905 requirements 3/4/6):
-- per-member capacity (weekday/weekend hours + date overrides incl. working
-- weekends), days off (individual / group / project), real member groups
-- (also used by leave & meetings), and recurring project/group commitments
-- with fixed start time + duration that reserve attendee capacity.

-- ── Requirement 4: real member groups ────────────────────────────────────────
CREATE TABLE resource_groups (
    group_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (project_id, name)
);

CREATE TABLE resource_group_members (
    group_id UUID NOT NULL REFERENCES resource_groups(group_id) ON DELETE CASCADE,
    resource_member_id UUID NOT NULL REFERENCES resource_members(resource_member_id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, resource_member_id)
);

CREATE INDEX idx_resource_group_members_member ON resource_group_members(resource_member_id);

-- ── Requirement 3: per-member daily capacity ────────────────────────────────
CREATE TABLE member_capacity_settings (
    resource_member_id UUID PRIMARY KEY REFERENCES resource_members(resource_member_id) ON DELETE CASCADE,
    weekday_hours DOUBLE PRECISION NOT NULL DEFAULT 8 CHECK (weekday_hours >= 0 AND weekday_hours <= 24),
    weekend_hours DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (weekend_hours >= 0 AND weekend_hours <= 24)
);

-- Per-date overrides (explicit hours; overrides weekends => working weekend;
-- 0 => that date is off even on a weekday). Day-off ranges take precedence
-- over defaults but a date override wins over defaults; the UI keeps them
-- disjoint, precedence documented in the resolver.
CREATE TABLE member_capacity_overrides (
    resource_member_id UUID NOT NULL REFERENCES resource_members(resource_member_id) ON DELETE CASCADE,
    override_date DATE NOT NULL,
    hours DOUBLE PRECISION NOT NULL CHECK (hours >= 0 AND hours <= 24),
    PRIMARY KEY (resource_member_id, override_date)
);

-- Days off / leave at three scopes with CHECK-enforced shape.
CREATE TABLE member_days_off (
    day_off_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    scope TEXT NOT NULL CHECK (scope IN ('INDIVIDUAL', 'GROUP', 'PROJECT')),
    resource_member_id UUID REFERENCES resource_members(resource_member_id) ON DELETE CASCADE,
    group_id UUID REFERENCES resource_groups(group_id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_date >= start_date),
    CHECK (
        (scope = 'INDIVIDUAL' AND resource_member_id IS NOT NULL AND group_id IS NULL)
        OR (scope = 'GROUP' AND group_id IS NOT NULL AND resource_member_id IS NULL)
        OR (scope = 'PROJECT' AND resource_member_id IS NULL AND group_id IS NULL)
    )
);

CREATE INDEX idx_member_days_off_project ON member_days_off(project_id, start_date, end_date);

-- ── Requirement 6: recurring commitments (meetings) ─────────────────────────
CREATE TABLE recurring_commitments (
    commitment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('PROJECT', 'GROUP')),
    group_id UUID REFERENCES resource_groups(group_id) ON DELETE CASCADE,
    frequency TEXT NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY')),
    recurrence_interval INT NOT NULL DEFAULT 1 CHECK (recurrence_interval >= 1),
    weekday INT CHECK (weekday BETWEEN 0 AND 6),
    month_day INT CHECK (month_day BETWEEN 1 AND 31),
    start_date DATE NOT NULL,
    end_date DATE, -- NULL = unbounded (expansion is horizon-bounded client side)
    start_hour INT NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
    duration_hours DOUBLE PRECISION NOT NULL CHECK (duration_hours > 0 AND duration_hours <= 24),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (scope = 'PROJECT' AND group_id IS NULL)
        OR (scope = 'GROUP' AND group_id IS NOT NULL)
    ),
    CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_recurring_commitments_project ON recurring_commitments(project_id);
