# PM Frontend W3 Review — Independent Final Review (Rust GraphQL Cutover)

**Date:** 2026-09-01 | **Mode:** read-only (only this file written). No source edits/install/commit/push/deploy/delete.
**Reviewed:** every file in `pm-frontend-w3-1.md` §1 vs live `backend/schema.graphql`; scout (`pm-frontier-scout-1.md` §6 acceptance); W2 inline-config workaround (`pm-frontend-w2-1.md` §75–93).
**Verdict: REWORK (round 1, superseded — see §7). FINAL VERDICT: ACCEPT (round 2, all blockers closed, independently re-verified).** — Round 1 found 3 blocking defects on W3-changed paths; scoped tests 20/20 PASS and static greps clean, but the test approach (source-string assertions) cannot catch SDL selection/input validity, and all 3 blockers live exactly in that gap.

---

## 1. Blocking defects (must fix before deploy)

### BD-1 — `UPDATE_MULTIPLE_MEMBER_ROLES` selects non-existent field → bulk role update always fails
- **Evidence:** `web/src/graphql/mutations/projectMembers.ts:53–71` selects `members { role joined_at user { user_id email username full_name avatar_url } }`.
- **SDL:** `update_multiple_members(...): BulkUpdateResponse!` → `members: [ResolverProjectMember!]!` → `ResolverProjectMember.user: MemberUserResponse!` and `MemberUserResponse { id, email, username, full_name, avatar_url }` (`schema.graphql:170–176, 209, ~20`) — **`MemberUserResponse` has `id`, not `user_id`**.
- **Effect:** server-side document validation error on every bulk role update (whole mutation rejected), even before execution.
- **Second layer:** read-side `membersSlice.ts:120` and `:342` match `result.members.find(m => m.user?.user_id === update.userId)` — wrong key even with a fixed selection (`MemberUserResponse.user_id` never exists). Correct keys: top-level `ResolverProjectMember.user_id` or `user.id`.
- **Fix:** select `members { user_id role joined_at user { id email username full_name avatar_url } }`; match on `m.user_id`. Note `ADD_PROJECT_MEMBER`/`UPDATE_MEMBER_ROLE`/`UPDATE_PROJECT_MEMBER_ROLE` selections are **valid** (they target `ProjectMember.user: User`, which does have `user_id` — `schema.graphql:597–603`) — do not "fix" those.

### BD-2 — `buildCreateTaskInput` omits required `priority_order: Int!` → task create rejected
- **Evidence:** `NewTaskForm.tsx:146–167` builds input without `priority_order`; call site `:327–334` sends `variables.input` as-is.
- **SDL:** `CreateTaskInput.priority_order: Int!` (non-null; `schema.graphql:~95`). Server error: *"In field \"priority_order\": Expected \"Int!\", found null."*
- **Pre-existing?** Yes (HEAD version also omitted it), but W3 rewrote and exported this builder as the production mapping and its test asserts only `progress_type` casing — the acceptance criterion "tests genuinely exercise production mappings" is not met for required-field completeness.
- **Fix:** add `priority_order: data.priorityOrder ?? 0` (or wire a form field / derive from current max+1).

### BD-3 — Task status select exposes enum values Rust doesn't have → task create fails for 5 of 8 options
- **Evidence:** `NewTaskForm.tsx:292–304` `statusOpts` includes `PENDING`, `REVIEW`, `BLOCKED`, `REJECTED`, `ARCHIVED`; `buildCreateTaskInput` passes `status: data.status` (`:156`).
- **SDL:** `enum TaskStatus { TODO DOING DONE CLOSE }` (`schema.graphql:520+`). Any non-canonical selection → enum coercion error → create fails.
- **Fix:** filter `statusOpts` to the 4 Rust values (mirror the `progressTypeOpts` pattern already added at `:307–317`). Default `TODO` (`:212`) is valid.

## 2. Verified correct (spot-check evidence)

| Acceptance item | Result |
|---|---|
| Project create canonical ID/navigation | ✅ `new/page.tsx:70–77` reads `data?.create_project?.project_id`, throws if missing; `ProjectForm.tsx:71–96` same + `NEW→ACTIVE` (Rust `ProjectStatus` has no NEW). `CREATE_PROJECT` selection fully matches `ProjectResponse` (all 16 fields incl. `visibility/tags/metadata/icon_url/is_public/created_at` — all present, `schema.graphql:365–381`) |
| `progress_type` casing | ✅ no `toUpperCase` in file (grep empty); options `'study'…'release'` match `TaskProgressType` exactly (`schemas/taskForm.ts:91–99`) |
| Member single ops | ✅ `add_project_member_by_email(project_id,email,role)` positional per SDL:205; `update_project_member(project_id,user_id,role)` positional per SDL:197; no `input:` wrapper; `toBackendRole` lowercases (`lib/utils.ts:131–133`) matching both `MemberRole` and `ProjectMemberRole` (identical lowercase values) |
| Member bulk variable shapes | ✅ `remove_multiple_project_members` vars `{projectId, memberIds}` correctly bound to `$projectId/$memberIds` → `project_id/member_ids`; `update_multiple_members` updates `{user_id, lowercase role}` matches `MemberRoleUpdate` — **but BD-1 selection invalidates the bulk-update document** |
| `reorder_tasks` | ✅ `REORDER_TASKS` = `reorder_tasks(input: ReorderTasksInput!)` selecting `task_id priority_order status title` (all on `Task`); `mapReorderInput` → `{project_id, tasks:[{task_id, priority_order}]}` matches `TaskOrderInput`; `normalizeReorderResult` validates array per `[Task!]!` and throws on violation; `reorderTasksApi` real `client.mutate` |
| `GET_PROJECTS` field removals | ✅ selection (12 fields) ⊆ `Projects` type (`schema.graphql:398–410`); no `description/tags/metadata/is_public/created_by` |
| `GET_PROJECT_MEMBERS` | ✅ selection `role joined_at user{user_id,...}` valid on `ProjectMember{role, joined_at, user: User}`; `position` dropped, slice defaults `position: null` |
| Dead REST / transport hygiene | ✅ zero `members/bulk|roles` REST, zero `invite_project_member(` call sites, zero `NEXT_PUBLIC_BACKEND_URL`//`/api/graphql`/Supabase in owned files (only stray: stale SDL string `src/lib/graphql/types/task-scheduler.ts:359`, not owned, not executed) |

## 3. Test/type rerun (independent)

- **Jest (scoped, W2 inline-config workaround):** 2 suites, **20/20 PASS** (1.66s) — reproduced independently. ✅
- **tsc --noEmit scoped to changed files:** only `src/graphql/index.ts(10,1)` TS2308 ×2 (barrel duplicate star-export `REMOVE_PROJECT_MEMBER`/`UPDATE_PROJECT_MEMBER_ROLE`) — pre-existing, barrel not W3-owned, matches W3-1 §2 disclosure. ✅
- **Static greps:** all clean per §2 last row. ✅
- **Gap:** both suites assert source strings/variable shapes, not document-vs-SDL validity — BD-1/BD-2/BD-3 all pass these tests. Recommend adding a fixture test that walks each W3 document's selections/inputs against `backend/schema.graphql` (or snapshot of it) — would have caught all three.

## 4. Documented backend-absent residuals (NOT blockers — correctly disclosed)

1. `update_member_position`: no Rust mutation, `ProjectMember` has no `position` — RESIDUAL comment present (`membersSlice.ts:255+`); will error if invoked. Agreed: backend-absent residual, matches W3-1 §3.1.
2. `ProjectForm` edit mode REST `PUT /api/projects/{id}`: `update_project` absent from SDL (grep: only `update_project_member` exists) — disclosed residual. `src/lib/graphql/types/task-scheduler.ts:359` stale SDL has `invite_project_member` — dead type file, recommend follow-up cleanup (not W3-owned).
3. `GET_PROJECTS` list-view consumers needing full fields must use `project(project_id)` — schema-faithful, noted in file.
4. `useTaskPriorityOrder.ts` local reorder logic unwired to `REORDER_TASKS` — ownership question open (W3-1 §4.3), not a regression.

## 5. Round-1 verdict & required rework (historical — superseded by §7)

**REWORK.** The W3 lane fixed 4 of its 5 targeted defects correctly (project_id navigation, progress_type casing, member op names/variable shapes, reorder contract), but the task-create path ships 2 contract-breaking defects (BD-2, BD-3 — the exact E2E row "task create (kills progress_type defect)" will fail), and bulk member role update ships 1 (BD-1 — "members bulk ops" row will fail). All three are small, contained fixes in W3-owned files:

1. `projectMembers.ts` `UPDATE_MULTIPLE_MEMBER_ROLES` → `members { user_id role joined_at user { id ... } }`; `membersSlice.ts:120,342` match on `m.user_id`.
2. `NewTaskForm.tsx` `buildCreateTaskInput` → add `priority_order`.
3. `NewTaskForm.tsx` `statusOpts` → filter to TODO/DOING/DONE/CLOSE.
4. Re-run 2 scoped suites + add SDL-validity fixture test (recommended, gates future regressions).

**Unresolved questions (round 1):** (1) should bulk-update UI be hidden until BD-1 fixed? (2) does `priority_order` default 0 suffice or does product want form control? (3) owner for `useTaskPriorityOrder.ts` wiring; (4) `graphql/index.ts` barrel ambiguity owner (pre-existing).

---

## 7. Round-2 re-review (post-rework) — FINAL VERDICT: ACCEPT

**Date:** 2026-09-01 09:18 | **Mode:** read-only (only this report + ledger event). Re-read updated `pm-frontend-w3-1.md` (§6 rework disclosure), inspected live changed files, re-validated against live `backend/schema.graphql`, independently re-ran scoped suites.

### Blocker verification (all 3 closed)

| ID | Live-tree evidence | SDL check | Status |
|---|---|---|---|
| **BD-1** | `projectMembers.ts:53–72` now selects `members { user_id role joined_at user { id email username full_name avatar_url } }`; read sites `membersSlice.ts:120` and `:342` match `m.user_id` | `ResolverProjectMember` has top-level `user_id: String!` and `user: MemberUserResponse!` whose only ID field is `id` (schema:458–466, 170–176) — selection now exactly valid | ✅ CLOSED |
| **BD-2** | `NewTaskForm.tsx:167–168` `priority_order: data.priorityOrder ?? 0` | `CreateTaskInput.priority_order: Int!` (schema:94) — non-null satisfied incl. default 0 | ✅ CLOSED |
| **BD-3** | `NewTaskForm.tsx:148–153` module-level `TASK_STATUS_OPTIONS` = TODO/DOING/DONE/CLOSE only; `:303` `statusOpts = TASK_STATUS_OPTIONS` | **Schema discrepancy observed:** live working-tree `TaskStatus` enum now lists 9 values (schema:526–536; file has uncommitted churn, 548 insertions vs HEAD) — round 1 read 4. The 4-value option set is a subset → valid under **either** enum. Not a defect; canonical-set confirmation stays with manager (worker disclosed same in W3-1 §6) | ✅ CLOSED (subset-safe) |
| **BD-4** (test gap) | New `w3-sdl-fixture.test.ts` genuinely walks 11 W3 documents against live SDL via `buildSchema`/`parse`/`typeFromAST` (installed `graphql` only — no new deps); imports verified in file head | Would have caught BD-1/BD-2 (and BD-3 via enum check); `UPDATE_MEMBER_POSITION` deliberately excluded (documented residual) | ✅ CLOSED |

### Independent re-verification

- **Jest (3 W3 suites, W2 inline-config workaround):** **36/36 PASS** (1.63s) — reproduced independently, matches W3-1 §2 claim.
- **tsc scoped to changed files:** only pre-existing `graphql/index.ts(10,1)` TS2308 ×2 barrel ambiguity (not W3-owned, unchanged from round 1).
- **Regression spot-checks:** single-member `ProjectMember.user { user_id … }` selections untouched (valid — `User.user_id` exists, schema:597–603); `m.user.user_id` remaining at `membersSlice.ts:48–58` is the `GET_PROJECT_MEMBERS` → `ProjectMember.user: User` mapping — valid; `BulkUpdateResponse`/`MemberRoleUpdate` SDL unchanged and still matched.
- **Residuals (§4) unchanged:** `update_member_position`, ProjectForm edit-mode REST, list-view field limits, barrel TS2308 — all correctly documented backend-absent/pre-existing, not silently dropped.

### Verdict

**ACCEPT.** All round-1 blockers closed with correct, minimal, in-scope fixes; contract tests now exercise production mappings including SDL validity; no regressions introduced; residuals remain properly documented. W3 core frontend cutover is code-side ready for the deploy chain (manager-gated steps per scout §3 remain outside this lane).

**Residual unresolved (manager):** (1) canonical `TaskStatus` width (4 vs 9 values — restore 5 options only if 9-value enum is confirmed canonical); (2) `useTaskPriorityOrder.ts` wiring owner; (3) barrel ambiguity owner; (4) `update_member_position` feature-flag decision.
