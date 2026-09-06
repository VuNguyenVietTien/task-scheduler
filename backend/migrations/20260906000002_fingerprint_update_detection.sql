-- herdr-260906 rework (review P2-1): config-fingerprint drift detection for
-- IN-PLACE updates. member_days_off / resource_groups / recurring_commitments
-- / resource_group_members were keyed by created_at|added_at only, so an
-- UPDATE (e.g. editing a day-off range) kept the saved-plan fingerprint
-- identical and a stale plan was never marked stale. Adds updated_at to all
-- four tables plus BEFORE UPDATE touch triggers; the fingerprint resolver now
-- reads max(updated_at) on every category. INSERT backfill = now() (tables
-- gain the column with a default; no rewrite, no data change).
ALTER TABLE member_days_off
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE resource_groups
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE recurring_commitments
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE resource_group_members
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION pm_touch_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pm_member_days_off_touch BEFORE UPDATE ON member_days_off
    FOR EACH ROW EXECUTE FUNCTION pm_touch_updated_at();
CREATE TRIGGER pm_resource_groups_touch BEFORE UPDATE ON resource_groups
    FOR EACH ROW EXECUTE FUNCTION pm_touch_updated_at();
CREATE TRIGGER pm_recurring_commitments_touch BEFORE UPDATE ON recurring_commitments
    FOR EACH ROW EXECUTE FUNCTION pm_touch_updated_at();
CREATE TRIGGER pm_resource_group_members_touch BEFORE UPDATE ON resource_group_members
    FOR EACH ROW EXECUTE FUNCTION pm_touch_updated_at();

COMMENT ON COLUMN member_days_off.updated_at IS 'bumped by trigger on UPDATE; consumed by the saved-plan config fingerprint';
