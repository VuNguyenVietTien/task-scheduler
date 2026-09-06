# SOL Review — W1a Naming, Enums & Contract Freeze

**Reviewer:** Sol (high rigor) | **Run:** herdr-260830-2320-api-parity | **Date:** 2026-08-31
**Inputs reviewed:** `reports/w1a-naming-enums.md`, working-tree diff of `backend/src/graphql/{types,resolvers}/**`, `backend/schema.graphql`, `backend/tests/contract/main.rs`, source report `plans/reports/herdr-260830-1500-memory-orchestration/reports/api_scout.md`, web wire ops in `web/src/graphql/**`, async-graphql 5.0.10 derive sources.
**Evidence:** independently reproduced `cargo check` (0 errors), `cargo test --test contract` (7/7 pass), `cargo check --tests` (compiles incl. W1b `tests/auth/`), schema regeneration byte-identical (shasum `cf19b9ad…` before/after), plus a minimal async-graphql 5.0.10 repro crate in `/tmp/agql-probe` proving the ComplexObject root cause below. No source/config files edited.

## Verdict: **REWORK**

Compile/test evidence is genuine and ownership is clean, but the headline B1 deliverable — snake_case **operation names** — is not achieved, and the D4 `type` alias does not exist in the schema. The report's own verification claims misread the SDL. Both defects are invisible to the contract test, which is too weak to catch them.

---

## 1. Verified correct (keep)

| Claim | Verification |
|---|---|
| File ownership respected | All W1a edits confined to `types/**`, `resolvers/**`, `schema.graphql`, `tests/contract/**`; W1b's `config.rs`, `auth/supabase.rs`, `tests/auth/`, `handlers.rs` left intact; `resolvers/mod.rs` still comments out legacy dead files (`task.rs`, `task_resolver.rs`, `notification.rs`, `attachment.rs`) ✓ |
| Type/input **field** names snake_case | SDL: `Task`, `Assignee`, `CommentResponse`, `Notification`, `ProjectResponse` (incl. camelCase Rust idents `projectId`→`project_id`), all inputs — all snake_case ✓ |
| Resolver **argument** names snake_case | SDL: `tasks(project_id:, status:, assignee_id:)`, `project(project_id:)`, `getProjectPlans(project_id:)`, etc. ✓ |
| Enum casing (B2) | SDL: `TaskStatus`/`TaskPriority` UPPERCASE; `TaskProgressType`/`MemberRole` lowercase; `ProjectStatus` SCREAMING (`ACTIVE`,`ON_HOLD`). Source: sqlx `rename_all="UPPERCASE"` + `Display`→uppercase; `FromStr` stays case-insensitive ✓ |
| `type_` pins (partial) | `Task.type_`, `Notification.type_`, `CreateNotificationInput.type_` pinned via `#[graphql(name="type_")]`; SDL shows `type_:` ×3 ✓ |
| Reorder shape | `ReorderTasksInput { project_id: ID!, tasks: [TaskOrderInput!]! }` in SDL; `reorder.rs` binds `project_id` into `WHERE task_id=$3 AND project_id=$4` ✓ (return type still `[Task!]` vs web SDL `Boolean!` — op is REST-wired in frontend today, dormant) |
| CommentResponse shape | `author_id`→`user_id`, `username` nullable, `full_name`/`avatar_url` added; `comment.rs` + `task_comments.rs` SQL select `u.full_name, u.avatar_url` ✓ |
| Assignee.full_name | Field added, all construction sites compile (proof: `cargo check` 0 errors); value `None` everywhere — honestly flagged as follow-up #1 |
| Plans dual aliases (D2) | SDL has both `createPlan/create_plan`, `updatePlan/update_plan`, `deletePlan/delete_plan`, `setPlanActive/set_plan_active` delegating to same fns; `PlanMutation` correctly left without rename attr ✓ |
| Schema regen | `schema.graphql` reproducibly regenerated from live `Schema::build(...)` (byte-identical on rerun); stale legacy doc replaced ✓ |
| Build/test evidence | Reproduced: `cargo check` 0 errors; `cargo test --test contract` 7 passed / 0 failed; `cargo check --tests` compiles (W1b `tests/auth/main.rs` compatible — no conflicts in shared `resolvers/auth.rs` rename area) |

## 2. Critical findings (block acceptance)

### C1 — Root operation names are still camelCase; frontend ops all fail (B1 headline unmet)
All resolver `#[Object]`s got `rename_args = "snake_case"` — but `rename_args` renames **arguments only**. Object *field* (operation) names still default to camelCase. Regenerated SDL (`backend/schema.graphql:171–249, 411–443`):

- Mutation: `createTask`, `updateTask`, `updateTaskStatus`, `deleteTask`, `reorderTasks`, `createProject`, `createComment`, `deleteComment`, `markNotificationAsRead`, `markAllNotificationsAsRead`, `addProjectMember`, `updateProjectMember`, `removeProjectMember`, `updateMultipleMembers`, `removeMultipleProjectMembers`, `updateProfile`, `registerFcmToken`, `uploadImage`…
- Query: `taskSubtasks`, `taskComments`, `projectMembers`, `myProjectRole`, `getProjectPlans`, `getLatestProjectPlan`, `getPlan`, `notificationCount`…

Frontend actually sends (`web/src/graphql/{mutations,queries}/*.ts`): `create_task`, `update_task`, `update_task_status`, `delete_task`, `create_comment(input)`, `delete_comment(id:)`, `task_subtasks`, `task_comments`, `project_members`, `my_project_role`, `get_project_plans`, `mark_notification_as_read`, `mark_all_notifications_as_read`, … → every one fails validation ("Unknown field … on type Query/Mutation"). The scout's Phase 1 "biggest lever, unlocks ~80% of ops" is **not delivered**.

**Fix:** `#[Object(rename_fields = "snake_case", rename_args = "snake_case")]` on all resolver Objects (or per-method `#[graphql(name = "...")]`), keeping `PlanMutation` on explicit dual aliases, then regenerate SDL.

### C2 — D4 `type` aliases on Task/Notification do not exist; ComplexObject silently dropped
SDL contains **no** `type:` field inside `type Task` or `type Notification`. Root cause (proven with minimal 5.0.10 repro): async-graphql's `SimpleObject` derive only merges `<Self as ComplexObject>::fields(registry)` when the derive carries **`#[graphql(complex)]`** (`async-graphql-derive-5.0.10/src/simple_object.rs:312-318`, `args.rs:194`). Without it, `#[ComplexObject]` impls compile fine but are ignored. Repro confirms: adding `#[graphql(complex)]` makes both `type_` and `type` appear in SDL *and* introspection *and* resolve correctly.

The report's "SDL confirms `type_:` ×3 + `type:` ×2" is a **miscount**: the two `\ttype:` hits are `input CreateTaskInput.type` (SDL:100) and `input UpdateTaskInput.type` (SDL:570) — see C3 — not the Task/Notification aliases.

**Fix:** add `#[graphql(complex)]` to the `SimpleObject` derives of `Task` and `Notification`.

### C3 — `CreateTaskInput.type_` / `UpdateTaskInput.type_` not pinned → exposed as `type`
snake_case rename strips the trailing underscore, so SDL inputs expose `type:` while the frontend sends `type_` in variables (`web/src/graphql/mutations.ts` selects `type_`; web SDL `task-scheduler.ts:150,174` uses `type_`). Once C1 is fixed, `create_task`/`update_task` with `type_` in variables will fail input coercion on unknown field. Same pin (`#[graphql(name = "type_")]`) that was correctly applied to the three types in §1 was missed on these two inputs.

### C4 — Contract test too weak; green 7/7 is misleading
`tests/contract/main.rs` never asserts snake_case **root op names** (the actual B1 deliverable) nor absence of camelCase ops (`!sdl.contains("createTask(")` etc.). `snake_case_field_and_arg_names` only checks type fields + `tasks(` arg. `task_and_notification_expose_type_and_type_underscore` counts any `\ttype:` ≥2 — satisfied today by the two *input* fields from C3. After fixing C1–C3 without strengthening the test, regressions remain undetectable.

**Fix:** assert per-op names (`create_task(input:`, `get_project_plans(`, `mark_notification_as_read(` …), assert `!sdl.contains("createTask(")` / `"taskComments("` / `"getProjectPlans("`, and scope the `type` alias assertions to the `type Task {` / `type Notification {` blocks specifically.

## 3. Medium findings

- **M1 — `update_task_effort` still unmounted.** Resolver + snake_case input exist (`update_effort.rs`), exported from `tasks/mutation/mod.rs:12`, but absent from `TaskMutation`'s `#[Object]` and from the SDL. Frontend op is live (`web/src/graphql/mutations/tasks.ts:40`, `useTaskEffort.ts`). Pre-existing gap (never mounted at HEAD), but the scout matrix expected it exposed post-Phase-1 and the report's rename-only change leaves it dead.
- **M2 — False claim:** "Plans queries got full snake_case rename (frontend sends snake there)". Only *args* were renamed; SDL still exposes `getProjectPlans` while the frontend sends `get_project_plans` (`web/src/graphql/queries/plans.ts:18`). Same C1 root cause, but the report asserts this specific surface works — it does not.
- **M3 — `delete_comment` arg mismatch.** SDL: `deleteComment(comment_id: ID!)`; frontend: `delete_comment(id: $commentId)` (`mutations/tasks.ts:127`; web SDL `task-scheduler.ts:371` `delete_comment(id: ID!)`). Will break even after op-name fix.
- **M4 — create-comment response loses new fields.** `create_comment_with_mention.rs` SELECT lacks `u.full_name, u.avatar_url`; tolerant `try_get(...).ok().flatten()` row mapping hides it → `full_name`/`avatar_url` null on `create_comment` responses (frontend selects `avatar_url` there). Queries `comment.rs`/`task_comments.rs` are correct.

## 4. Minor / notes

- `schema.graphql` is generated without `.enable_federation()` (production `create_schema` enables it), so it omits `_service`/`_Any` boilerplate — acceptable as a diff target, but it is not byte-equal to live-server SDL.
- `cargo check --tests` passes with W1b's in-flight files (`tests/auth/`, `auth/supabase.rs`, `config.rs`, `handlers.rs`): no cross-worker breakage; `tests/contract/` vs `tests/auth/` discovery layout is correct (`tests/*/main.rs`).
- Report's follow-up register is accurate and honest (Assignee.full_name `None`, members input-object mismatches, `AddProjectMemberInput` duplicated in `types/project.rs` vs `resolvers/project_member.rs`, notification web-SDL aliases, `plan_data` string vs structured, `tags` raw JSON, runtime sqlx UPPERCASE decode smoke pending). None of these gate this review; C1–C4 do.
- Review side-effects: `cargo test --test contract` regenerated `schema.graphql` — verified byte-identical (shasum unchanged), tree preserved; probe crate confined to `/tmp`.

## 5. Required rework checklist (W1a owner)

1. Add `rename_fields = "snake_case"` (keep `rename_args`) to all mounted resolver Objects; keep `PlanMutation` dual-alias strategy; regenerate SDL. (C1, M2)
2. Add `#[graphql(complex)]` to `Task` and `Notification` SimpleObject derives; verify `type:` ×2 appear inside those type blocks. (C2)
3. Pin `#[graphql(name = "type_")]` on `CreateTaskInput.type_` and `UpdateTaskInput.type_`. (C3)
4. Mount `update_task_effort` in `TaskMutation`. (M1)
5. Rename `CommentMutation::delete_comment` arg to `id` (frontend + web SDL). (M3)
6. Add `u.full_name, u.avatar_url` to create-comment SELECT. (M4)
7. Strengthen contract test per C4; re-run `cargo check` + `cargo test --test contract`; re-verify SDL contains snake ops and zero `createTask(`/`getProjectPlans(` leaks.

## 6. Unresolved questions

1. Should web-SDL-only divergences the report deliberately skipped (`mark_notification_read` Boolean alias, `invite_project_member`) be folded into the rework or stay Phase-3? (Recommend: stay Phase-3; not gating.)
2. `reorder_tasks` return type `[Task!]` vs web SDL `Boolean!` — dormant today (frontend reorders via REST). Confirm Phase-3/4 ownership.

**Verdict rationale:** REWORK, not FAIL — all claimed build/test evidence reproduces, ownership is clean, enum casing / shapes / plans aliases / schema-regen mechanics are solid, and follow-ups are honestly disclosed. But two of the three headline deliverables (B1 op names, D4 dual `type` exposure) are factually unmet on the wire while the report asserts they are confirmed, and the safeguard meant to freeze the contract (Phase-0 test) cannot detect either. Scoped, mechanical fixes; no architectural rework needed.
