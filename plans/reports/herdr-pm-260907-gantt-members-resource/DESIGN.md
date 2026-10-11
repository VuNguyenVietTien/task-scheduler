# DESIGN — physical member consolidation + complete Gantt/List contract

Task: DESIGN · architect / independent data-integrity review · 2026-09-07 Asia/Bangkok  
Status: **DONE_WITH_CONCERNS**  
Verdict: **Approve the implementation contract below. Not approval to migrate or release.** Reject SCOUT's two-independent-table recommendation. Production promotion requires the explicit rehearsal, compatibility, auth and persistence gates below.

## 1. Authority, scope, evidence limits

Read primary `AGENTS.md`, then primary startup docs in their prescribed order: `docs/README.md`, PDR, standards, architecture, roadmap, deployment; then primary plan, acceptance, decisions, SCOUT and PREFLIGHT. Applied `ak-code-review` spec-compliance and verification checks independently, plus PostgreSQL constraint/lock guidance. No nested delegation. `README.md` absent in both primary and worktree; worktree `.claude/rules/development-rules.md` absent; read the available user-global development rules. No substitute architecture inferred from boilerplate.

Source verification confined to SCOUT-mapped worktree seams. No source/plan/ledger changes, network, DB queries, commands, deploy or subagents. Branch/SHA are supplied context, not freshly Git-verified. Another worker owns Gantt edits; this report does not overwrite them. Tests below are required implementation checks, **not executed here**.

Production owners: `web/` and Rust `backend/`, not `frontend/`, Next.js Yoga, or Supabase services. Verified `web/src/lib/apollo-client.ts:10-35` sends Firebase bearer GraphQL directly to Rust, despite older generic topology descriptions. Deployment authority is primary `docs/deployment.md`; PREFLIGHT supplies later observed host metadata. User now reports Vercel authentication restored with Node `--use-system-ca`; PREFLIGHT's authentication blocker is superseded as status, not independently rechecked here.

## 2. Independent audit of the consequential scout claims

| Severity | Finding / evidence | Required resolution |
|---|---|---|
| Critical | SCOUT §§2–3 propose keeping `project_members` plus physical `resource_members`; conflicts with explicit accepted user decision. | ONE physical `project_members`; retain scheduling API names only as compatibility. |
| Critical | `project_authz` read predicate accepts **any** linked `project_members` row (`backend/src/graphql/resolvers/mod.rs:23-95`). Merely adding nullable members then linking a user would grant access. | Separate scheduling account link from access role in the same row; all membership-based authorization must require non-null access role. |
| Critical | Existing role removals physically delete (`members/mutation/remove.rs:7-42`). After consolidation this could cascade-delete capacity/leave/groups and clear task assignment. | Revoke access, never delete the scheduling identity through legacy member-removal APIs. |
| High | `tasks/mutation/update.rs:21-51,86-107`: no project auth guard, kind not checked, `COALESCE` prevents clear. Additional missed defect: omitted `parent_task_id` becomes NULL and SQL writes it unconditionally. | Transactional assignment normalization plus tri-state assignment AND parent fields. Assignment-only edit must preserve hierarchy. |
| High | `members/query/get_members.rs:9-45` inner-joins users and assumes non-null role. Add/update/remove paths lack shared guards. | Retained account-only results filter access rows; unified UI uses canonical nullable-member result. Secure mounted legacy and bulk entry points, not just UI. |
| High | Link resolver UUID-parses `user_id`; does not resolve email (`resource_members/mod.rs:201-255`). It locks one member, not the project despite its comment; it can overwrite a different existing link. | Dedicated email mutation; shared locked link operation; different-user rebinding rejected; preserve both IDs. |
| High | `Timeline.tsx:1001-1012` merges overrides into LIVE allocations; simply wiring the toolbar would leave live-only tasks in a saved plan. | Saved/draft source REPLACES live source, including task membership, assignment, order and allocation, not just bar geometry. |
| High | `Timeline.tsx:1738-1813` still calculates dates separately and falls back to due date. | Columns, bars and matrix consume one selected-plan allocation source. Remove competing date calculation for these views. |
| High | `PlanLifecycleBar.tsx:32-41` owns an isolated hook; `ProjectDetailView.tsx:356-359` renders plain `<Timeline />`. | One lifecycle instance owned by Timeline; toolbar receives it. |
| High | Snapshot v2 stores IDs/date/hour/order, but not title/parent metadata; `parsePlanSnapshot` validates little and rejects empty plans (`utils/planLifecycle.ts`). Old `PlanTaskDataInput` has dates/effort but no daily hour vector (`backend/schema.graphql:550-567`). | Lossless legacy adapter; no invented historical daily hours; optional metadata on new snapshots, explicit missing-history handling. |
| High | `TaskListView.tsx:260-309` options give linked users no resource ID and resolve user before resource; actual normal/Excel saves remain legacy (`1047-1073,1185-1220,1538-1603`). Hook response and mutation selection drop resource ID. | Both List modes use canonical resource IDs; resource-first resolution and atomic clear; return/store both fields. |
| High | `reorder.rs:10-33` persists but lacks project authorization; UI reorder is Redux-only and double-scheduled in PriorityTaskList/Timeline. | One guarded persistence call per action, sibling-ID ordering, atomic failure rollback. |
| High | `migration_runner.rs:69-95` explicitly marks unknown newer migrations `Ahead`; retained old binary cannot pass readiness after this migration. | Do not advertise container-only rollback against consolidated DB. Prepare same-schema rollback artifact or restore DB with traffic stopped. |
| Medium | `resource_members.rs` tests are PURE; `herdr_flow.rs:1-12,78-95` silently returns when test URL absent and resets its selected DB schema. | A green process without isolated DB execution is not migration evidence. Strict disposable-target guard and observed execution required. |
| Medium | `ganttRows.ts:31-76` deduplicates and terminates cycles but recursively traverses descendants. | Reuse; do not claim arbitrary-depth stack safety. Exercise representative deep trees; avoid separate unbounded recursive filter ancestor traversal. |

Verified useful scout conclusions: preserve resource IDs; existing resource migrations did not backfill access memberships; capacity/leave/group/task FKs target resource identity; split member sections and split Gantt columns really exist; capacity defaults and leave precedence are implemented; no new resource accounting table is needed.

## 3. Canonical physical model — settled

**Alter the existing `project_members` base table in place.** Do not rename a second identity table into a permanent archive, dual-write, maintain materialized member copies, or fabricate users. Preserve every pre-existing column, including any later-added position/metadata columns; no `CREATE TABLE AS` reconstruction from the initial schema.

Two immutable handles on ONE row are intentional compatibility, not two member records:

- `member_id UUID PRIMARY KEY`: existing access/member handle. Every existing `project_members.member_id` remains unchanged.
- `resource_member_id UUID NOT NULL UNIQUE`: stable scheduling handle. Every existing `resource_members.resource_member_id` remains unchanged. New APIs/UI continue to use this handle for assignment/configuration.
- `project_id` unchanged, NOT NULL, references projects. Immutable after creation.
- `user_id UUID NULL`: linked account, not authorization by itself. Unique `(project_id,user_id)` for non-null values; the existing ordinary composite UNIQUE already permits many NULLs.
- `display_name TEXT NOT NULL CHECK (length(btrim(display_name)) > 0)`; display name alone is sufficient. Names need not be unique.
- `email TEXT NULL`: optional contact/link target; blank input normalized to NULL. Store trimmed supplied casing; compare using `lower(btrim(email))`, with no provider-specific dot/plus rewriting.
- `member_kind` retains `MEMBER | COMPANY | GROUP`; only MEMBER is assignable/capacity-bearing. Classification entities remain canonical rows, not additional people/capacity pools.
- `role member_role NULL DEFAULT NULL`: **NULL means no project-access grant**. Preserve every existing role value exactly, including legacy enum values; never rewrite old admin/manager/etc to an approximate equivalent.
- `CHECK (role IS NULL OR (user_id IS NOT NULL AND member_kind = 'MEMBER'))`.
- Keep `joined_at`, `invited_by` and all existing metadata. Preserve resource `linked_at`, `created_at`, `updated_at` when a resource row already exists. Newly synthesized resource metadata uses a documented migration timestamp; access join metadata is not overwritten by resource timestamps.
- Replace old account FK `ON DELETE CASCADE`: account deletion must not destroy canonical resource/config rows. Use `ON DELETE SET NULL` plus an account-unlink trigger that atomically clears role/link timestamp and legacy task account mirrors, preserving resource identity. Project deletion keeps its existing explicit project cascade semantics.
- `UNIQUE(project_id, resource_member_id)` supports same-project composite task references. Keep project/resource FK indexes; do not add redundant copies of equivalent existing indexes.
- Partial normalized email uniqueness **for MEMBER rows within each project**: unique `(project_id, lower(btrim(email))) WHERE email IS NOT NULL AND member_kind = 'MEMBER'`. Existing duplicates are a preflight conflict, not silently deleted or renamed. Same name/no email allowed; same email in different projects allowed. COMPANY/GROUP contact emails do not establish person identity.

`resource_members` becomes a simple SQL VIEW over `project_members`, selecting exactly its previous scheduling columns. PostgreSQL relation-kind assertion must prove `project_members` is a base table and `resource_members` is a view (not materialized). Its reads have no separate storage. Updated resolvers write canonical base rows; revoke view DML from normal application roles rather than promising old independent writes. A privileged DB role can bypass grants; this view is not an authorization boundary.

All former resource FKs retarget to `project_members(resource_member_id)` without changing stored IDs: both endpoints of `resource_member_classifications`, `resource_group_members`, `member_capacity_settings`, `member_capacity_overrides`, `member_days_off`, `tasks.assignee_resource_member_id`. Keep group IDs, group members, leave IDs, override keys, commitment IDs/rules and dates byte-for-byte. Recurring commitments still reference groups/projects, not a new member table.

Enforce cross-project rules at DB boundary as well as GraphQL: tasks reference `(project_id,assignee_resource_member_id)`; group membership must match its group's project; individual leave matches member project; group leave/commitment matches group project; classifications same-project, concrete MEMBER target and COMPANY/GROUP classifier. Use small constraint triggers for relations without a project column rather than adding redundant columns everywhere. Reject member-kind/project changes that invalidate existing edges. Resource assignment deletion must clear only assignment columns, never `tasks.project_id` (prefer restricting hard member deletion in this release).

## 4. Migration algorithm and fail-closed proof

New immutable forward migration: proposed `backend/migrations/20260907000001_consolidate_project_members.sql` (use next unused later version if already taken). Existing migrations stay byte-identical. Custom runner remains authoritative; no stock ordering, baseline, or manual history patch. Its new schema fingerprint must assert canonical columns, required constraints and base-table/view kinds; a view named like an old table is not enough evidence. Do not execute down scripts as part of the forward chain; document restore rollback separately in the release evidence.

### Preflight/rehearsal inputs

Capture sanitized counts and secured reconciliation manifests on a disposable restored backup, then repeat conflict checks under the final write fence. Inventory FK/view/trigger dependencies through PostgreSQL catalogs **only for these mapped tables**. If an unexpected dependency or access metadata column appears, stop for scoped review; never `DROP ... CASCADE` to force progress. Include soft-deleted tasks in preservation checks.

Stop on: orphan references, duplicate linked users, normalized MEMBER-email duplicates, ambiguous normalized `users.email` matches, conflicting user/resource assignments, cross-project references, non-MEMBER assignees/capacities, empty display names that cannot be derived, incompatible existing link/email candidates, unknown migration history, or unexpected dependencies. Do not choose a winner by insertion order, name similarity, `LIMIT 1`, or `ON CONFLICT DO NOTHING`.

### Transactional sequence

1. Stop all backend writers/background mutation paths; maintenance/read-only window. Acquire migration runner lock, bounded `lock_timeout`, and transaction/table locks covering projects/users/member tables, tasks and listed dependent configuration tables. Use one transaction for schema/data/FK/view changes. Acquire operational project locks in deterministic UUID order; link/access/assignment/reorder code shares the project locking convention.
2. Build temporary mapping in-transaction; export counts/ID mappings to the secured release artifact, not app tables. Resolve every old access row P and resource row R:
   - Exact same `(project_id,user_id)` wins. Pair only one-to-one; preserve P.member_id and R.resource_member_id.
   - With no exact R, an existing access account may pair with exactly one unlinked MEMBER R in that project whose normalized email matches exactly one account and exactly that P's user. This transfers **existing** authorization for that same user, not a new grant. Any competing email/link candidate aborts. Never match display name.
   - Otherwise P becomes its own canonical row. Prefer `resource_member_id = P.member_id` only if not occupied/reserved by any source resource ID or another mapping; otherwise generate one UUID and retain the mapping in the final row/secured manifest.
   - Unpaired R becomes a canonical row, preserving its resource ID and data. Prefer `member_id = R.resource_member_id` when free among all reserved old member IDs; otherwise generate a distinct member UUID. Its role is NULL even if R.user_id is linked: there was no previous access grant to preserve.
   - On a paired row, keep R.display_name/contact/config identity; P's role/join/inviter/other access metadata win for access fields. Do not silently replace contact or account identity on mismatch; contradictory identity candidates abort.
3. Ensure each project owner and each legacy task-assigned account has a same-project MEMBER identity if absent. Synthesize only from real `users` rows, with NULL role for accounts lacking an existing grant; owner access remains the `projects.owner_id` predicate. Display name fallback: trimmed full_name, name, username, then account email. No fabricated account, no manager role invention. Record owner/legacy-assignee additions separately from ordinary merged counts. New-project creation must likewise make the owner's canonical scheduling row atomically; retain owner authorization independent of role.
4. Backfill every task with resource NULL/user non-null through the unique same-project mapping. If both are populated, require the selected resource's linked user to equal the legacy account; otherwise abort (including placeholder + unrelated legacy account). Resource-only linked tasks can populate the legacy user mirror; unlinked tasks keep mirror NULL; unassigned tasks keep both NULL. Do not reassign resource IDs, copy effort or alter hierarchy/date/status fields.
5. Populate/validate canonical columns; retarget FKs and apply constraints/triggers. Delete the old physical resource table only after every dependent edge is retargeted, using restrictive DROP with no CASCADE. Create compatibility view. No second permanent member table survives commit.
6. Validate complete bijection of old resource IDs to final resource IDs and old access IDs to final member IDs; exact role/join/inviter/metadata preservation; exactly one final linked user per project; all task pairs consistent. Reconcile `final rows = old P + old R - paired rows + owner/legacy-only additions` (no dropped source rows).
7. Hash/compare all capacity/override/leave/classification/group/commitment records and saved `plans.plan_data`/revision/parent/fingerprint fields against pre-migration values. **Do not rewrite saved JSON**, even to backfill assignment IDs. Fingerprints may correctly mark plans stale after membership changes; stored fingerprints remain historical.
8. Commit only if every check passes; otherwise transaction rollback restores both prior tables and all prior data/history state. Record counts, migration version, checksum and artifact identities, not names/emails/secrets.

UUID collisions across old ID namespaces are handled by keeping two columns on the one final row. No mass rekey of scheduling references or snapshot JSON is necessary. Existing resource IDs never change, including later email linking.

## 5. Authorization and exact compatible API contracts

Keep existing names/types for compatibility; do not repurpose `project_members` GraphQL's non-null `user/role` result to emit placeholders. It remains an **access-members-only projection** and gains read authorization. Canonical UI list remains `resource_members`, now reading the one physical base table.

Required additive SDL (existing fields preserved):

```graphql
# Existing operations/signatures stay.
resource_members(project_id: ID!, only_assignable: Boolean): [ResourceMemberType!]!
resource_member(resource_member_id: ID!): ResourceMemberType!
create_resource_member(input: CreateResourceMemberInput!): ResourceMemberType!
link_resource_member_user(resource_member_id: ID!, user_id: ID!): ResourceMemberType!

# New email operation; do NOT accept an email in an ID argument.
link_resource_member_by_email(resource_member_id: ID!, email: String!): ResourceMemberType!
# Explicit access action; required nullable argument: null revokes access.
set_project_member_access(resource_member_id: ID!, role: String): ResourceMemberType!

# Add to ResourceMemberType; old selected fields retain their nullability.
member_id: ID!
access_role: String
joined_at: DateTime
invited_by: ID
```

For `set_project_member_access`, resolver must use tri-state input: omitted `role` is BAD_USER_INPUT; explicit null revokes, non-null is validated against the actual existing allowed project-role values/policy. SDL nullable argument permits the clear; application rejects omission. String output/input preserves any existing legacy role label without changing GraphQL enums used by old clients. Do not expose an unchecked arbitrary SQL enum cast as validation. If existing position metadata has a working mutation, retain its behavior/control within the same row and its current contract; absence of a new API is not permission to drop it.

Rules for every link/create/access mutation:

- Authenticate caller, derive project from target row, require current project owner/authorized manager action. Resource scheduling writes retain existing owner/manager/leader/admin predicate; role grant/change/revoke must additionally preserve existing restrictions on administering privileged peers/owner. Do not broaden role-management rights merely because scheduling writes permit leaders.
- Execute permission check and mutation in the same transaction; lock project, then affected member/user/task rows in a consistent order. Current guard using a separate pool read is not sufficient for check-to-write concurrency. Revocation cannot race through a stale permission check.
- Create display-only row: trim non-empty name, validate optional email using existing domain validation; NULL user, NULL role. Creating with an email does **not** link or grant access automatically.
- Email link: normalized lookup restricted to an authenticated authorized manager action; exactly one existing account required. Unknown account = NOT_FOUND; invalid email = BAD_USER_INPUT; multiple normalized account matches = CONFLICT. No account creation and no untrusted client assertion of user identity. Do not log queried email.
- Link only MEMBER. Same row/same user is idempotent with original linked timestamp retained. Row linked to a different user = CONFLICT, not silent reassignment. Target already linked on another row in the same project = CONFLICT; preserve both rows/configs and require separately reviewed consolidation rather than auto-merging them. Same account in another project is allowed, without importing its membership or role.
- Explicitly entered link target may update that row's contact email to the matched account email after UI confirmation; normalized duplicate contact remains a conflict. Display name/IDs/configs unchanged. Existing access role, if any, unchanged. Otherwise remains NULL. Mirror user IDs on currently assigned tasks atomically; saved JSON untouched.
- Explicit access grant requires linked MEMBER. NULL-user/company/group grant rejected. Existing elevated role never overwritten by link/create/group import. Group-based access action only fills NULL roles after explicit authorized role choice; preserves existing non-null roles.
- Legacy add-by-email/add-by-user uses the same canonical lookup/merge and explicit role service. It reuses a linked/no-access row rather than inserting a duplicate person. Legacy update/bulk update routes through access service. Legacy remove/bulk remove sets role NULL; does not unlink/delete the member or task/config records. Owner removal/last required manager restrictions retained.
- All direct project reads/listings/counts, nested member outputs, scheduling/timesheet guards and mounted ProjectMember/Member APIs must distinguish access from linked resource presence. Read access = owner OR linked canonical row with **role IS NOT NULL**; write = existing allowed role predicate. `member_count` retains access-member meaning where previously an auth count; canonical resource list size is separate UI information. Do not globally redefine permissions through UI filtering.
- Errors carry stable `extensions.code`: UNAUTHENTICATED, FORBIDDEN, BAD_USER_INPUT, NOT_FOUND, CONFLICT. Unauthorized failures must not reveal foreign member/account details.

## 6. Assignment contract — normal, Excel and legacy callers

Keep `update_task(input: UpdateTaskInput!): Task!`; same SDL nullable ID fields. Implement Rust `MaybeUndefined<ID>` for **both assignment fields and parent_task_id**. Perform fetch/row lock, authorization, candidate validation and UPDATE in one transaction. Return `assignee_resource_member_id` plus linked `assignee` object; add selected field to update/create/reorder response documents wherever client state is replaced.

| Submitted assignment fields | Result |
|---|---|
| Both omitted | Preserve both columns exactly. |
| Resource = R; user omitted | Validate same project/MEMBER; store R and derive R.user_id (possibly NULL). |
| Resource = R; user = matching U | Store R/U. Different U rejected. |
| Resource = R; user = NULL | Allowed only when R is unlinked; linked R + explicit NULL is contradictory and rejected. New UI normally sends resource only. |
| Resource omitted; user = U | Legacy set: resolve unique same-project MEMBER for U, store its resource ID/U. Unknown/outside-project account rejected; do not grant membership through assignment. |
| Either explicitly NULL, other omitted; or both NULL | Explicit unassign: clear both. |
| Resource = NULL; user = U | Support old hook's explicit-resource-null payload as legacy user assignment; resolve canonical R and store R/U. |

For unrelated updates, omitted parent preserves it; explicit NULL (and legacy empty-string sentinel, if retained) clears parent; a value uses existing same-project/cycle guard. Assignment edit must never alter parent, phase/category, effort, priority order, start/deadline or saved plans.

Put shared identity/assignment normalization at the canonical domain boundary, reused by retained task create/clone/update entry points. Database constraint triggers reject inconsistent/cross-project/non-MEMBER pairs even if a future writer bypasses GraphQL. Existing resource-only rows with linked account must be normalized consistently; account deletion/unlink updates mirrors atomically. Project-owner canonical creation is an explicit project-creation responsibility, not a side effect granting arbitrary assignees access.

List implementation:

- `TaskListView.tsx`: one option per assignable canonical row, value `resource:<resource_member_id>` for linked **and** unlinked; blank = unassign. Resolve current task by resource first, legacy user fallback only if resource absent. Display canonical name and unlinked badge; duplicate names disambiguated by email or short stable ID, never merged.
- Normal editor and Excel staged handler call the same assignment adapter/hook. Excel supports canonical selection; typed/pasted names allowed only for exactly one matching member. Ambiguous/unknown text remains staged with an error; never pick first matching username. Blank explicitly clears both fields. A member need not appear on any existing task to be selectable.
- Reuse existing `useUpdateTaskAssignee`; remove its dropped-ID response/event behavior. Treat any GraphQL error/no mutation result as failed, not success with empty assignee. Return both fields, update local/Redux/Apollo task state, invalidate/refetch tasks and member mapping as required. Failed normal save restores both previous fields; failed Excel row remains staged. Do not claim batch atomicity where per-row saves exist.
- Fetch by actual project prop/context, not only first task: empty projects must still load members. `RESOURCE_MEMBERS_QUERY` gains optional `$only_assignable: Boolean`; List/matrix pass true, classification-aware screens may omit it.

## 7. One Gantt hierarchy and connected lifecycle

### Row/order boundary

Timeline owns one selected-plan task collection, one ordered hierarchy and one collapsed `gridRows`. The left **Task | Start | End** grid, bar grid and vertical positions use identical keys/order/count/rowHeight (currently 48px). Delete the separate `PriorityTaskList` render; reuse installed DnD sensors/keyboard support, not a second local list/scheduler.

Normalize projection WBS/fallback/master modes through the same row/filter/collapse contract. SOURCE_HEADING/PHASE remain non-draggable presentation rows, never assignment/effort rows. Parent-child relationship is authoritative; phase grouping must not accidentally flatten/reparent children. A projection response must not bypass Gantt filters as the current non-fallback branch does. Keep existing modes accessible, but their labels/bars still share one row list.

Filtering keeps matching task IDs plus ancestor context, without treating context-only ancestors as extra selected tasks. Collapse is presentation-only. Never allocate from collapsed or filtered rows: selected-plan totals include hidden tasks; label matrix **All tasks in selected plan — task filters/collapse do not change totals**. New Plan preserves existing filter-aware selection semantics: use actual matching task IDs before collapse (not context-only ancestors), plus non-accounting ancestor metadata. Recalculate uses saved IDs/order, not the current filter.

DnD is sibling-only; root reorder moves each subtree as a block; no reparenting. Filtered reorder replaces only matched sibling slots in the complete sibling list; hidden siblings retain relative order. Context-only ancestors, headings, foreign-parent targets and missing IDs cannot be dropped. Manual reorder disables auto-sort. Auto-sort preserves existing priority rank CRITICAL→URGENT→HIGH→MEDIUM→LOW and done/closed-last behavior **within each sibling set**, stable tie by persisted order then task ID; don't discard completed tasks from persisted ordering.

Persist live order once via existing `reorder_tasks(input: {project_id,tasks:[{task_id,priority_order}]}) -> [Task!]!`, with complete intended order, unique IDs/ranks and all-or-nothing validation. Add optional `expected_order` task-ID list to ReorderTasksInput for new clients; compare against full current ordered IDs under project lock, CONFLICT on concurrent additions/reorders. Old clients omit it and retain serialized last-writer behavior. Validate not-deleted/same project/full intended set before any update; no partial acceptance. On network/conflict failure restore optimistic order and refetch. Do not persist computed plan dates into task deadlines.

Saved snapshot is immutable by viewing or dragging. Enable live DnD; draft DnD updates only local draft order/allocations and becomes saved only through Save. Saved DnD/auto-sort requires explicit Recalculate-to-draft first; provide that action rather than silently mutating live tasks or the saved revision. User-visible manual ordering capability remains, with clear lifecycle scope.

### Single plan source

Move `usePlanLifecycle` into Timeline; make PlanLifecycleBar accept `lc` plus commitment warnings. `displayedPlan` derives atomically from mode:

- LIVE: full current task records with canonical resource assignment, current hierarchy/order, capacity allocation.
- DRAFT: draft snapshot task membership/assignment/order plus draft allocations. Current config edits do not silently rebuild a draft; explicit recalculate/new-plan does.
- SAVED: loaded snapshot IDs/assignments/order/Start/End/hour vectors only. **No merge with live allocations, no live-only rows, no current reassignment fallback when snapshot explicitly unassigned.** Completed/deleted-current tasks present in snapshot stay visible and counted.

Hydrate current task metadata by ID when available, without replacing selected allocation/assignment/order. New snapshots add optional `title`, `parentTaskId`, `taskKind/status` and unassigned/unscheduled metadata, preserving v2 compatibility through optional fields. Save ancestor context separately from scheduled task membership. Old snapshots lacking hierarchy/title use available current metadata labelled as current metadata; missing tasks render `Historical task <short-id>`, unknown ancestry as root with an explicit history warning. Missing metadata never drops scheduled work or triggers a live schedule.

Strict snapshot parsing: validate supported shape/version, unique task IDs, valid ordered calendar dates, finite nonnegative daily hours, day keys within recorded span, integer ordering, optional IDs and unscheduled marker. Reject conflicting duplicate IDs/corrupt data; do not silently “first wins” financial/resource accounting. Empty task snapshots are valid empty plans, not parser errors. Exhausted/partially scheduled tasks retain allocated hours plus warning; empty hours does not imply fully scheduled.

Legacy plan controls: one selector can list old/new plan records, deduplicated by plan ID; do not delete old plans or hide them because v2 parsing fails. Adapt old `{tasks:[task_id/priority_order/start_date/end_date/assignee_id...]}` and existing client camelCase forms into a read model. Preserve stored dates/order/assignment; **old snapshots without hoursPerDay cannot truthfully provide historical daily hours**. Show zero for known unallocated current members, but mark affected historical member/date totals **unknown/incomplete**, not fabricated zeros. Offer explicit Recalculate → new v2 revision to obtain real daily allocations; never auto-distribute old effort by today's capacity. This is an unavoidable information limit, not a deferred implementation feature.

Keep existing explicit delete/set-active workflows if retained, clearly distinct from merely selecting a local view; no duplicate Save pipelines using due_date fallback. Reset lifecycle state on project switch; clear selector to Live correctly even if last loadedPlan retained for reference. Use request sequencing/project-ID checks so an older slow load cannot replace a newer selection or another project's plan. Failed load/save preserves last valid view with error; SAME_REVISION remains explicit, NEW_REVISION default. Refetch staleness/config changes without rewriting snapshots.

### Date source and resource accounting

Columns and bar spans read the same allocation object. No deadline substitution or separate `calculateTaskSchedule` call at render. Unscheduled dates display `— / Unscheduled`; intentional dated zero-effort milestones can show a point if the snapshot explicitly identifies one. Calendar dates are `YYYY-MM-DD` values: parse/format in the existing project-local calendar, reuse local `fmt`/date-key helpers, not `toISOString().slice(0,10)` on local midnight (Bangkok shifts to prior UTC day). Display viewport changes only clipping; planning horizon is explicit/frozen per calculation, not extended by scrolling without an explicit recalculation.

## 8. Daily member matrix — exact invariants

One pure aggregation utility plus a presentational matrix component; no new endpoint, chart library or persistent totals table. Timeline passes selected allocations **and selected assignment metadata**, canonical members, the same day keys/day widths, and current capacity/reservation resolvers.

1. Initialize every assignable canonical member × displayed date with 0 task hours, including unlinked and no-task members. Include an explicit unassigned/historical-unresolved diagnostic row when needed, not a made-up project member; preserved non-MEMBER classifications remain available in member management, never capacity rows.
2. Consume each selected real task ID once. `assigned[m,d] = sum(task.hoursPerDay[d])` over tasks whose selected assignment resolves to m. Explicit resource ID wins. Legacy user-only assignment may resolve via same-project canonical user mapping; invalid resource ID does **not** silently fall back to another person. Snapshot NULL assignment stays unassigned even if live task was later assigned.
3. Parent's own direct effort counts once if present. Do not skip all parents and lose their own work. Do not count derived child rollups, HEADING/PHASE summaries, bar spans, task deadline lengths or recurring meetings as finite-task effort. Allocation input itself must deduplicate IDs before scheduling, not merely after scheduling consumed capacity twice.
4. For visible day d, conservation: sum(all member cells + unassigned/unresolved cells) equals sum(selected tasks' explicit day hours). Full-plan totals use all days, separate from clipped viewport totals. Collapse/filter changes neither; legacy missing vectors make totals explicitly incomplete.
5. Show separately: fixed baseline **8h**, effective configured **C**, recurring reserved **R**, task budget **B = max(0,C−R)** and finite-task assigned **A**. Under/full/over-task-budget compares A with B; badge over-baseline when A>8; total load warning compares A+R with C. C=0/A=0 is day off, not “100% utilized”; C=0/A>0 is overload, no divide-by-zero. Meetings already reserve capacity in scheduler; never add R to A again.
6. C follows implemented precedence: any applicable individual/group/project leave → 0; else date override; else weekday/weekend defaults 8/0. Configured zero is a real zero, not fallback. Show reasons and textual values, not color alone. Overlapping commitments follow existing recurrence reservation contract; expose truncation warning rather than imply complete coverage.
7. Saved A and assignments remain snapshot-frozen; current C/R comparison is explicitly labelled **current capacity/commitments**, with staleness indicator. Existing snapshots do not contain historical capacity calendars; do not claim they do. New config changes can change comparison colors, never saved dates/hours.
8. Shared horizontal scroller is preferred for bars/header/matrix; otherwise deterministic synchronized scrollLeft and identical timeline-origin width, day boundaries and zoom. One page vertical scroll, no independent matrix date scale. Each cell has accessible member/date/assigned/capacity text; zero shown explicitly. Member/config loading/error states must not masquerade as a successfully loaded default 8h schedule. Defaults apply only to confirmed absent config rows, not failed queries.

## 9. Concrete ownership and implementation sequence

Owners are exclusive work packages, not authorization to spawn workers from this advisory task.

| Package | Owned files/seams | Steps / gate |
|---|---|---|
| Backend identity owner | New migration above; `backend/src/migration_runner.rs`; `backend/src/graphql/resolvers/resource_members/mod.rs`; one small shared `backend/src/domain/project_member_identity.rs` plus module registration | Mapping/preflight, canonical constraints/view, transaction helpers, email link, access and safe revoke. Rehearsal + auth equality before UI unification. |
| Backend auth/assignment owner (same writer) | `backend/src/graphql/resolvers/mod.rs`; mapped `members/query/get_members.rs`, `members/mutation/{add_by_email,update,remove}.rs`; mounted Member/ProjectMember/project/scheduling entry points identified by `backend/src/graphql/schema.rs`; task `mutation/{update,reorder}.rs`, mounted create/clone callers and Rust task input types; `backend/schema.graphql` | Canonical auth predicates, no-delete access revoke, tri-state assignment/parent, reorder auth/concurrency, project-owner canonical creation. Regenerate SDL and exercise actual mounted schema. No parallel writer inside these shared API seams. |
| Members/List owner, after API freeze | `web/src/components/projects/{MembersView,SchedulingConfigPanel}.tsx`; `web/src/components/tasks/TaskListView.tsx`; `web/src/graphql/scheduling.ts`, `graphql/mutations/tasks.ts`, `graphql/queries/tasks.ts`; `hooks/useTaskFieldMutations.ts`, `hooks/useProjectTasks.ts` | One member list/add section; keep role/position controls on those same rows; preserve all capacity/leave/group/commitment forms. Canonical options both List modes, response/cache propagation, reload persistence. Existing legacy member documents/slice only adapted where these retained controls still call them. |
| Gantt owner (already separate worker) | `web/src/components/timeline/{Timeline,PlanLifecycleBar,PriorityTaskList}.tsx`; `web/src/hooks/usePlanLifecycle.ts`; `web/src/utils/{ganttRows,planLifecycle,taskAllocations}.ts`; `web/src/hooks/useProjectSchedulingConfig.ts`; new `utils/memberDailyAllocations.ts` + `components/timeline/MemberDailyMatrix.tsx` | One row/order/lifecycle source, no live merge, exact dates, sibling persistent ordering, complete matrix. Reuse `capacity.ts`/master direct-effort rules. Remove PriorityTaskList usage here, not unrelated uses. |
| Test/review owner | Existing `backend/tests/{resource_members,herdr_flow}.rs`, contract tests; one focused migration integration test; nearby web hierarchy/lifecycle/assignment/matrix tests | Prove actual PostgreSQL/mounted GraphQL writes, pure conservation and browser persistence. Review independently after implementation, no production changes in test role. |

Mounted auth/create/bulk implementations beyond the cited bodies were not rescanned here. They are mandatory compatibility consumers because `schema.rs` mounts them and SDL exposes them, not optional cleanup. Implementer must perform a **bounded referencer check for project_members/resource_members and shared assignment/access functions in these mounted modules** before editing; discover concrete helper/type filenames there rather than treating this report as proof that every direct SQL consumer already uses a guard. If that check reveals an unrelated service writer, stop and report; do not broaden into a repo-wide rescout.

Minimal genuine boundaries: one transactional identity/access helper, existing task update/reorder endpoints, one lifecycle owner, one pure aggregation function/component. No duplicate backend frontend in Yoga, no generic identity framework, no task/member copies, no resource totals storage.

## 10. Focused verification matrix — positive and negative

| Check | Required proof |
|---|---|
| Physical migration happy path | Fresh runner bootstrap and upgrade restored old schema; P-only, R-only placeholder, R-only linked, exact P/R match, unique approved-rule email match, owner-only, legacy task-only user. Exact old P/R ID handles and source data preserved; resource relation is view only. |
| Migration conflict/atomicity | Two normalized user emails, duplicate project emails, conflicting links, resource/user mismatch, cross-project task/group/leave/classification, UUID namespace collision, unexpected FK. Conflicts fail before commit; failure injected after FK changes restores old schema/data. Collision case succeeds through dual-handle mapping, not data loss. |
| Migration resource/snapshot preservation | Compare keyed records/hashes for capacities (including zero), working-weekend overrides, all leave scopes, groups/classifiers, commitments, tasks and plan JSON/revision chains. No snapshot JSON rewrite; count equation holds. |
| Access equality and linking | Snapshot owner/read/write predicates before/after for every existing authorized user/role; unchanged. New display-only and linked-no-access rows grant neither read nor write. Link same user idempotent; link other user, duplicate link, stranger/guest write, user email ambiguity fail unchanged. Cross-project same account legal without role transfer. |
| Legacy endpoints | Execute mounted add/update/remove/bulk/group APIs; all enforce auth, reuse canonical row, preserve roles on link, revoke without deleting identity/config/tasks. An old account-only query returns no NULL user/role object. |
| Assignment matrix | Every row of §6 via GraphQL plus persisted SQL reload. Linked→placeholder clears stale user; placeholder→linked; legacy user-only; blank clear; omit preserve; mismatched IDs/project/kind fail. Assignment-only update leaves parent/phase/category/dates untouched. Direct SQL invalid pairs rejected. |
| Concurrent operations | Two links to same project/user: exactly one succeeds; loser unchanged. Access revoke versus assignment/link serialized. Duplicate membership create fails cleanly. Concurrent reorder expected_order mismatch returns conflict, no partial order. |
| One hierarchy | Equal left/bar task keys, row positions/heights under expand/collapse, filtered child with ancestor context, orphan/cycle/duplicate input and representative deep chain, projection present/absent, phase mode. Heading never draggable/accounted. |
| Persistence/order | Root subtree and sibling reorder; keyboard DnD; filtered hidden siblings unchanged; forbidden cross-parent drop; auto-sort stable. One backend call/action; forced API failure rolls back; hard reload preserves priority. Include priority_order in reload query (currently absent from inspected task query). |
| Lifecycle | Live→New→Draft→Save→saved r1; Recalculate→unsaved draft→r2 or explicit same revision; cancel/failed save leaves original. Saved subset excludes live-only tasks; snapshot assignment wins after current reassignment; deleted/done task remains; empty plan and missing historical metadata supported. Older async load cannot overwrite newer/project-switched selection. |
| Dates and hours | Selected Start/End identical to bars; deliberately different deadline ignored. Zero-capacity/partial exhaustion explicit. Bangkok local midnight and date-boundary test; no UTC previous-day shift; scrolling/zoom does not recompute snapshot/live frozen horizon. |
| Matrix arithmetic | P direct 2h + child 6h + phase rollup 8h yields 8h, not 16h or 6h. Duplicate task occurrence cannot consume capacity twice. Linked/unlinked/zero-member rows included. 0h day off, custom 4h/10h, working Saturday, leave-over-override, fractional 0.25h and offscreen hours. C=8,R=2,A=6 → full task budget, task total 6 not 8; A=7 → over-task-budget but under 8h baseline. |
| Legacy snapshots | Dates/order/user assignment preserved, missing hour vectors visibly unknown/incomplete; no invented allocations. Explicit recalc saves new v2 record and leaves old payload unchanged. |
| Members/List browser | One add-member section; create with display name only; same row shows link state/access separately; all legacy managers/placeholders/configs present. Assign previously unused unlinked member in normal and Excel, clear, link, hard reload, inspect persisted IDs. Duplicate names require disambiguation; failed saves remain visible/staged. |

Narrow first: existing resource identity tests + new migration/mounted GraphQL integration, then web hierarchy/lifecycle/capacity/allocation/assignment/matrix tests. Broaden: `cargo fmt --all -- --check`, `cargo clippy -- -D warnings`, relevant integration and full `cargo test --verbose`; `cd web` → `npm test -- --runInBand`, `npx tsc --noEmit`, lint, `npm run build`. Build's ignored type/lint settings cannot satisfy those independent gates. Known unrelated fixture failures must be recorded, not hidden. `TEST_DATABASE_URL` must be positively identified as disposable before any test that drops schema; an unset/skipped test is NOT a pass.

## 11. Backup, rehearsal, rollout and rollback compatibility

Later release operator only; no execution authorized by this report.

1. Capture immutable backend/frontend artifacts, exact current container env key names/network/user/mount/port metadata, SQLx history and Vercel rollback deployment. Reconcile PREFLIGHT's actually observed retained image (`20260901T1235`) with older doc text rather than hard-code the wrong target. User-reported Vercel auth restored; recheck securely at release time without token logging/TLS bypass.
2. Before any schema/data change create timestamped compressed pg_dump from the established `task_scheduler_postgres`; verify nonempty, gzip integrity and a full disposable restore. Backup includes migration history and schemas, not just member CSV. Secure checksums/manifests and restrict personal data access.
3. Rehearse migration + application + rollback on restored copy. Test both old access IDs and old resource IDs; old frontend documents must work against **new compatible backend**. Verify catalog relation kinds and invariant counts/hashes. No live data conflict assumed absent from source inspection.
4. Build reviewed backend using existing BuildKit secret contract, not build args; retained releases/images stay. Establish write fence **before final backup/conflict checks and migration**, not merely before container swap. Runner explicitly applies pending migration, `RUN_MIGRATIONS=false` during ordinary startup. Do not serve old backend against changed schema while waiting for frontend release.
5. Start new-schema-compatible backend, verify local/public `ready/up/current`, mounted GraphQL, auth-negative probes and persisted member/task checks before enabling writes. Then deploy reviewed `web/` artifact and verify `prjmngr.vercel.app`; browser checks use bounded authorized test project/data. Preserve previous Vercel deployment.
6. **Container-only rollback to the current old binary is incompatible.** New history is `Ahead` to its embedded runner; old null-role readers/removal writes are unsafe even if a health check were bypassed. Never remove migration history or weaken readiness to make it appear compatible.
7. Before reopening traffic, have either (a) a reviewed rollback backend artifact with the exact new migration set/canonical auth+assignment compatibility and known-good application behavior, exercised on rehearsal DB, or (b) a proven full DB restore + old backend/frontend rollback within the approved outage. Preference after accepting writes: forward repair or same-schema rollback; do not discard post-release writes by automatic restore.
8. Restore path requires explicit DB-owner/operator approval: stop writers, preserve a failure-state backup, account for/reconcile accepted post-backup writes, restore verified pre-change dump and history, run retained old backend with captured flags, restore frontend alias and repeat local/public auth/readiness checks. New-only workflows unavailable after full release rollback; do not claim migrated feature remains accepted. Never retain a second independent live member table “for rollback”.

## 12. Unavoidable unknowns / release concerns

- Actual production conflict counts, normalized-email collisions, complete catalog dependencies and any later-added access metadata cannot be proven without the later authorized backup/rehearsal inspection. Conflict detection and handling are specified; no implementer discretion to merge ambiguously.
- Old snapshots that never recorded daily hours or hierarchy cannot reveal historical daily allocation/parentage. Required behavior is honest unknown/history presentation and explicit recalculation, not reconstructed claims. All existing bytes/IDs remain preserved.
- Same-schema rollback artifact and runtime availability/restore timing are not yet verified. This blocks production migration/promotion, not implementation of the contract.

No unresolved product options: physical table, ID preservation, explicit access grant, sibling-only DnD, snapshot authority, legacy-hour handling and capacity accounting are decided above.
