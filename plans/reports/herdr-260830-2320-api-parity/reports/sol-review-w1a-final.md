# SOL Final Review — W1a Rework (Second Pass)

**Reviewer:** Sol (high rigor) | **Run:** herdr-260830-2320-api-parity | **Date:** 2026-08-31
**Inputs:** `reports/sol-review-w1a.md` (REWORK, 7-item checklist), `reports/w1a-rework.md` (rework claim), current working-tree state of `backend/src/graphql/{types,resolvers}/**`, `backend/schema.graphql`, `backend/tests/contract/main.rs`.
**Method:** Independent re-verification of every checklist item against source + regenerated SDL; frontend op cross-check against `web/src/graphql/**`; full rerun of `cargo check`, `cargo check --tests`, `cargo test --test contract` with SDL byte-stability hash. No source/config files edited (probe copy in `/tmp` removed).

## Verdict: **ACCEPT**

All 7 checklist items verified in source and on the SDL wire. Build/test evidence independently reproduces. W1a scope (snake ops, `type` aliases, pins, mount, arg rename, SELECT enrichment, hardened contract test) is factually delivered; no new blocking defects found.

## Checklist verification

| # | Item | Independent evidence |
|---|---|---|
| 1 (C1+M2) | snake_case root op names | All 18 mounted Objects carry `#[Object(rename_fields = "snake_case", rename_args = "snake_case")]` (schema.rs mounts: Project/Comment/User/ProjectMember/Task/Member/Plan/Notification Query + Auth/Project/Comment/User/ProjectMember/Task/Member/MediaUpload/Notification Mutation); manual `CommentResponse` Object correctly uses `rename_fields` only (all fields argless); `PlanMutation` deliberately plain `#[Object]` + dual aliases preserved. SDL root surfaces fully snake_case (`create_task(input:`, `get_project_plans(`, `my_project_role(`, `mark_all_notifications_as_read:` …); only camelCase entries are the intentional `createPlan/updatePlan/deletePlan/setPlanActive` duals. Grep for 23 camel op leaks: **0 hits** |
| 2 (C2) | `#[graphql(complex)]` | `types/task.rs:22` `#[graphql(rename_fields = "snake_case", complex)]` on `Task`; `types/notification.rs:7` same on `Notification`. SDL blocks scoped-verified: `type Task { … type_: String … type: String }`, `type Notification { … type_: String! … type: String! }` — ComplexObject aliases now registered |
| 3 (C3) | input `type_` pins | `CreateTaskInput.type_` (task.rs:235) and `UpdateTaskInput.type_` (task.rs:260) pinned. SDL: `type_:` ×5 total; only `\ttype:` occurrences in SDL are the two intended aliases inside Task/Notification blocks (lines 283/500) — zero stray `type:` in input bodies |
| 4 (M1) | `update_task_effort` mounted | `resolvers/tasks/mod.rs:53` added to `TaskMutation`, delegates to `mutation::update_effort::update_task_effort`; SDL: `update_task_effort(input: UpdateTaskEffortInput!): Task!` |
| 5 (M3) | `delete_comment` arg | `CommentMutation::delete_comment(&self, ctx, id: ID)`; SDL: `delete_comment(id: ID!): Boolean!` (matches frontend `delete_comment(id: $commentId)`) |
| 6 (M4) | create-comment SELECT | `create_comment_with_mention.rs:259` SELECT now includes `u.full_name, u.avatar_url`; `TryFrom<PgRow> for CommentResponse` maps both via tolerant `try_get` |
| 7 (C4) | contract test hardened | 9 tests. `snake_case_root_operation_names` (23 ops incl. exact-arg forms), `no_camel_case_operation_leaks` (23 camel ops + `taskId`/`projectId:`/`authorId`), `type_aliases_scoped_to_task_and_notification_blocks` (new `type_block()` slicer — kills the old miscount class), `input_type_underscore_pins`. Enum, plans dual-alias, reorder-shape, Assignee/Comment tests retained |

## Reproduced evidence (independent rerun)

- `cargo check` → **0 errors**
- `cargo check --tests` → **0 errors** (coexists with W1b `tests/auth/`)
- `cargo test --test contract` → **9 passed / 0 failed**
- `schema.graphql` regeneration **byte-stable** across test rerun (sha256 `7992d16f…` unchanged)

### Timeline note (transient W1b breakage, not a W1a defect)
During this review, `cargo check` transiently failed with 2× E0308 in `src/api/auth.rs` + `src/auth/cookies.rs` (W1b-owned). mtime timeline proves causality: w1a files frozen ≤ 08:18:52 (rework report timestamp); W1b edited `cookies.rs` 08:26:59 and `auth.rs` 08:29:40, then self-repaired both at 08:30:52. After 08:30:52 the whole crate compiles clean and all 9 contract tests pass. No W1a file was ever implicated; no edits made by this reviewer (probe copy discarded unpatched).

## Frontend cross-check (parity sweep)

All live snake_case ops the web frontend sends exist on the backend SDL (`create_task`, `update_task`, `update_task_status`, `update_task_effort`, `delete_task`, `create_comment`, `delete_comment`, `task_comments`, `task_subtasks`, `project_members`, `my_project_role`, `get_project_plans`, `get_latest_project_plan`, `get_plan`, `mark_notification_as_read`, `mark_all_notifications_as_read`, `notifications`, `notification`, `create_project`, `add_project_member`, `update_project_member`, `remove_project_member`, `update_multiple_members`, `remove_multiple_project_members`, `upload_image`, `create_notification`, `register_fcm_token`, plans camel ops via dual aliases).

Residual camelCase/missing ops in `web/src/graphql/**` are all **non-gating, pre-existing, and previously disclosed**:
- design/reports/media ops (`createComponent`, `pasteDesign`, `exportDocumentForAi`, …) target `design-doc-service` — different service, out of scope.
- `uploadImage`/`deleteImage` documents are **dead code** (imported nowhere; `imageService.ts` uploads via REST `POST /media/upload`).
- `invite_project_member`, `update_member_role`, `update_member_position` — members surface; first review §6 Q1 + w1a follow-up register: Phase-3.
- `tasks_paginated` — guarded by `isPaginationApiReady` with `tasks` fallback; pre-existing absence.
- `reorder_tasks` return type `[Task!]` vs web SDL `Boolean!` — dormant (REST), Phase-3 per first review.

## Minor notes (non-blocking)

1. `snake_case_root_operation_names` asserts `"task("` which is substring-satisfiable by `create_task(`; the dedicated `task` op was verified present directly in SDL (`task(task_id: ID!): Task`), and the test is still far stronger than Phase-0. Optional tightening later.
2. `regenerates_schema_dot_graphql` test writes SDL on every run (side effect) — acceptable; byte-stable.
3. Cargo emits 97 warnings (pre-existing) and sqlx future-incompat notices — unrelated to W1a.

## Final disposition

- **W1a: ACCEPT.** Contract freeze (B1/B2/D2/D4 + C1–C4/M1/M3/M4) is on the wire and locked by a test that can now detect every defect class from the first review.
- Phase-3 register unchanged: notification web-SDL aliases, `invite_project_member`, members input-object shape, `reorder_tasks` return type, `tasks_paginated`, Assignee.full_name population, `plan_data` structured, `tags` JSON, runtime sqlx UPPERCASE decode smoke.
