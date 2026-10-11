# CLONE-SPEC — selective hierarchy clone + quantity

Task: CLONE-SPEC · read-only scout/plan designer · 2026-09-07 Asia/Bangkok  
Status: **DONE_WITH_CONCERNS**  
Implementation dependency: start only after the MEMBERS writer finishes and its task/member API contract is frozen.

## 1. Outcome contract

Deliver one selective clone flow in List/Excel:

- Clone opens a checkbox tree rooted at the clicked task plus every active descendant.
- The source root is always included. Descendants are selectable.
- Quantity is a positive integer. Default `1`; no custom maximum.
- One submit creates `quantity` independent trees in one backend transaction.
- Every inserted task has a fresh UUID. Every selected descendant points to its corresponding newly cloned parent in the same copy.
- Unchecked descendants are absent. Selected sibling order is preserved.
- Example: source parent + 6 children, 3 children selected, quantity 3 => **3 new parents + 9 new children = 12 new tasks**.
- Existing normal List behavior, Excel staged editing, filters, pagination, hierarchy, member assignment, and project authorization remain intact.

No further product approval is required. Decisions below are final for this package.

## 2. Evidence and current behavior

This is a mutable source snapshot: `TaskListView.tsx`, task create code, assignment types, and schema are being changed by MEMBERS. Re-read their final versions before editing; never revert or overwrite its canonical-member work.

### Current frontend path

- `web/src/components/tasks/TaskListView.tsx:991-1036` handles Clone by calling `cloneTaskSubtree`, then invokes `CREATE_TASK` once per node.
- `web/src/components/tasks/TaskListView.tsx:1001-1019` currently maps source fields client-side: title suffix, description, TODO reset, priority/order, effort, due date, linked `assignee_id`, type/category/tags.
- `web/src/utils/cloneTask.ts:50-145` performs sequential DFS creates. It intentionally permits sibling continuation after an error and reports partial success.
- Normal root rows call Clone at `TaskListView.tsx:1699-1711`. Excel rows call the same callback through `TaskExcelGrid.tsx:388-399`.
- `TaskListView.tsx:993-995` finds only `tasks.find(...)`. The supplied project task array is a root forest, so an Excel child Clone can return silently without opening/copying.
- `cloneTaskSubtree` receives that same root array and only indexes top-level entries. Nested `child_tasks` are not flattened into its parent map, so the visible “subtree clone” normally has no reachable descendants.
- `TaskListView.tsx:386-400` recursively flattens received `child_tasks` for Excel. However `web/src/graphql/queries/tasks.ts:3-57` selects only one GraphQL `child_tasks` level. The Rust resolver builds arbitrary depth, but GraphQL truncates it at the selected depth. Excel therefore cannot prove all descendants.
- `TaskExcelGrid.tsx:129-147` displays assignee from linked account username. Current MEMBERS edits add canonical resource options in `TaskListView.tsx:260-309`; CLONE must consume the final canonical adapter rather than restore the legacy path.
- Successful creates do not refresh the Redux task source used by `ProjectDetailView.tsx:55-102,177-204`; a clone may not appear until another reload.

### Current API and transaction path

- There is no mounted clone mutation. `backend/src/graphql/resolvers/tasks/mod.rs:35-61` mounts only create/update/status/effort/delete/reorder.
- `web/src/graphql/mutations.ts:3-30` exposes `CREATE_TASK`; its result omits `assignee_resource_member_id`.
- `backend/src/graphql/types/task.rs:227-249` defines create input. `backend/schema.graphql:151-172,332-337` confirms the mounted contract.
- `backend/src/graphql/resolvers/tasks/mutation/create.rs:14-154` starts one transaction per task, checks write authorization, validates same-project active parent, normalizes canonical assignment, inserts, then commits.
- Consequently current multi-node clone is **not atomic**: each node commits independently and `cloneTask.ts` explicitly retains successful nodes after later failures.
- Current create now uses the in-progress MEMBERS boundary `backend/src/domain/project_member_identity.rs`; preserve that final boundary so an unlinked canonical member remains assigned by `resource_member_id` with a null account mirror.
- `backend/src/graphql/resolvers/tasks/query/tasks.rs:14-151` loads the full recursive tree and assembles arbitrary-depth children server-side, but its public GraphQL shape still requires a finite client selection depth.

## 3. Settled interaction semantics

### Open/defaults

- Both existing normal and Excel Clone buttons open the same modal; no immediate write.
- Modal source root is checked and disabled with text “Parent is always copied.”
- All active descendants start checked. Quantity starts at `1`. Thus the default confirmation preserves old full-subtree, one-copy intent.
- Cloning a nested source keeps the source root clone under the source root's existing parent, matching current behavior. Its selected descendants remap below the new root.
- Parent-only clone is valid: uncheck all descendants and choose any valid quantity.

### Nested checkbox rules

- Unchecking a node unchecks that node and every descendant.
- Checking a descendant checks every ancestor between it and the required source root.
- A partially selected branch renders its parent checkbox indeterminate.
- The source root cannot be unchecked.
- No orphan promotion: a selected grandchild is never moved to the nearest selected ancestor. The backend rejects a malformed selection missing any non-root ancestor.
- Nodes outside the source subtree, deleted nodes, duplicate IDs, and the source root inside `selected_descendant_ids` are rejected; never silently ignored.
- Selection follows task identity, not title. Duplicate titles are legal and independent.

### Quantity validation

- UI uses a required numeric input with `min=1`, `step=1`, plus explicit validation with `Number.isSafeInteger(value) && value > 0`.
- Empty, zero, negative, decimal, NaN, or unsafe JS integer shows: **“Enter a whole number greater than 0.”** Confirm remains disabled.
- Backend independently requires `quantity >= 1`. GraphQL `Int` supplies the protocol range; add no product-specific maximum.

## 4. Additive GraphQL contract

Use these exact additive names:

```graphql
input CloneTaskSubtreeInput {
  source_task_id: ID!
  selected_descendant_ids: [ID!]!
  quantity: Int!
}

type CloneTaskSubtreePayload {
  root_task_ids: [ID!]!
  created_task_ids: [ID!]!
}

extend type Query {
  # Flat, active, parent-before-child project rows for arbitrary-depth Excel/clone UI.
  task_tree_rows(project_id: ID!): [Task!]!
}

extend type Mutation {
  clone_task_subtree(input: CloneTaskSubtreeInput!): CloneTaskSubtreePayload!
}
```

Contract details:

- `task_tree_rows` requires authenticated project read access and returns every non-deleted project task exactly once, flat, in deterministic parent-before-child order. Siblings sort by `priority_order`, then `created_at`, then `task_id`.
- `clone_task_subtree` derives project ID from the source task; the client cannot choose a destination project.
- Payload IDs are ordered copy-by-copy; within each copy, parent precedes descendants. `root_task_ids` has exactly `quantity` entries. `created_task_ids` has exactly `quantity * (1 + selected_descendant_ids.length)` entries.
- No schema migration or new table is needed.

## 5. Backend algorithm and atomicity

Implement one new `clone.rs` resolver; do not call mounted `create_task` repeatedly because it owns and commits its own transaction.

1. Authenticate; parse input; reject invalid quantity/duplicate/root-in-descendant IDs before writes.
2. Begin one SQL transaction.
3. Load the active source and derive project. Require `project_authz::require_project_write_tx` using the final MEMBERS authorization predicate.
4. Load and lock the active source subtree using a cycle-safe recursive CTE (`UNION` over task IDs, not unguarded `UNION ALL`) and `FOR UPDATE` on resolved task rows.
5. Validate every submitted descendant is currently reachable from the source and every intermediary ancestor is submitted. Reject corrupt cycles, missing/moved/deleted nodes, cross-project ancestry, or an invalid original parent before inserting anything.
6. Build one deterministic parent-first source order: root, then selected children recursively by `(priority_order, created_at, task_id)`.
7. Normalize each selected source assignment once through the final canonical MEMBERS helper: resource ID first; legacy user fallback only if resource ID is absent. Invalid/stale/cross-project/non-MEMBER assignment aborts the whole operation.
8. For copy index 1..quantity, allocate a fresh UUID per source row, keep a per-copy old→new map, and insert parent before child. Root keeps the source root's original parent; descendants use only that copy's map.
9. Any validation, authorization, normalization, SQL, constraint, or result-shape failure rolls back every insert across every requested copy. Commit only after all rows and payload counts reconcile.
10. Return IDs, then the client refreshes both the flat-tree query and Redux `fetchProjectTasks(projectId)` before announcing confirmed success.

Transport ambiguity: if the connection fails after the server may have committed, refetch before enabling retry and show **“Could not confirm clone; task list refreshed. Check results before retrying.”** Do not claim rollback when no response was received. No idempotency table/token is added.

### Error semantics

Use the final shared GraphQL error helper from MEMBERS if available; otherwise add scoped extension mapping in the clone resolver. Do not expose SQL text or foreign task/member details.

| Code | Cases | Client behavior |
|---|---|---|
| `UNAUTHENTICATED` | no valid caller | close nothing; show sign-in/auth error |
| `FORBIDDEN` | caller lacks source-project write role | modal stays open; generic permission message |
| `BAD_USER_INPUT` | quantity, duplicate/root selection, missing ancestor | inline validation/error; no writes |
| `NOT_FOUND` | active source unavailable | modal stays open; refresh rows |
| `CONFLICT` | hierarchy/assignment changed or is corrupt since load | refresh tree; preserve quantity; require user to reselect |
| `INTERNAL_SERVER_ERROR` | unexpected DB/server failure | generic failure; transaction rollback; no raw details |

## 6. Exact copy/reset map

Preserve the established clone behavior, with canonical assignment repaired server-side:

| Task field | Clone behavior |
|---|---|
| `task_id` | fresh server UUID for every node/copy |
| `project_id` | source project |
| `parent_task_id` | root keeps original parent; selected descendants map to fresh parent in same copy |
| `title` | source title + literal ` (copy)`; do not add quantity numbering |
| `description` | preserve source description; current null/missing behavior remains empty string |
| `status` | reset to `TODO` |
| `priority` | preserve |
| `priority_order` | preserve numeric source value; selected siblings therefore retain source relative order |
| `start_date` | reset/null (currently not sent by clone) |
| `due_date` | preserve |
| `effort` | preserve; current null behavior remains `0` |
| `progress` | reset `0` |
| `actual_start_date`, `actual_end_date` | reset/null |
| `assignee_resource_member_id` | preserve canonical resource identity after same-project/MEMBER validation |
| `assignee_id` | derive current linked user from canonical member; null for unlinked member |
| `type`, `category` | preserve |
| `tags` | preserve; current absent behavior remains empty array |
| `progress_type` | reset/null (currently omitted) |
| `phase_id`, `category_id` | reset/null (currently omitted) |
| `created_by` | authenticated cloning caller |
| `created_at`, `updated_at` | fresh server timestamp |
| `is_deleted` | false |
| import provenance (`source_system`, `external_id`, `source_metadata`, `wbs_group_id`) | reset/null; never duplicate external identity |

Do not clone comments, attachments, checklist/custom data outside task columns, dependencies, time entries, plan snapshots, status history, or allocation history. Current clone does not copy them.

## 7. Frontend integration

- Add `TASK_TREE_ROWS` to `web/src/graphql/queries/tasks.ts`; query only fields List/Excel/clone needs and alias account fields to the existing UI `Task` shape.
- Load flat rows when Excel is active or a clone modal is open. Do not replace normal List's existing root/pagination/filter source.
- For Excel, retain the current visible root set (filters/completed behavior), then include every descendant of those roots from flat rows. Reuse `buildGanttTaskRows` for finite deduped parent/depth projection; pass `excelDepth` to the existing grid.
- The Excel assignee cell must use the final MEMBERS canonical resource option/label mapping. An unlinked member displays its canonical name, not blank. Do not edit or restore the old username-only save adapter.
- Repurpose `web/src/utils/cloneTask.ts` to pure, cycle-safe subtree/selection helpers. Remove all per-node network create and partial-success logic.
- Add `TaskCloneDialog.tsx`; use existing styling/native controls, no dependency. It owns checkbox/quantity UI only and submits one mutation.
- `TaskListView.tsx` owns source task ID, tree query, mutation, success refresh, and toast. Disable Confirm while loading/submitting; prevent double submit. On server validation/conflict, keep modal and selection visible.
- Success message: **“Created {quantity} copies ({createdCount} tasks).”** Close only after mutation success and refresh request is started/completed according to the existing Redux convention.
- `TaskExcelGrid.tsx` keeps staged edit behavior and its current row Clone callback. Only adjust canonical label props/types if the final MEMBERS implementation has not already done so.

## 8. Focused verification

### Frontend Jest

1. Pure subtree projection handles parent→child→grandchild, unrelated roots, duplicate input, orphan, and cycle without hanging or duplicating.
2. Modal defaults all descendants selected and quantity 1; root is checked/disabled.
3. Uncheck parent removes its subtree; check grandchild restores all ancestors; partial branches are indeterminate.
4. Empty/0/negative/decimal/unsafe quantity blocks submit with the exact validation message.
5. Submit sends only `source_task_id`, selected descendant IDs, and quantity; no task field payload comes from the browser.
6. Full-selection quantity 1 preserves old subtree intent. Parent-only selection is valid.
7. Mutation error keeps modal state; in-flight double click makes one request; transport ambiguity triggers refresh wording.
8. Excel renders arbitrary-depth parent-first rows with indentation and canonical unlinked assignee label; normal List still uses its existing source/filter/pagination path.
9. Normal and Excel Clone buttons open the same flow, including a nested Excel row.

Update/replace:

- `web/src/utils/__tests__/cloneTask.test.ts` — remove partial-commit expectations; test pure subtree/selection rules.
- Add `web/src/components/tasks/__tests__/TaskCloneDialog.test.tsx`.
- Extend `web/src/components/tasks/__tests__/TaskExcelGrid.test.tsx` only for deep hierarchy/canonical label callback behavior.
- Extend `web/src/components/tasks/__tests__/TaskList.test.tsx` for button→modal→single mutation→refresh wiring.

### Mounted Rust GraphQL + PostgreSQL

Extend the isolated `backend/tests/herdr_flow.rs` flow after MEMBERS stabilizes; an unset `TEST_DATABASE_URL` is SKIPPED, not acceptance evidence.

1. Parent + 6 children; select 3; quantity 3 => 12 created, 3 roots, 9 children, all IDs unique, no unchecked source represented.
2. Each cloned child points to its own copy root; no cross-copy parent; nested grandchild maps to its cloned selected parent.
3. Child source clone retains original source parent. Sibling `priority_order` values match selected source values after reload.
4. Exact copy/reset table above, including TODO/progress/actual/start resets and fresh creator/timestamps.
5. Unlinked canonical assignee retains resource ID/null user; linked canonical assignee retains resource ID and derives matching user.
6. Owner/authorized manager succeeds. Unauthenticated, read-only, outsider, and cross-project selection fail with zero inserts.
7. Quantity 0/negative, duplicate IDs, source in descendant IDs, missing ancestor, foreign/deleted/moved descendant, corrupt cycle, invalid assignment all fail with zero inserts.
8. Add a test-only failing trigger/constraint after at least one attempted insert; prove the mutation errors and source-project task count is unchanged after rollback. Remove the test-only trigger.
9. `task_tree_rows` requires read auth, returns all active depths once, excludes deleted rows, and is deterministic parent-before-child.
10. Extend `backend/tests/contract/main.rs` to pin the new query/mutation/input/payload names and field nullability.

After focused checks: backend format/clippy/full tests and web Jest/typecheck/lint/build under the main plan's final TEST gate. No test or command was run by this read-only scout.

## 9. Exclusive file ownership for later implementer

Start only after MEMBERS handoff. Re-read final diffs first.

### Backend owner

- `backend/src/graphql/types/task.rs` — new input/payload only.
- `backend/src/graphql/resolvers/tasks/mod.rs` — mount query/mutation.
- `backend/src/graphql/resolvers/tasks/query/tasks.rs` — add authorized flat `task_tree_rows` wrapper over existing forest; no unrelated query rewrite.
- `backend/src/graphql/resolvers/tasks/query/mod.rs` — export wrapper if required by final layout.
- `backend/src/graphql/resolvers/tasks/mutation/clone.rs` — new atomic implementation.
- `backend/src/graphql/resolvers/tasks/mutation/mod.rs` — module/export.
- `backend/schema.graphql` — regenerate/update mounted SDL.
- `backend/tests/herdr_flow.rs`, `backend/tests/contract/main.rs` — focused persistence/contract proof.

Dependency, not owned: final `backend/src/domain/project_member_identity.rs`, `project_authz`, member migration/resolvers, and `mutation/create.rs`. Reuse them; change only if the post-MEMBERS referencer check proves a compile-level extraction is unavoidable, then coordinate ownership before editing.

### Web owner

- `web/src/components/tasks/TaskListView.tsx` — flow orchestration and refresh.
- New `web/src/components/tasks/TaskCloneDialog.tsx` — bounded modal.
- `web/src/components/tasks/TaskExcelGrid.tsx` — only if final canonical label prop is still needed.
- `web/src/utils/cloneTask.ts` — replace sequential writer with pure tree/selection logic.
- `web/src/graphql/queries/tasks.ts` — flat tree query.
- `web/src/graphql/mutations.ts` — clone mutation document; stop using `CREATE_TASK` for clone.
- Focused test files listed in §8.

Dependency, not owned: final MEMBERS changes in `web/src/hooks/useTaskFieldMutations.ts`, `web/src/graphql/scheduling.ts`, Redux member contracts, `MembersView`, and `SchedulingConfigPanel`. Do not revert them.

## 10. Exclusions

- No package/dependency, database migration, deployment, browser, plan/ledger, Gantt, member-management, or unrelated task CRUD changes.
- No user-defined title template, destination project, quantity cap, scheduling recalculation, assignment override, clone history, idempotency table, background job, or progress UI.
- No partial-success mode. Atomic all-or-nothing replaces it because selective quantity clone is one user operation.

## 11. Readiness gate

Implementation may begin when:

1. MEMBERS writer reports complete.
2. Final canonical resource assignment input/output and authorization helper compile.
3. The later implementer re-reads the mutable evidence files and confirms no ownership collision.

Definition of done: focused tests prove exact counts, IDs, hierarchy, selection closure, canonical assignments, same-project auth, copy/reset fields, persisted reload, and rollback on mid-operation failure; broad checks are handed to final TEST/review.

## Concerns / blockers

- Concern: evidence files are mid-MEMBERS changes. The contract is cause-aligned to the observed snapshot, but final integration paths must be re-read after that writer completes.
- Blocker to implementation now: shared-file ownership remains with MEMBERS. No blocker to the contract itself.

## Unresolved questions

None.
