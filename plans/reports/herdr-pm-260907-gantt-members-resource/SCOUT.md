# Scout — unified members, Gantt hierarchy, and resource matrix

**Date:** 2026-09-07 (Asia/Bangkok)  
**Scope:** source/configuration inspection only; no product changes, tests, DB access, network, or deployment.  
**Result:** implementation is feasible, but it crosses a required data migration and two broken integration seams. Production owners are `web/` on Vercel and the Rust `backend/` on Ubuntu; `frontend/` and the generic backend Compose/CI deployment definitions are not the verified release path.

## 1. Confirmed production ownership

- Live path is browser → `https://prjmngr.vercel.app` (Next.js) → Rust API through Cloudflare → Ubuntu `localhost:8081` → PostgreSQL Docker `localhost:5434`: `docs/deployment.md:5-14`.
- Active frontend GraphQL does **not** use the same-origin Yoga implementation. Apollo sends Firebase Bearer tokens directly to `${NEXT_PUBLIC_BACKEND_URL}/graphql`, defaults to the production Rust origin, and omits cookies: `web/src/lib/apollo-client.ts:10-35`. Therefore production feature owners are `web/src/**`, `backend/src/**`, and `backend/migrations/**`.
- Current deployed backend is the named `task-scheduler-backend` container/release-image pattern, with release directories and a retained prior container/image: `docs/deployment.md:16-33`, `docs/deployment.md:35-52`.
- Vercel's deployable root is `web/`; root `.vercelignore:1-31` deny-lists everything then re-allows only `web/**` while excluding build products and secrets. `web/package.json:5-13` owns build/lint/Jest.
- Do **not** treat `backend/deploy/production.yml` or `backend/.github/workflows/ci-cd.yml` as current production authority without host verification. They describe generic port 8080/5432 Compose and `/opt/task-scheduler`; CI also runs `docker system prune -f` (`backend/.github/workflows/ci-cd.yml:96-111`), conflicting with the verified host's port 8081/release-directory/retained-rollback process.

## 2. Identity and persistence map

### Two project-person tables exist

1. `users` is account/auth identity; email and username are required unique account fields: `backend/migrations/20250319000000_create_initial_schema.sql:15-27`.
2. `project_members` is the project authorization/access join. It requires `user_id`, stores role/join metadata, and is unique by project+user: `backend/migrations/20250319000000_create_initial_schema.sql:63-72`. Project read/write guards explicitly authorize through project ownership plus this table; resource identity is not an auth grant: `backend/src/graphql/resolvers/mod.rs:23-95`.
3. `resource_members` is the correct canonical scheduling/person identity. It has stable `resource_member_id`, required display name, optional email/user link, and one linked user per project: `backend/migrations/20260901000300_create_resource_membership.sql:1-31`. Capacity, overrides, leave, and groups reference this ID: `backend/migrations/20260905000001_create_scheduling_config.sql:4-65`. Tasks gained a nullable resource-member FK specifically to preserve placeholder assignments across later linking: `backend/migrations/20260906000001_plan_lifecycle.sql:1-15`.

**Recommended contract:** make `resource_members.resource_member_id` the sole UI/scheduling/assignment identity. Keep `project_members` as the authorization role/access relation for linked accounts. Do not merge auth roles into placeholder rows and do not fabricate `users` records.

### Current APIs/UI are split

- `resource_members` query/create/link are mounted in the live Rust schema: `backend/src/graphql/schema.rs:10-53`, generated contract `backend/schema.graphql:414-423,709-716`.
- Resource reads and writes use the established project read/write guards: `backend/src/graphql/resolvers/resource_members/mod.rs:101-145,163-199,201-255`.
- The resource create API already accepts display name with optional email and preserves a stable ID: `backend/src/graphql/resolvers/resource_members/mod.rs:150-199`.
- The Members tab renders the canonical resource/scheduling panel first and a separate legacy account-member section after it: `web/src/components/projects/MembersView.tsx:568-625`. The canonical panel supports display-name-only creation and shows linked/placeholder state: `web/src/components/projects/SchedulingConfigPanel.tsx:365-448`; all capacity rows are keyed from that same resource list: `web/src/components/projects/SchedulingConfigPanel.tsx:459-570`.
- Legacy Redux/API reads only `project_members INNER JOIN users`, so placeholders can never appear: `web/src/graphql/queries/member.ts:3-20`, `backend/src/graphql/resolvers/members/query/get_members.rs:9-45`.
- Existing resource migration created the table but did **not** backfill `project_members`, so browser-observed five resource placeholders versus one linked Manager is a real data split, not just duplicated markup: migration above plus `plans/reports/chrome-gantt-members-20260907.md:23-27`.

### Defects to close before UI unification

- UI says link by “user email / id” and passes the text as `user_id`: `web/src/components/projects/SchedulingConfigPanel.tsx:194-211,420-443`. Backend immediately UUID-parses it and performs no email lookup: `backend/src/graphql/resolvers/resource_members/mod.rs:201-212`. Email linking therefore cannot satisfy the requested flow.
- Canonical resource query can filter assignable rows, but the web query does not request `only_assignable`; task assignment validation only checks same project, not `member_kind='MEMBER'`: `web/src/graphql/scheduling.ts:14-26`, `backend/src/graphql/resolvers/tasks/mutation/update.rs:26-51`. Tighten both so COMPANY/GROUP classifications cannot be assigned.
- Legacy single member query/add/update/remove paths shown in `backend/src/graphql/resolvers/members/query/get_members.rs:9-45` and `.../mutation/add_by_email.rs:10-108`, `.../mutation/update.rs:9-66`, `.../mutation/remove.rs:7-42` do not apply the shared project guards. The new unified UI should stop calling these unguarded paths; any retained access-role mutation must be guarded and tested.

## 3. Required data migration

**Migration required: YES (data migration; no new table is presently needed).** UI-only consolidation would hide the linked Manager from canonical members and leave old `tasks.assignee_id` assignments outside the stable resource key.

Add one new forward-only migration; never edit existing migration files (`backend/src/migration_runner.rs:13-18`). In one transaction:

1. Preflight and abort on ambiguous same-project candidates or tasks where both assignment columns point to different people.
2. For every `project_members` row, reuse an existing `resource_members(project_id,user_id)` row. If absent, link exactly one unlinked resource row only when its normalized email uniquely matches that account in that project; otherwise insert a new linked resource row from the account display name/email. Never merge by display name alone.
3. Backfill `tasks.assignee_resource_member_id` from `tasks.assignee_id` only when the resource column is null. Preserve all existing resource IDs, assignments, capacity rows, overrides, leave, groups, commitments, and saved snapshots.
4. Leave `project_members` intact for roles/access. Linking a placeholder must preserve its resource ID and, if project access is part of the accepted link action, atomically create only a missing default/selected `project_members` row; existing roles and position-like metadata must never be overwritten.
5. Record before/after counts and conflict counts, not personal data, in release evidence.

The existing partial unique index on `(project_id,user_id)` provides the needed one-linked-resource invariant (`20260901000300...sql:23-25`). No new mapping table or dependency is justified.

## 4. List assignee: read and write path

### What already exists

- Main task query returns both the linked account object and `assignee_resource_member_id`: `web/src/graphql/queries/tasks.ts:3-46`; transformation retains the resource ID: `web/src/hooks/useProjectTasks.ts:99-129`.
- `TaskListView` already queries canonical resource members and builds distinct `user:*` / `resource:*` options, including placeholders: `web/src/components/tasks/TaskListView.tsx:145-164,260-309`.

### Why production still shows linked users only

- The constructed `assigneeOptions` is not used by the normal inline editor. The rendered select still iterates legacy `assignees`, starts from `task.assignee.userId`, and displays “unassigned” whenever no account object exists: `web/src/components/tasks/TaskListView.tsx:1538-1603`.
- Save still dispatches legacy `updateTaskAssignee({assigneeId})`: `web/src/components/tasks/TaskListView.tsx:1185-1220`. Excel save also resolves only usernames already present on tasks: `web/src/components/tasks/TaskListView.tsx:1047-1073`.
- A newer hook can send both IDs (`web/src/hooks/useTaskFieldMutations.ts:392-428`), but the GraphQL selection omits `assignee_resource_member_id`: `web/src/graphql/mutations/tasks.ts:69-104`, and its formatted response also drops that ID: `web/src/hooks/useTaskFieldMutations.ts:440-467`.
- Mounted Rust `update_task` uses `COALESCE` for both assignment columns: `backend/src/graphql/resolvers/tasks/mutation/update.rs:86-107`. Explicit null cannot clear either field, and setting a resource placeholder cannot reliably clear an old account assignment. Use `MaybeUndefined` semantics (undefined=preserve, null=clear, value=set) or a narrow dedicated assignment mutation; update both columns atomically.

### Minimal implementation

Use `assigneeOptions` for rendering and saving in normal and Excel List modes; select by stable resource ID. For linked members submit resource ID plus linked user ID for compatibility; for placeholders submit resource ID and null user; unassign clears both. Return/query both fields, update local task state, then refetch/reload-test persistence. Backend must validate authenticated project write permission, same project, and `member_kind='MEMBER'`.

## 5. Gantt hierarchy, order, filters, and plan dates

### Current split

- Timeline derives order, then user/project and Gantt filters: `web/src/components/timeline/Timeline.tsx:565-702`.
- A safe hierarchy builder already deduplicates, terminates cycles/deep trees, and emits orphans once: `web/src/utils/ganttRows.ts:1-76`. Timeline builds one row model and applies collapse to it: `web/src/components/timeline/Timeline.tsx:704-812`.
- Despite that, render still places a flat 208px `PriorityTaskList` beside a separate 240px hierarchy column: `web/src/components/timeline/Timeline.tsx:1509-1562`. Browser evidence confirms differing first-row order and collapse only affecting the second column/timeline: `plans/reports/chrome-gantt-members-20260907.md:17-22`.
- `PriorityTaskList` has its own filtered/sorted local array and DnD, recalculates dates locally, then calls Timeline to reorder/recalculate again: `web/src/components/timeline/PriorityTaskList.tsx:122-176,178-226`. Timeline's reorder path only dispatches Redux schedule/order changes (`web/src/components/timeline/Timeline.tsx:1221-1280`); the declared `useReorderTasks` is not invoked. `processTasksAndUpdateStore` only dispatches `updateTaskOrderAndDates`: `web/src/utils/taskScheduler.ts:680-714`. Thus reload persistence of priority ordering is not established.
- Backend already has transactional `reorder_tasks` persistence, but it currently lacks an auth/project-role guard: `backend/src/graphql/resolvers/tasks/mutation/reorder.rs:10-33`.

### Plan-date seam

- Capacity-aware live allocations already provide per-task `start`, `end`, and daily hours; a `barsOverride` can replace them for saved/draft plans: `web/src/components/timeline/Timeline.tsx:968-1012`.
- Saved snapshots persist Start/End/daily hours/assignment/order and render independently of viewport/current config: `web/src/utils/planLifecycle.ts:1-14,28-55,104-155`.
- However `PlanLifecycleBar` creates `usePlanLifecycle` internally (`web/src/components/timeline/PlanLifecycleBar.tsx:32-41`) and never passes `lc.overrideBars` to Timeline. Production calls `<Timeline />` without `barsOverride`: `web/src/components/projects/ProjectDetailView.tsx:356-359`. The hook has the correct override output (`web/src/hooks/usePlanLifecycle.ts:53-61,216-241`), but it is isolated from row/bar rendering. This must be lifted into Timeline (or delivered through a callback/context) before Start/End or the matrix can truthfully claim “currently displayed plan.”

### Recommended Gantt change

1. Delete the separate flat `PriorityTaskList` render; do not create a third row model.
2. Render one left grid from the same collapsed `gridRows` used by bars, with columns **Task | Start | End**. Task indentation/toggle and timeline rows share the same row index and visibility.
3. Derive Start/End from one `displayedAllocations` map: live allocation when lifecycle mode is live; `overrideBars` for draft/saved mode. Do not use deadline fields as a substitute.
4. Lift `usePlanLifecycle` state to Timeline and make `PlanLifecycleBar` a presentation/controller child. Remove or clearly retire the older duplicate plan controls only after mapping their saved data; do not silently delete plans.
5. Preserve filtering before hierarchy construction, but keep a matching task's ancestor chain visible so a child does not become a misleading root. Keep `buildGanttTaskRows` cycle/orphan guarantees.
6. Keep DnD on real task rows only. Reorder by task IDs against the full ordered set (not filtered visible index), persist once through `reorder_tasks`, rollback optimistic state on failure, and refetch. Reparenting is out of scope.

## 6. Resource matrix design

Place it directly below the Gantt. No new backend table is needed; it is a projection of canonical members, displayed plan allocations, and capacity configuration.

- **Rows:** every assignable canonical `resource_members` row, regardless of link state or allocation. The current Timeline `allMembers` derives only task assignees/optional props (`Timeline.tsx:367-405`) and cannot satisfy this.
- **Columns/dates:** exactly the displayed Gantt date range. Cell allocation comes from the same `displayedAllocations[taskId].hoursPerDay` used by bars; saved plan means snapshot bytes, live means current capacity allocation.
- **Accounting:** initialize all member/date cells to zero; deduplicate by task ID; add each task's explicit daily hours once to its stable resource member. Ignore HEADING/PHASE summary rows and never infer hours from parent spans. A parent's own direct effort may count once, but no child hours may be rolled into it and then counted again. This matches the existing direct-effort-once invariant: `web/src/lib/scheduling/build-master-rows.ts:25-40,63-105`.
- **Identity fallback:** resource ID first; for legacy linked tasks map `assignee.userId` through `memberKeyFor`; unresolved assignments go to a clearly labelled non-member diagnostic row, never silently to a real member: `web/src/utils/taskAllocations.ts:86-96`, `web/src/hooks/useProjectSchedulingConfig.ts:125-140`.
- **Capacity/baseline:** show assigned hours against fixed 8h/day baseline and effective configured capacity. Effective capacity is leave (individual/group/project) → 0, then date override, then weekday/weekend defaults: `web/src/utils/capacity.ts:1-15,60-123`. Default is 8h weekday/0h weekend: `capacity.ts:36-45`. Display configured capacity even when zero and visually distinguish holiday/day-off, over-capacity, over-8h, and zero allocation.
- Recurring commitments are already subtracted before task allocation and allocations use an explicit viewport-independent horizon: `web/src/utils/taskAllocations.ts:1-10,86-130`. Matrix should report assigned finite-task hours and capacity separately; do not add commitments again to task hours.

Add one pure aggregation utility plus one component/test file; no chart library or API endpoint is needed.

## 7. Safe work decomposition and dependencies

| Work package | Exclusive owner/files | Depends on | Acceptance gate |
|---|---|---|---|
| A. Identity/data/API | Backend owner: new migration; `backend/src/graphql/resolvers/resource_members/mod.rs`; mounted task update/reorder/type files; backend contract/integration tests | DB backup design and conflict policy | Existing linked/resource IDs unchanged; backfill counts reconcile; email-or-ID link works; assignment null/value semantics, kind/project/auth guards pass |
| B. Members + List | Web owner: `MembersView.tsx`, `SchedulingConfigPanel.tsx`, scheduling/task GraphQL documents, `TaskListView.tsx`, assignment hook/tests | A's GraphQL contract | One member section; linked Manager and placeholders all visible; normal + Excel assignment persists after reload; role/access preserved |
| C. Gantt + matrix | Web scheduling owner: `Timeline.tsx`, `PlanLifecycleBar.tsx`, `usePlanLifecycle.ts`, `ganttRows.ts` only if needed, new pure matrix utility/component/tests | Stable resource key from A; may proceed against existing query shape | One hierarchy; collapse/order/filter/bar rows identical; Start/End match live/saved view; reorder persists; every member/date present; direct hours counted once |
| D. Independent verification/release | Independent reviewer/operator; no feature ownership | A+B+C green | Focused + broad tests, migration rehearsal/backup, review, staged backend then frontend release, production persistence checks, rollback assets retained |

Avoid concurrent edits to `Timeline.tsx` or `TaskListView.tsx`. Package A must land before final B persistence testing. C can develop in parallel after the canonical key contract is frozen.

## 8. Validation and release gates

### Local/isolated checks

- Web focused Jest: hierarchy, plan lifecycle, task allocations/capacity, new resource matrix, Members/List assignment; then `cd web && npm test -- --runInBand`, `npx tsc --noEmit`, and `npm run build`. Build alone is insufficient because `web/next.config.mjs:4-18` disables ESLint and ignores TypeScript errors.
- Backend: `cd backend && cargo fmt --all -- --check`, `cargo clippy -- -D warnings`, focused resource/contract/migration integration tests, then `cargo test --verbose`. Existing relevant suites are `backend/tests/resource_members.rs`, `backend/tests/contract/increment1_graphql.rs`, and `backend/tests/herdr_flow.rs`.
- Rehearse the new migration and rollback-by-restore against a disposable copy. Migration command is explicitly forward-only: `cargo run --bin migrate`; `--baseline` is only for validated pre-existing schemas and must not be used casually: `backend/src/bin/migrate.rs:1-14,30-33,61-82`.

### Production sequence

1. Capture current container/image/release, exact env/network/mount/user/port settings, current Vercel deployment, migration state, and rollback target. Do not print secret values.
2. **Backup gate before any data migration:** create a timestamped compressed `pg_dump` from `task_scheduler_postgres`, verify non-empty + `gzip -t`, and perform/record a disposable restore check. Stop if any check fails.
3. Build tagged backend image with the existing BuildKit secret contract, never a build arg: `DOCKER_BUILDKIT=1 docker build --pull --secret id=database_url,env=DATABASE_URL -t task-scheduler-backend:<release> backend` (`backend/Dockerfile:21-40`). Audit image history/config for leakage without printing the secret.
4. Apply only pending forward migration(s), verify counts/conflicts, then start the tagged backend using the exact captured host settings. Rename/retain the previous container and keep prior image/release/backup.
5. Verify local and public readiness plus GraphQL schema/query sanity. Readiness must be `{"status":"ready","database":"up","migrations":"current"}`: `docs/deployment.md:92-103`; backend deliberately returns non-ready for stale/dirty/missing/ahead histories: `backend/src/api/routes.rs:40-56,90-153`.
6. Vercel dry-run the whitelist upload, then deploy the linked `web` project to production and confirm/repoint `prjmngr.vercel.app`. Keep the previous deployment available for alias rollback.
7. Production checks: one existing linked manager and all placeholders visible in one section; add temporary display-only member; link by existing email; assign linked and placeholder members in List; hard reload; verify DB/API IDs; Gantt hierarchy/collapse/order/filter; live versus saved Start/End; matrix zero-member/holiday/capacity/overage; no parent-summary double count. Clean only scoped test data after evidence.

### Rollback

- Application rollback commands for the retained prior container are documented and narrow: `docs/deployment.md:64-74` (stop/remove current named container, rename retained prior container, start, verify local/public readiness). Resolve exact current container settings first as required by `docs/deployment.md:125-132`.
- Frontend rollback: repoint `prjmngr.vercel.app` to the previous Vercel deployment (`docs/deployment.md:74`).
- Because this release includes a data backfill, binary rollback alone does not undo data. Prefer the migration's compatibility design (old code tolerates additive resource/task values). Restore the verified pre-release DB backup only for a proven data-corruption/incompatibility event, with traffic stopped and explicit operator approval.

## 9. Risks / concerns

1. Production data conflicts were not queried under this read-only/no-network scout. Migration conflict policy must be tested against a sanitized count report before execution.
2. New plan lifecycle currently advertises snapshot rendering but is disconnected from Timeline bars; Start/End and matrix work must not build on the toolbar label alone.
3. List has partially implemented canonical options but still renders/saves through the legacy path; optimistic UI can currently mask failed persistence.
4. Assignment and reorder resolvers touched by this scope lack complete authorization/null/kind semantics. Release is blocked until covered by negative tests.
5. Exact Ubuntu run flags and exact Vercel CLI working directory/link state are runtime facts, not safely inferable from stale generic manifests; capture them before release.

## Unresolved questions

1. When an existing user is linked to a placeholder, should that action also grant default project access, or should link and access-role grant remain two explicit controls? Recommended default: one UI row, but explicit access role; never silently elevate.
2. If an unlinked resource email uniquely matches an existing project account, may the migration auto-link it, or must every such candidate be manually approved? Recommended: auto-link only unique exact normalized matches after a preflight report; abort ambiguities.
3. During filtered Gantt DnD, should drops be restricted to siblings (recommended, no reparenting) or preserve today's unconstrained flat-priority behavior?
4. Should completed/closed task hours appear in a saved-plan matrix if present in that snapshot? Recommended: honor snapshot bytes for saved views; live view follows current scheduler exclusion rules.

**Scout status: DONE_WITH_CONCERNS.**
