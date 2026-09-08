# Gantt assignee sync

## Outcome
List assignment to any canonical project member, including unlinked/name-only members, stays authoritative in Redux and appears in Gantt rows, allocation bars, and edit modal before and after reload.

## Constraints
- No deployment, production mutation, schema, or data changes.
- Reuse `resource_members` and dual assignment fields.
- Keep mutation task selection aligned with List task fragment.

## Plan
- [x] Diagnose List/Gantt/member query, normalizer, mutation, and Redux hierarchy flow.
- [x] Make Gantt/modal resolve and save canonical resource-member identities.
- [x] Add focused frontend contract/integration tests.
- [x] Run focused frontend tests; record unrelated baseline configuration/typecheck failures.
- [x] Review and report; commit/push pending final git step.

## Acceptance
- Linked and unlinked resource assignments render by member display name.
- Select and unset send `assignee_resource_member_id` plus compatible nullable `assignee_id`.
- Confirmed mutation result upserts into the existing Redux tree without losing descendants or unrelated fields.
- Network reload preserves canonical assignment.
