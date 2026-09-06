# W1a — Naming, Enums & Contract Freeze (Phase 0+1) — COMPLETE

**Worker:** w1a (resumed after interruption) | **Run:** herdr-260830-2320-api-parity | **Sources:** `api_scout.md` (§9 Phase 0+1), `ledger.md` (D1–D4 decisions)
**Result:** ✅ done — `cargo check` 0 errors, contract test 7/7 passed, `backend/schema.graphql` regenerated from live schema.

## 1. Starting state (preserved work)

- No prior W1a edits existed in ownership areas; `plans/reports/herdr-260830-2320-api-parity/reports/` was empty.
- Other agents' partial work untouched and preserved: `backend/src/config.rs` (M), `backend/src/auth/supabase.rs` (new), `backend/tests/auth/` (new), `.opencode/**` deletions.
- Note: another agent created `backend/tests/auth/` during my run; my test is `backend/tests/contract/` — no collision.

## 2. Changes (all within ownership: types/**, resolvers/**, schema.graphql, tests/contract/**)

### snake_case GraphQL names (B1)
- `types/task.rs`, `types/project.rs`, `types/comment.rs`, `types/notification.rs`, `types/auth.rs`, `types/auth_payload.rs`, `types/user.rs`, `types/media_upload.rs`, `resolvers/members/types.rs`, `resolvers/tasks/mutation/update_effort.rs`: all `rename_fields = "camelCase"` → `"snake_case"` (or attr added where missing).
- All mounted `#[Object]` resolver impls got `#[Object(rename_args = "snake_case")]`: tasks, comments (query+mutation), notifications, members, plans/query, project, project_member, user, auth, media_upload.
- Manual `CommentResponse` Object (`resolvers/comments/mod.rs`) rewritten: `authorId/taskId/parentId/isDeleted/createdAt/updatedAt` → snake_case; `author_id` → `user_id` (frontend selects `user_id`).
- Legacy dead files (not compiled, commented out of `resolvers/mod.rs`): `resolvers/task.rs`, `task_resolver.rs`, `notification.rs`, `attachment.rs` — untouched.

### Frontend camelCase aliases preserved (D2)
- `resolvers/plans/mutation.rs`: PlanMutation keeps default camelCase surface (`createPlan`, `updatePlan`, `deletePlan`, `setPlanActive` = what the frontend sends) and adds snake_case web-SDL aliases `create_plan`, `update_plan`, `delete_plan`, `set_plan_active` delegating to the same methods. Plans queries got full snake_case rename (frontend sends snake there).

### Enum casing (B2)
- `TaskStatus`/`TaskPriority`: GraphQL values flipped to UPPERCASE (`TODO`…`ARCHIVED`, `LOW`…`CRITICAL`); sqlx `rename_all = "UPPERCASE"` (DB stores uppercase post `20260328000001_uppercase_task_enums.sql`); `TaskStatus::Display` → uppercase (used in dynamic SQL).
- `TaskProgressType`, `MemberRole`: kept lowercase GraphQL values + sqlx snake/lowercase (frontend + DB lowercase). Project enums keep default SCREAMING_SNAKE (matches `'ACTIVE'`, `'ON_HOLD'`).

### `type_` + `type` dual exposure (D4)
- `Task` and `Notification`: `type_` field pinned via `#[graphql(name = "type_")]` + `#[ComplexObject]` alias field `type` returning same value. Also `CreateNotificationInput.type_` pinned. SDL confirms `type_:` ×3 + `type:` ×2.

### Response/input shape fixes
- `Assignee.full_name: Option<String>` added (frontend selects it everywhere); all 26 `Assignee {` construction sites updated (currently `None` — see follow-ups).
- `CommentResponse`: added `full_name`, `avatar_url` (nullable), `username` now nullable; comment SQLs (`comments/query/comment.rs`, `task_comments.rs`) select `u.full_name, u.avatar_url`.
- `ReorderTasksInput` → `{ project_id: ID!, tasks: [TaskOrderInput!]! }` (was `taskOrders`); `reorder.rs` binds project_id into `WHERE task_id = $3 AND project_id = $4`.

### Phase 0 contract test + schema regen
- `backend/tests/contract/main.rs` (7 tests): regenerates `schema.graphql` from `Schema::build(Query, Mutation, EmptySubscription).sdl()`; asserts snake_case fields/args (and no `taskId`/`projectId`/`authorId` leaks), UPPERCASE task enums, lowercase progress/role enums, `type_`+`type`, plans dual aliases, ReorderTasksInput shape, Assignee.full_name. Note: cargo only auto-discovers `tests/*/main.rs`, not nested `.rs`.
- `backend/schema.graphql` fully regenerated (was stale legacy doc listing nonexistent ops).

## 3. Verification
- `cargo check` → 0 errors (pre-existing unused-import warnings remain, incl. some in touched files — left as-is to minimize diff).
- `cargo test --test contract` → **7 passed / 0 failed**.
- `rustfmt` applied to changed files only.
- No commit/push/deploy; no edits outside ownership.

## 4. Follow-ups (for W1b / later phases)
1. `Assignee.full_name` always `None` — populate via SQL (`au.full_name as assignee_full_name`) in task query/mutation resolvers; column exists (initial schema).
2. `create_project` return-type alignment to web `Project` shape (scout Phase 1 last bullet) — deferred (bigger resolver change).
3. `members` resolver `update_project_member` still flat args (frontend sends `input{project_id,user_id,role}`); `invite_project_member`/`add_project_member(input)` aliases missing; `AddProjectMemberInput` defined twice (types/project.rs + resolvers/project_member.rs — mounted one is now snake).
4. Web-SDL notification aliases (`mark_notification_read` → Boolean, `mark_all_notifications_read(user_id)`) not added (frontend snake ops are primary per D2).
5. `Plan.plan_data` still structured input vs frontend JSON string (Phase 3), `Task.tags` still raw JSON.
6. sqlx UPPERCASE decode only verified statically — runtime DB smoke test pending (auth phase owns DB wiring).

## 5. Browser
Not needed for this task; browsermcp untouched.
