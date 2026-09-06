# W1a Rework — Sol Review C1–C4 / M1 / M3 / M4 — COMPLETE

**Worker:** w1a | **Run:** herdr-260830-2320-api-parity | **Input:** `reports/sol-review-w1a.md` (verdict REWORK)
**Result:** ✅ all 7 checklist items implemented — `cargo check` 0 errors, `cargo check --tests` 0 errors, `cargo test --test contract` **9/9 passed**, SDL regenerated. Ownership clean; no commit/push.

## Checklist implementation

### 1. C1+M2 — snake_case root operation names
- All 19 mounted resolver `#[Object]`s upgraded to `#[Object(rename_fields = "snake_case", rename_args = "snake_case")]`: tasks (Query+Mutation), comments (query, mutation, manual `CommentResponse`), notifications (Query+Mutation), members (Query+Mutation), plans/query, project (Query+Mutation), project_member (×2), auth, user (×3), media_upload.
- `PlanMutation` intentionally left on plain `#[Object]` (default camelCase) + existing snake aliases — dual-alias strategy preserved.
- SDL proof: `create_task(input: CreateTaskInput!): Task!`, `update_task_effort(input: …)`, `delete_comment(id: ID!): Boolean!`, `my_project_role(project_id: ID!)`, `get_project_plans(project_id: String!)`, `task_subtasks(`, `task_comments(`, `project_members(`, `get_latest_project_plan(`, `get_plan(`, `mark_notification_as_read(`, `mark_all_notifications_as_read:`, `notification_count:` etc.
- Zero camelCase leaks: grep of regenerated SDL finds no `createTask(`, `taskComments(`, `getProjectPlans(`, `deleteComment(`, `markNotificationAsRead(`, `myProjectRole(`, `updateTaskEffort(` … (also asserted by test).

### 2. C2 — `#[graphql(complex)]` on Task/Notification
- `types/task.rs`: `#[graphql(rename_fields = "snake_case", complex)]` on `Task` derive.
- `types/notification.rs`: same on `Notification`.
- SDL proof (scoped blocks): `type Task { … type_: String … type: String }` and `type Notification { … type_: String! … type: String! }` — ComplexObject aliases now registered (were silently dropped before).

### 3. C3 — input `type_` pins
- `CreateTaskInput.type_` and `UpdateTaskInput.type_` pinned via `#[graphql(name = "type_")]` (Task/Notification/CreateNotificationInput pins already existed).
- SDL: `type_:` now ×5 total — incl. `input CreateTaskInput` and `input UpdateTaskInput`; no stray `type:` inside those input bodies.

### 4. M1 — `update_task_effort` mounted
- Added to `TaskMutation` (`resolvers/tasks/mod.rs`): `async fn update_task_effort(&self, ctx, input: UpdateTaskEffortInput) -> Result<Task>` delegating to `mutation::update_effort::update_task_effort`; imports `UpdateTaskEffortInput` from the mutation module (re-exported there). SDL: `update_task_effort(input: UpdateTaskEffortInput!): Task!`.

### 5. M3 — `delete_comment` arg renamed
- `CommentMutation::delete_comment(&self, ctx, id: ID)` — arg + logging + inner `delete_comment(pool, user_id, &id)` call updated. SDL: `delete_comment(id: ID!): Boolean!` (was `comment_id:`).

### 6. M4 — create-comment SELECT enriched
- `create_comment_with_mention.rs` returning SELECT now selects `u.full_name, u.avatar_url` alongside `u.username as name`; tolerant `try_get` mapping in `CommentResponse::try_from` picks them up → `create_comment` responses no longer null out the new fields.

### 7. C4 — contract test strengthened (`tests/contract/main.rs`, now 9 tests)
- `snake_case_root_operation_names`: asserts 23 snake ops incl. exact-arg forms (`create_task(input:`, `update_task_effort(input:`, `delete_comment(id:`; no-arg ops asserted in field form `notification_count:` / `mark_all_notifications_as_read:` — async-graphql renders argless ops without parens).
- `no_camel_case_operation_leaks`: 23 camelCase op names + `taskId`/`projectId:`/`authorId` field/arg leaks all asserted absent.
- `type_aliases_scoped_to_task_and_notification_blocks`: new `type_block()` helper slices the actual `type Task {` / `type Notification {` SDL blocks and asserts `\ttype_:` + `\ttype:` inside each (catches the C2 silent-drop and the old miscount).
- `input_type_underscore_pins`: asserts `type_:` (and no stray `\ttype:`) inside `CreateTaskInput`/`UpdateTaskInput`/`CreateNotificationInput` bodies + Task block pin.
- Existing enum-casing, plans dual-alias, reorder-shape, Assignee/Comment field tests retained.

## Verification
- `cargo check` → 0 errors; `cargo check --tests` → 0 errors (coexists with W1b `tests/auth/`).
- `cargo test --test contract` → **9 passed / 0 failed** (test regenerates `backend/schema.graphql`; rerun byte-stable).
- `rustfmt` applied to all touched files (also cleaned pre-existing trailing whitespace in `resolvers/tasks/mutation/create.rs` left by previous session's insert).
- Ownership: only `backend/src/graphql/{types,resolvers}/**`, `backend/schema.graphql`, `backend/tests/contract/**` touched. W1b's `config.rs`, `auth/supabase.rs`, `auth/**`, `api/auth.rs`, `handlers.rs`, `.env.example`, `tests/auth/` untouched (their working-tree modifications are W1b's in-flight work, preserved).
- Legacy unmounted files (`resolvers/task.rs`, `task_resolver.rs`, `notification.rs`, `attachment.rs`, `comments/mutation/create_comment.rs`, `plans/mod.rs` `#[Object] impl Plan`) deliberately left as-is (out of checklist scope; none registered in schema).

## Deviations / notes
- `create_plan(` / `update_plan(` positive assertions pass via PlanMutation aliases — no other resolver emits those names, so no ambiguity.
- Review §6 unresolved questions (web-SDL-only notification aliases, `reorder_tasks` return type) remain Phase-3 per reviewer recommendation — not addressed here.
- Follow-up register from `w1a-naming-enums.md` §4 still valid (Assignee.full_name `None` population, members input-object shape, plan_data string, tags JSON, runtime sqlx smoke).

## Reproduce
```
cd backend && cargo check && cargo check --tests && cargo test --test contract
```
