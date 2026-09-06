# PM Frontend W3-1 — Core Screen Cutover Fixes (Rust GraphQL)

**Date:** 2026-09-01 | **Mode:** edit (no install/commit/push/deploy/delete) | **Owner scope:** scout §E W3 set + this report only.
**Input state:** backend schema/W2 transport ACCEPTed (ledger 07:28/07:31); W3 defects verified present pre-edit (`new/page.tsx` projectId, `NewTaskForm.tsx:315` toUpperCase, `membersSlice.ts:74,102` dead REST).
**Rework round 2 (2026-09-01):** addressed all 3 blockers + test-gap from `pm-frontend-w3-review.md` (verdict REWORK) — see §6.

---

## 1. Files changed (all within owned scope)

| File | Change |
|---|---|
| `web/src/app/projects/new/page.tsx` | Fix 1: navigation consumes `data?.create_project?.project_id` (was `data.createProject.projectId`); throws if missing → create→display preserves canonical Rust UUID |
| `web/src/components/tasks/NewTaskForm.tsx` | Fix 2: removed `progressType.toUpperCase()`; extracted module-level `buildCreateTaskInput()` (exported for tests) sending lowercase `progress_type` per Rust `TaskProgressType` enum |
| `web/src/redux/features/membersSlice.ts` | Fix 3: `removeMultipleMembers` + `updateMultipleMemberRoles` dead REST (`/api/projects/{id}/members/bulk|roles`) → GraphQL `remove_multiple_project_members` / `update_multiple_members`; `addMemberByEmail` reads `add_project_member_by_email` (was `invite_project_member` — not in SDL); role values lowercased via `toBackendRole`; `updateProjectMemberRole` → positional args `{project_id,user_id,role}` (was `input:` wrapper); bulk updates mapped `{userId,role}→{user_id, lowercase role}`; tolerant `?.` response reads |
| `web/src/graphql/mutations/projectMember.ts` | `INVITE_PROJECT_MEMBER` doc → `add_project_member_by_email(project_id,email,role:MemberRole)` (+ alias `ADD_PROJECT_MEMBER_BY_EMAIL`); `UPDATE_PROJECT_MEMBER_ROLE` → positional `update_project_member(project_id:,user_id:,role:)`; `UPDATE_MEMBER_POSITION` marked RESIDUAL (no Rust op) |
| `web/src/graphql/mutations/projectMembers.ts` | `ADD_PROJECT_MEMBER` → `add_project_member(input:$input)` per SDL (`AddProjectMemberInput`), dropped non-existent `member_id/user_id` selections; `UPDATE_MEMBER_ROLE` (`update_member_role` not in SDL) → `update_project_member` positional; duplicate `UPDATE_PROJECT_MEMBER_ROLE` → positional |
| `web/src/graphql/queries/member.ts` | Dropped `position` from `project_members` selection (field absent on Rust `ProjectMember`); slice defaults `position: null` |
| `web/src/graphql/queries/projects.ts` | `GET_PROJECTS`: removed `description/tags/metadata/is_public/created_by` — absent on Rust `Projects` (lightweight list type); documented note |
| `web/src/graphql/mutations/tasks.ts` | Fix 4: new `REORDER_TASKS` — `reorder_tasks(input: ReorderTasksInput!)` selecting `task_id priority_order status title` per `[Task!]!` return |
| `web/src/hooks/useTasks.ts` | `reorderTasksApi` real call via `client.mutate` (was local mock `Promise.resolve`); exported `mapReorderInput` (camelCase→`{project_id, tasks:[{task_id, priority_order}]}`) + `normalizeReorderResult` (validates `[Task!]` array, throws on contract violation) |
| `web/src/components/projects/ProjectForm.tsx` | Fix 5: create mode → `create_project` via Apollo `client.mutate`, navigates to `/projects/{project_id}`; status `'NEW'`→`'ACTIVE'` (Rust enum has no NEW). Edit mode = documented RESIDUAL (see §3) |
| `web/src/graphql/__tests__/w3-contract.test.ts` (new) | 15 contract tests (rework: +priority_order, +status enum) |
| `web/src/redux/features/__tests__/members-w3.test.ts` (new) | 8 slice tests with mocked Apollo client + `global.fetch` tripwire (rework: BD-1 shapes) |
| `web/src/graphql/__tests__/w3-sdl-fixture.test.ts` (new, rework) | 13 SDL-validity tests — walks every W3-changed document against live `backend/schema.graphql` via installed `graphql` (buildSchema/parse/typeFromAST); asserts required `CreateTaskInput` coverage, restricted status enum, exact `BulkUpdateResponse` selection |

## 2. Verification

- **Jest (scoped, inline-config workaround from W2):** `npx jest --config '{"testEnvironment":"jsdom", babel-jest+next/babel, @/→src/}'` on the 3 W3 suites → **36/36 PASS** (round 1: 20/20). Coverage: project_id mapping + page regression; lowercase progress_type incl. no-`toUpperCase` guard; member op names/variables (`user_id`, lowercase roles, no `input:` wrapper); reorder input map + `[Task!]` normalize/reject; rework adds SDL-validity walker (§6 BD-4), required `priority_order`, restricted status enum, exact `BulkUpdateResponse` selection/read.
- **tsc:** `npx tsc --noEmit` filtered to changed files → only `src/graphql/index.ts(10,1)` TS2308 ×2 (duplicate star-export `REMOVE_PROJECT_MEMBER`/`UPDATE_PROJECT_MEMBER_ROLE`). **Pre-existing**: verified `git show HEAD` — both files already exported these names before W3; barrel is not W3-owned → untouched.
- **Static grep:** owned dirs have zero `progressType.toUpperCase`, zero `invite_project_member(`, zero `/members/bulk|/members/roles` REST; only same-origin REST left in owned files is ProjectForm edit-mode PUT (§3). No `/api/graphql`, no Supabase, no `NEXT_PUBLIC_BACKEND_URL` in owned files. W1/W2/app-api/config/deps untouched; other workers' tree changes preserved (git diff scoped to files above).

## 3. Residuals (backend op absent — documented, not silently dropped)

1. `update_member_position` (MembersView position editing, `UPDATE_MEMBER_POSITION`): no Rust mutation; `ProjectMember` has no `position` field. Kept legacy SDL doc + in-code RESIDUAL comment; will error against Rust endpoint until backend adds op.
2. `ProjectForm` edit mode (`PUT /api/projects/{id}`): no `update_project` mutation in `backend/schema.graphql`; create mode now fully Rust. Edit repoint blocked on backend op.
3. `GET_PROJECTS`/`GET_USER_PROJECTS` consumers wanting `description/tags/metadata/is_public` from list views must use `project(project_id)` — `Projects` list type lacks them (schema-faithful; noted in file).
4. Pre-existing barrel ambiguity `graphql/index.ts` (not owned).

## 4. Unresolved questions

1. Should `UPDATE_MEMBER_POSITION` path be feature-flagged off (UI hides position editing) until Rust op exists, or does backend plan to add it?
2. Will `update_project` be added to Rust schema (gates ProjectForm edit-mode repoint)?
3. `useTaskPriorityOrder.ts` (not W3-owned) still has local reorder logic — confirm owner before wiring to `REORDER_TASKS`.
4. TaskStatus enum width: live SDL shows 9 values vs review's 4 — confirm canonical set (§6 discrepancy).
5. (review §5) `graphql/index.ts` barrel ambiguity owner; should bulk-update UI stay visible now that BD-1 is fixed (yes — fixed).

## 5. Suggested reviewer spot-checks

`git diff web/src/app/projects/new/page.tsx web/src/redux/features/membersSlice.ts web/src/components/tasks/NewTaskForm.tsx web/src/hooks/useTasks.ts`; rerun the three scoped jest suites; `grep -rn "toUpperCase()" web/src/components/tasks/NewTaskForm.tsx` → empty.

## 6. Rework round 2 — review blockers closed (pm-frontend-w3-review.md)

| Blocker | Fix (file) | Evidence |
|---|---|---|
| **BD-1** bulk role update selects non-existent `MemberUserResponse.user_id`; slice matched `m.user.user_id` | `UPDATE_MULTIPLE_MEMBER_ROLES` selection → `members { user_id role joined_at user { id email username full_name avatar_url } }` (`graphql/mutations/projectMembers.ts`); both read sites match `m.user_id` (`membersSlice.ts:120,342`) | Fixture test walks the doc against live SDL (11 docs, zero errors) + exact-selection AST test (`user_id` top-level, `user.id` nested, `user_id` NOT inside `user{}`); slice tests use discriminating fallback (server role `leader` vs stale fallback `Member` → payload `Leader` proves `m.user_id` matching). Single-member `ProjectMember.user{user_id}` selections untouched (valid — review §1 note) |
| **BD-2** `buildCreateTaskInput` omitted required `priority_order: Int!` | `priority_order: data.priorityOrder ?? 0` (`NewTaskForm.tsx`) | Fixture test derives required fields from `CreateTaskInput` in live SDL and asserts every one present & non-undefined in built input, incl. `priority_order === 0` default and `7` pass-through; contract test repeats |
| **BD-3** status select exposed 5 non-canonical values | `statusOpts` → module-level `TASK_STATUS_OPTIONS` = TODO/DOING/DONE/CLOSE only (`NewTaskForm.tsx`); type union kept broad for consuming existing tasks | Fixture + contract tests assert options ⊆ {TODO,DOING,DONE,CLOSE} and ⊆ SDL enum values |
| **BD-4 (test gap)** source-string tests can't catch SDL invalidity | New `w3-sdl-fixture.test.ts`: `buildSchema(backend/schema.graphql)` + `parse` walker validating root fields, argument names, selection fields (incl. NonNull/List unwrap, leaf sub-selection ban, object selection requirement) and variable type resolution — installed `graphql@16.13.2` only, no new deps. Would have caught BD-1/BD-2 (BD-3 via enum check). `UPDATE_MEMBER_POSITION` deliberately excluded (documented backend-absent residual §3.1) | 13/13 pass |

**Rework verification:** 3 suites **36/36 PASS**; tsc filtered → only pre-existing barrel TS2308 (§2); static greps: no `m.user?.user_id`/`m.user.user_id` in bulk-update paths (remaining `m.user.user_id` at `membersSlice.ts:48–54` is the `GET_PROJECT_MEMBERS` ProjectMember→User mapping — valid per SDL), `TASK_STATUS_OPTIONS` has no PENDING/REVIEW/BLOCKED/REJECTED/ARCHIVED, `user {` in `UPDATE_MULTIPLE_MEMBER_ROLES` selects `id` not `user_id`. No install/commit/push/deploy; W1/W2/app-api/config/deps untouched.

**Discrepancy disclosed (BD-3):** live working-tree `backend/schema.graphql:526–536` `enum TaskStatus` currently lists **9** values (TODO DOING DONE CLOSE PENDING REVIEW BLOCKED REJECTED ARCHIVED), while the review read 4 (`schema.graphql:520+`; file has uncommitted churn, `git diff HEAD` 548 insertions). Restriction to the 4 canonical values is safe either way (subset) and honors the review; if the 9-value enum is canonical, the extra 5 options can be restored — flagging for manager/reviewer confirmation.
