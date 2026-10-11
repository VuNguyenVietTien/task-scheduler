# DASHBOARD-READMODEL-FIX — final 18:19 +07

**Status: DONE_WITH_CONCERNS — implementation and owned focused checks complete; independent review pending.** Worktree `C:/Users/TienVNV/Documents/prjmngr/worktrees/dashboard-counts-20260907`, branch `codex/dashboard-descendant-counts-20260907`, base `049a6c5ddf31de2c373ae69c384bb2e0a14089d7`. No backend/SQL/SDL/shared read-model/product-list/Gantt changes; no commit/push/deploy/browser/DB/dependency/config mutation. Owned `web/node_modules` junction and Jest cache removed after checks; target `gm-20260907/web/node_modules` intact.

## Cause and endpoint proof

Active Apollo provider uses `lib/apollo-client.ts` → Rust `/graphql`, not Yoga/Supabase. Rust `tasks` anchors `parent_task_id IS NULL` (`backend/src/graphql/resolvers/tasks/query/tasks.rs:42`) and member filtering anchors roots. `GET_DASHBOARD_TASKS` selected no children, so root→child→grandchild produced 1/0 rather than 3/1.

Frontend-only seam is complete and authorized:

- `GET_PROJECTS` lists all (no pagination/limit) projects where caller is owner or has `project_members.role IS NOT NULL` (`backend/src/graphql/resolvers/project.rs:209-258`).
- `TASK_TREE_ROWS(project_id)` requires authenticated caller plus `require_project_read`; its owner-or-non-null-member predicate is `resolvers/mod.rs:53-64,161+`; it reads all non-deleted rows for that project (`tasks/query/tasks.rs:158+`).
- No global-admin scope assumed; resource-only rows do not establish project access.

## Implemented

- `web/src/graphql/queries/dashboard.ts`: aliases the existing authorized project and flat-row documents; deletes root-only dashboard document.
- `web/src/hooks/use-dashboard-tasks.ts`: query visible projects, then all project flat rows with concurrency 4 (no project-count cap), reject wrong-project rows, distinct by task ID, then member-filter each row's own `assignee.user_id`. It preserves existing active/status/due-date/bug/priority derivations, clears stale user/refresh results, and surfaces any list/tree failure instead of presenting partial/zero counts. Row normalization preserves the dashboard views' `type`/assignee contract.
- `web/src/hooks/__tests__/dashboard-population.test.tsx`: actual hook/doc fixture covers depth 3, duplicate IDs, own-child-assignee filtering, cross-project rejection, empty, error, refresh, stale-user guard.
- `web/src/components/tasks/__tests__/project-task-view-recovery.test.tsx`: all nine retained ProjectDetail fixtures now provide `data.task_tree_rows`; nested count fixtures are flat. Assertions/selection/clone guards unchanged.

## Checks / raw evidence

- Final owned runner: **2 suites, 15/15 PASS** — dashboard 6 + retained ProjectDetail 9. Raw `C:/Users/TienVNV/AppData/Local/Temp/dashboard-readmodel-fix-260907-1809/focused-final-2.log`; runner/config/results same directory.
- Adjacent run: dashboard-member + clone-recovery + owned 2 pass (**20 tests**); unrelated `UserDashboard.test.tsx` cannot load because its historical `TaskStatus` runtime value is undefined. Raw `adjacent.log`; no product/test weakening.
- `git diff --check`: pass.
- Historical integration baseline retained: 197/197 focused + report 2/2, build exit 0; unfiltered TypeScript baseline exit 2 / 304 source diagnostics (382 output lines). This task's earlier `typecheck.log` has no diagnostics in the four owned paths; no broad re-run after final small normalization.

## Manifest

```text
ceaccfe8c9c99d87c883c44ad7c1762a987189cb641eba5a9e8f49aef43d718a web/src/hooks/use-dashboard-tasks.ts
26a31c47bd70814f3c07df84930dc7b93f1f6c7080ab3974db87f65bea48c409 web/src/graphql/queries/dashboard.ts
3f147f81979a84611f83743311cbf6f66148f374220ee2d160a62c565b1d07b3 web/src/hooks/__tests__/dashboard-population.test.tsx
8227ec06bd58e231ef936463fc0a12807daa25b3239f41012c943611064a652c web/src/components/tasks/__tests__/project-task-view-recovery.test.tsx
3dd249abd8953fc01ab03bf207dc1a00866a7d0ae6193a0a82cb1f5fc13d7d29 retained Temp counterexample read-only
```

Package/lock matched owned junction target before use: `0a18c993c550…` / `6d2608aa26e1…`; no install through junction.

## Remaining gates

Independent Astra review; final source-freeze manifest/cleanup; optional full integration/build/type baseline after review. No backend gate required for owner/member-visible dashboard population.

## Unresolved questions

No global-admin dashboard policy is implemented. If it is required, PM must specify/backend-own an authorized aggregate contract.
