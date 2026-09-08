# Member, ownership, settings, and timesheet permissions

Date: 2026-09-08
Branch: `codex/member-permissions-0908`

## Delivered

- Added one shared backend permission matrix for Manager, Leader, Member, Guest, and project owner.
- Manager and Leader may create/link members. Leader role assignment is limited to Member/Guest.
- Member has read-only Members access. Guest member queries are rejected; nested project members are empty for Guest.
- Sidebar hides Members for Guest. Settings is hidden and direct-view gated for every role except Manager.
- Project rename and catalog mutations now require Manager/owner authorization.
- Removal matrix enforced by canonical and retained member mutations:
  - Manager may self-remove and remove Leader/Member/Guest, but not another Manager.
  - Leader may self-remove and remove Member/Guest only.
  - Owner may remove another Manager.
  - Current owner cannot be removed.
- Added explicit owner-only `transfer_project_ownership(project_id, new_owner_user_id)` mutation. Target must be a linked member with access; old/new owners retain Manager role.
- Added owner-only frontend transfer control with confirmation and surfaced mutation errors.
- Timesheet query/save accept an optional target user:
  - all project access roles read/edit own;
  - Manager/Leader read others;
  - Manager edits others;
  - Leader sees disabled cells/save for others;
  - Member/Guest have no other-member selector;
  - Guest own access still requires active project access.
- Exposed per-project `user_role` in project-list GraphQL for sidebar gating.

## Backend enforcement points

- `backend/src/domain/project_permissions.rs`
- `backend/src/graphql/resolvers/mod.rs`
- `backend/src/graphql/resolvers/resource_members/mod.rs`
- `backend/src/graphql/resolvers/timesheet.rs`
- member query/mutation resolvers and project catalog/project resolvers
- `backend/schema.graphql`

## Tests

Passed:

```text
17/17 focused member/sidebar/permission frontend tests
4/4 focused timesheet helper tests
git diff --check
changed-file TypeScript diagnostics: none
```

Commands:

```bash
npm test -- --config jest.config.js --reporters=default --runInBand \
  src/utils/__tests__/project-permissions.test.ts \
  src/components/ui/navigation/__tests__/sidebar-project-permissions.test.tsx \
  src/components/projects/__tests__/member-query-recovery.test.tsx
npm test -- --config jest.config.js --reporters=default --runInBand --runTestsByPath \
  'src/app/projects/[id]/timesheet/__tests__/timesheet-helpers.test.ts'
```

Backend unit/SDL contract coverage added in `backend/tests/project_permissions.rs`.

Release validation:

- frontend focused suites: 21/21;
- Ubuntu changed-file rustfmt and `cargo check --locked`: passed;
- Ubuntu `project_permissions`: 4/4; `contract`: 33/33;
- backend image `task-scheduler-backend:20260908T0712-01f1718` is live with local/public readiness green;
- public GraphQL introspection confirms role-aware member, ownership, settings, and timesheet schema.

## Production impact

Backend deployed from `01f1718cd7d59a54e67a3a1f8c18544c9c0774b3`. No migration or real member removal, owner transfer, or timesheet mutation performed. See `docs/deployment.md` for artifact, backup, and rollback evidence.

## Unresolved questions

None.
