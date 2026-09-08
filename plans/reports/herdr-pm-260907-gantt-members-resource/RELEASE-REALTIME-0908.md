# RELEASE-REALTIME-0908

- Role: release implementer
- Task: `RELEASE-REALTIME-0908`
- Date: 2026-09-08 (Asia/Bangkok)
- Status: RELEASE_READY

## Integration

- Source: `a176c59b68705e37ca97441ad1e3e4f5055548db` (`fix(tasks): reconcile authoritative task updates`), reported on `origin/codex/realtime-excel-0908`.
- Dev integration: `2d44757bab6dcd24a7b173723681043dbf4d92e0` via clean cherry-pick onto backend-live `db31fcb9919b5bb8a98abb97992aeb6557bc7ebf`.
- Scope: frontend only; no backend, migration, dependency, lock, or configuration edits.

## Focused tests

Command: Jest `--runInBand` with explicit `jest.config.js` and only:

- `tasks-realtime.test.ts`: pass
- `task-excel-grid-guard.test.tsx`: pass
- `TaskExcelGrid.test.tsx`: pass
- `TaskListView.assignment.test.tsx`: pass
- `task-list-assignment-integration.test.tsx`: pass

Total: 5 suites / 39 tests passed after integration repair `fc5a730`. Dependencies came from a temporary junction to the verified `../release-20260907/web` dependency tree; the junction was removed after each run. Initial failures exposed omitted mutation fields clearing description/effort; the shared normalizer/upsert fix preserves omitted fields and explicit null clears.

## Release

- Dev push: pending
- Main fast-forward: pending
- Vercel production: pending
- Alias verification: pending
- Backend remained live at `db31fcb`; no database action.

## Rollback

After deployment, re-point `prjmngr.vercel.app` to the prior production deployment documented in `docs/deployment.md`, or run `vercel rollback <prior-deployment-url>`. No backend rollback is required for this frontend-only release.

Unresolved questions: none.
