# API Parity Report — Web (Next.js) vs Rust Backend

**Agent:** api_scout (read-only) | **Date:** 2026-08-30 | **Scope:** `/Users/TienVNV/Desktop/ProjectManager/web` (Next.js backend + frontend) vs `/Users/TienVNV/Desktop/ProjectManager/backend` (Rust / Actix-web 4 / async-graphql 5.0.10 / sqlx 0.7)

## 0. How the web contract is defined

- GraphQL served at `/api/graphql` via GraphQL-Yoga: `web/src/app/api/graphql/route.ts`; schema merged from `web/src/lib/graphql/types/task-scheduler.ts` (381 lines) + `web/src/lib/graphql/types/design-doc.ts`; resolvers in `web/src/lib/graphql/resolvers/*` (data via Supabase service-role client, merged in `web/src/lib/graphql/resolvers/index.ts`).
- A **second** GraphQL endpoint `/api/design-doc` (`web/src/app/api/design-doc/route.ts`) with its own camelCase SDL in `web/src/lib/design-doc/schema.ts` + resolvers `web/src/lib/design-doc/resolvers.ts` (direct Supabase access).
- ~20 REST routes under `web/src/app/api/**` (some hit Supabase directly, some proxy to `BACKEND_URL` / `NEXT_PUBLIC_BACKEND_URL`).
- Supabase migrations: `web/supabase/migrations/` (00001_initial_schema.sql, 20260328000001_uppercase_task_enums.sql, 20260401000001_add_position_to_project_members.sql).
- **Important:** the frontend's actual wire traffic = operations in `web/src/graphql/queries|mutations/*`, `web/src/hooks/*`, `web/src/redux/features/*` — which **do not fully match the web's own schema**. This audit is against what the frontend actually sends.
- Client wiring: main Apollo client `web/src/lib/apollo-client.ts` → uri `/api/graphql`, sends Supabase `access_token` as Bearer (lines 20–33). Legacy `web/src/lib/apollo.ts` → `http://localhost:8000/graphql` (Rust dev). `web/src/apollo/client.ts` → `NEXT_PUBLIC_API_URL/graphql` (legacy). Design pages use `web/src/apollo/design-doc-client.ts` → `/api/design-doc` (see `web/src/app/designs/layout.tsx`).

## 1. Three blockers (fix first)

| # | Blocker | Evidence |
|---|---|---|
| B1 | **Naming convention.** Rust resolvers rely on async-graphql 5 defaults (fields & args → camelCase: `taskId`, `createTask`, `projectId`); the web frontend sends snake_case (`task_id`, `create_task`, `project_id`) everywhere except plans/notifications mutations. Web SDL is snake_case. Verified defaults in `~/.cargo/registry/src/*/async-graphql-derive-5.0.10/src/args.rs` (`RenameTarget::Field/Argument => RenameRule::Camel`; enum items → SCREAMING_SNAKE). | `backend/src/graphql/resolvers/tasks/mod.rs` (no rename attrs) vs `web/src/graphql/queries/tasks.ts:6` (`tasks(project_id: $projectId)`) |
| B2 | **Enum casing + DB decode.** Rust forces TaskStatus/TaskPriority/TaskProgressType/MemberRole GraphQL values lowercase (`#[graphql(name = "todo")]` — `backend/src/graphql/types/task.rs:38-48`, `types/project.rs:169-176`) and sqlx `rename_all = "lowercase"`, but the DB stores UPPERCASE task enums after `web/supabase/migrations/20260328000001_uppercase_task_enums.sql` (copied as `backend/migrations/20260328000001_uppercase_task_enums.sql`), and the frontend sends UPPERCASE status/priority (`web/src/schemas/taskForm.ts:34-56`) and lowercase progress_type/member_role (`web/src/hooks/useProjectTasks.ts:80-89`, `web/src/components/projects/MembersView.tsx:330`, `web/src/lib/utils.ts:131-133`). | sqlx decode of `'TODO'` into lowercase-mapped enum fails at runtime; GraphQL coercion fails for uppercase inputs |
| B3 | **Auth semantics.** Rust only verifies its own JWT (`backend/src/graphql/handlers.rs:47-80` → `jwt::verify_token`; context `auth: Option<Claims>` in `backend/src/graphql/context.rs`). Web sends Supabase access tokens (`web/src/lib/apollo-client.ts:20-33`, `web/src/lib/graphqlClient.ts:14-17`) and identity = `users.user_id` resolved by email (`web/src/lib/graphql/context.ts:19-34`). Every Rust resolver does `context.auth.ok_or(Unauthorized)` → all requests fail. | `backend/src/graphql/context.rs` |

## 2. GraphQL Query matrix

Legend: ✅ exists (modulo naming) · ⚠️ exists but shape differs · ❌ missing.

| Frontend operation (file) | Web schema | Rust status |
|---|---|---|
| `projects` → `project_id,name,start_date,end_date,status,member_count,progress,category,priority,visibility,icon_url,owner{user_id,email,username,full_name,avatar_url}` (`web/src/graphql/queries/project.ts:3`; used by `web/src/components/ui/navigation/Sidebar.tsx`, `ProjectList.tsx`, `create-project-modal.tsx`) | ✅ | ⚠️ `projects` exists (`backend/src/graphql/resolvers/project.rs:189`) returning `Projects` type — camelCase names; lacks `description`,`tags`,`metadata`,`created_at`; `start/end_date` are `DateTime<Utc>` vs web `String`/DATE |
| `project(project_id:)` full detail incl. `user_role`, `members{role,joined_at,user{...}}` (`queries/project.ts:20`, `queries/GetProjectById.ts`) | ✅ | ⚠️ exists (`project.rs:20`): `user_role` is lowercase `MemberRole`; `members` lacks `position`; `metadata` JSON vs String; `created_by` always `None` (`project.rs:172`) |
| `tasks(project_id, assignee_id, status)` recursive `child_tasks`, `assignee{user_id,username,full_name,avatar_url,role}`, `creator`, `type_`, `tags` (`queries/tasks.ts:5`, `queries/member.ts:22`, `queries/dashboard.ts:6` via `hooks/use-dashboard-tasks.ts`) | ✅ | ⚠️ exists (`resolvers/tasks/mod.rs:18`): camelCase args; `status` arg typed enum (lowercase) vs web `String` + frontend sends `'TODO'`; `tags: JSON` vs `[String]` |
| `task(task_id:)` incl. `creator`, `priority_order` (`queries/tasks.ts:52`) | ✅ | ⚠️ exists; Rust `Assignee` **lacks `full_name`** (`backend/src/graphql/types/task.rs:8-14`) — selected everywhere by frontend |
| `task_subtasks(task_id:)` (`queries/tasks.ts:184`) | ✅ | ⚠️ exists (`tasks/mod.rs:14`) |
| `task_comments(task_id:)` → `id,task_id,user_id,content,username,avatar_url,created_at,updated_at` (`queries/tasks.ts:166`) | ✅ | ❌ shape: Rust `CommentResponse` has **no `username`/`avatar_url`** (`backend/src/graphql/types/comment.rs:6-16`; has `author_id`) |
| `comment(id:)` | ✅ | ⚠️ exists (`resolvers/comments/query/mod.rs:17`) |
| `get_project_plans` / `get_latest_project_plan` / `get_plan` (`queries/plans.ts:11-35`) | ✅ | ⚠️ exist (`resolvers/plans/query.rs`) but default-renamed to `getProjectPlans` etc.; Rust `Plan.plan_data` structured object vs web **String** — frontend treats as opaque JSON string (`PLAN_FIELDS`) |
| `project_members(project_id:)` + `my_project_role(project_id:)` (`queries/member.ts:4-19`, `queries/projectMembers.ts:4`; consumers `MembersView.tsx`, `MembersTab.tsx`, `membersSlice.ts`) | ✅ (`position` requested by op but absent from web schema) | ⚠️ exist (`members/mod.rs:14-28`); `ProjectMember` lacks `position`; lowercase role values OK for UI (`toFrontendRole` is case-insensitive, `lib/utils.ts:135`) |
| `notifications` → `notification_id,user_id,message,type_,is_read,created_at,metadata` (`queries/notifications.ts:5`; `hooks/useNotifications.ts`, `notificationsSlice.ts`) | ✅ | ⚠️ exists (`notifications/mod.rs:17`) with extra `limit/offset` args; camelCase names |
| `notification(id:)` (`queries/notifications.ts:18`) | ❌ not in web schema | ✅ exists (`notifications/mod.rs:33`) |
| `notification_count { total unread }` (`queries/notifications.ts:31`) | ✅ | ✅ exists (`notifications/mod.rs:44`) |
| `users` / `user(user_id:)` (`queries/users.ts`; `hooks/useUsers.ts` → `ProjectDetailView.tsx`) | ❌ web `userResolvers` empty (`resolvers/user.ts`) | ⚠️ exist (`user.rs:104,124`) but `UserResponse{id,email,display_name,role,avatar_url,...}` **lacks `username`/`full_name`** |
| `tasks_paginated(page,page_size,filters: TaskFiltersInput)` (`queries/tasks.ts:93`; gated off: `isPaginationApiReady=false` in `hooks/useProjectTasks.ts:142`) | ❌ | ❌ (dormant) |
| Design-doc set: `systems(projectId)`, `system(id)`, `designDocument(id)`, `screen(id)`, `tags`, `exportDocumentForAi` (`web/src/lib/design-doc/schema.ts:165-172`; ops `graphql/queries/designs.ts`) | ✅ (on `/api/design-doc` camelCase; snake_case variants also merged into `/api/graphql`) | ❌ **nothing** in Rust backend (separate Rust service exists at repo-root `design-doc-service/` with own migrations) |

## 3. GraphQL Mutation matrix

| Frontend operation (file) | Web schema | Rust status |
|---|---|---|
| `create_project(input)` — input has `icon_url`,`is_public`; returns full Project+owner (`queries/project.ts:60`) | ✅ | ⚠️ `create_project` returns `ProjectResponse` (`project.rs:302`) — names/fields differ; input lacks `is_public`; enum values lowercase |
| `update_project(input{project_id,...})` | ✅ | ❌ **no `update_project` mutation in Rust resolvers** (only in legacy doc `backend/schema.graphql`) |
| `create_task(input)` — status/priority UPPERCASE, `type_`, `tags:[String]` (`hooks/useTaskMutations.ts`, `schemas/taskForm.ts`) | ✅ | ⚠️ exists (`tasks/mod.rs:34`); input enums lowercase → **rejection**; `type_` trailing-underscore name risk (async-graphql may expose `type`) |
| `update_task(input{task_id,...})` (`mutations/tasks.ts:59`, `useTaskFieldMutations.ts`) | ✅ | ⚠️ exists (`tasks/mod.rs:38`) |
| `update_task_status(input{task_id,status:'TODO'})` (`mutations/tasks.ts:5`) | ✅ | ⚠️ exists; Rust `UpdateTaskStatusInput.status` is `String` + case-insensitive validator (`types/task.rs:256-267`) — value OK, names camelCase |
| `update_task_effort(input{task_id,effort})` (`mutations/tasks.ts:36`, `hooks/useTaskEffort.ts:7`) | ❌ web schema has 2-arg `update_task_effort(task_id,effort)` — frontend op **already broken vs web** | ✅ Rust matches via `UpdateTaskEffortInput` (`resolvers/tasks/mutation/update_effort.rs:13-17`) once renamed snake_case |
| `delete_task(task_id)` | ✅ | ✅ (`tasks/mod.rs:46`) |
| `reorder_tasks(input{project_id, tasks:[{task_id,priority_order}]})` (web SDL) | ✅ | ⚠️ Rust input `{taskOrders:[{taskId,priorityOrder}]}` — **different fields, no project_id** (`types/task.rs:269-278`); returns `[Task!]` vs `Boolean!` |
| `create_comment(input)` / `delete_comment(id)` | ✅ | ⚠️ exist (`comments/mutation/mod.rs:18,51`) |
| `createPlan/updatePlan/deletePlan(id)/setPlanActive(id)` — **camelCase names** (`mutations/plans.ts`; `redux/features/plansSlice.ts:109-165`, `services/planService.ts`) | ❌ web schema snake_case `create_plan/update_plan` only → camelCase ops broken vs web today | ⚠️ Rust has all four (`plans/mutation.rs:55-136`) → default camelCase **matches frontend names**, but `plan_data` input is structured `PlanDataInput{tasks:[...]}` vs frontend JSON string; `CreatePlanInput` lacks `is_active` |
| `mark_notification_as_read(notification_id)` → **object** `{notification_id,is_read}` (`mutations/notifications.ts:16`) | ❌ web has `mark_notification_read` → Boolean (name+return differ) | ✅ Rust `mark_notification_as_read → Notification` (`notifications/mod.rs:66`) — matches frontend |
| `mark_all_notifications_as_read` (no args) | ❌ web has `mark_all_notifications_read(user_id)` | ✅ Rust matches frontend (`notifications/mod.rs:76`) |
| `create_notification(input)` (`mutations/notifications.ts:3`; used by `CommentsTab.tsx`) | ❌ not in web schema | ✅ exists (`notifications/mod.rs:56`) |
| `register_fcm_token(token)` | ✅ | ✅ (`user.rs:186`) |
| `invite_project_member(project_id,email,role)` / `add_project_member(input)` / `update_project_member(input{project_id,user_id,role})` / `update_multiple_members(project_id,updates)` / `remove_project_member(project_id,user_id)` / `remove_multiple_project_members(project_id,member_ids)` (`mutations/projectMember(s).ts`; `membersSlice.ts`) | ⚠️ (web lacks `remove_multiple_project_members`; `AddMemberInput` signature mismatch) | ⚠️ Rust has all (`members/mod.rs:40-86`, `project_member.rs:107-305`) but arg names camelCase and `update_project_member(projectId,userId,role)` flat args vs frontend `input` object |
| `update_member_position(project_id,user_id,position)` (`mutations/projectMember.ts:63`) | ✅ in SDL (no web resolver) | ❌ missing in Rust; DB column `position` only in web migration `20260401000001` |
| `register/login(input)` → `AuthResponse{token,expires_in,user{id,email,name,role,verified}}` (`lib/graphqlClient.ts:46-61`) | ✅ | ⚠️ Rust `AuthPayload{accessToken,refreshToken,user}` — different shape |
| Design-doc mutations: `createSystem/createModule/createDocument/updateDocument/deleteDocument/createScreen/pasteDesign/updateDesignFromPaste/clearScreenDesign/createComponent/updateComponent/deleteComponent/createFieldMapping/deleteFieldMapping/addEntityTag/removeEntityTag` (`graphql/mutations/designs.ts`; SDL `lib/design-doc/schema.ts:174-196`) | ✅ on `/api/design-doc` | ❌ none in Rust backend |
| `uploadImage/deleteImage` (`mutations/mediaUpload.ts` — **no importer found; dead**) | ❌ | ⚠️ Rust has `upload_image/delete_image` (`media_upload.rs:16,72`) |
| Reports: `createReport/updateReport/deleteReport`, `reports`, `report` (`redux/features/reportsSlice.ts:176+` live; `graphql/mutations/reports.ts`, `graphql/queries/reports.ts` dead) | ❌ | ❌ (tables `reports/report_tasks/bugs` exist in both DBs) |

## 4. Enum values — what the frontend actually sends

| Enum | Frontend sends | Web SDL | Rust today | Required Rust |
|---|---|---|---|---|
| TaskStatus | `'TODO'…'ARCHIVED'` (`web/src/schemas/taskForm.ts:34-43`, `web/src/types/task.ts:1`) | UPPERCASE | lowercase `todo`… | **UPPERCASE** |
| TaskPriority | `'LOW'…'CRITICAL'` (`schemas/taskForm.ts:44-56`) | UPPERCASE | lowercase | **UPPERCASE** |
| TaskProgressType | `'study','investigate','code','test','review_code','review_test_report','release'` (`schemas/taskForm.ts:24-31`, `useProjectTasks.ts:80-89`) | UPPERCASE | lowercase | lowercase (keep) |
| MemberRole | `'manager','leader','member','guest'` (`web/src/lib/utils.ts:131-133 toBackendRole`) | UPPERCASE | lowercase | lowercase (keep) |
| ProjectStatus/Priority/Visibility | `'ACTIVE','ON_HOLD','MEDIUM'` (`web/src/schemas/projectForm.ts:4-18`) | UPPERCASE | SCREAMING default → `ACTIVE`,`ON_HOLD` | keep (already OK) |

Note: response-side display is case-tolerant (`validateTaskStatus/validatePriority/validateProgressType` normalize, `useProjectTasks.ts:52-97`; `toFrontendRole` maps case-insensitively). The hard constraint is enum values in **variables (input side)** and sqlx↔DB decoding.

## 5. Type-level field diffs (responses)

- `Task.assignee/creator` need `full_name` (Rust `Assignee` lacks it) — `backend/src/graphql/types/task.rs:8`.
- `Task.tags` must serialize as `[String]`, not raw JSON — `types/task.rs:35`.
- `Project.metadata`: web returns `String`; Rust returns JSON object.
- `CommentResponse` needs `username`, `avatar_url` (join users).
- `ProjectMember` needs `position` (DB column only in web migration).
- Dates: web SDL returns `String` for most dates; Rust `DateTime<Utc>`/`NaiveDate` serializes ISO — frontend treats as strings, mostly tolerable; normalize `Projects.start/end_date` (DateTime vs DB DATE).
- `Plan.plan_data` must round-trip as opaque JSON string for the web frontend.

## 6. REST endpoints

Web frontend → web Next routes (these ARE the backend being replaced; Rust must cover the live ones):

| Web route (file) | Used by | Rust equivalent |
|---|---|---|
| `POST /api/auth/firebase/login` → `{success,user{id,email,name},session:{properties:{email_otp}}}` + `auth-token`/`user-session` cookies (`web/src/app/api/auth/firebase/login/route.ts:107-128`) | `web/src/contexts/AuthContext.tsx:99,159` (login + Google) | ❌ Rust `/api/v1/auth/firebase/login` returns `{token,user}` only (`backend/src/api/auth.rs:101-107`) — no Supabase magic-link/OTP session, no cookies |
| `GET /api/auth/me` (`AuthContext.tsx:63`) | session bootstrap | ❌ |
| `POST /api/auth/logout` (`AuthContext.tsx:215`) | sign-out (clears cookies) | ❌ |
| `POST /api/auth/register` (Supabase admin createUser + users row) | register page | ⚠️ Rust `/api/v1/auth/register` different shape/response |
| `POST /api/auth/google` (`web/src/lib/googleAuth.ts:41`) | Google button (forwards to backend) | ❌ |
| `GET /api/auth/get-token`, `POST /api/auth/set-cookie|set-token` | `web/src/apollo/get-auth-token.ts:22` | ❌ |
| `POST /api/auth/resend-verification` → proxies `${NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/resend-verification` (`resend-verification/route.ts:27`) | `web/src/hooks/useVerification.ts:24,52` | ❌ endpoint absent in Rust (`api/auth.rs:146-153` has no resend) |
| `POST /api/auth/send-verification` (`AuthContext.tsx:253`) | — | ❌ route doesn't even exist in web (404 today) |
| `POST /api/media/upload` → Supabase Storage `media` bucket, returns `{url,path}` (`app/api/media/upload/route.ts:22-41`); used by `web/src/services/imageService.ts` | rich text/images | ⚠️ Rust `/media/upload` writes local disk (`api/media.rs:39-70`) |
| `POST /api/attachments`, `DELETE /api/attachments/[id]` → Supabase Storage `attachments` + attachments table (`app/api/attachments/route.ts`) | task attachments | ⚠️ Rust `api/attachments.rs` exists in code but **not routed** (`api/routes.rs` mounts only auth+media) |
| `POST /api/comments`, `PUT/DELETE /api/comments/[id]` | no frontend callers found (dead) | ⚠️ Rust comments REST also unrouted |
| `GET/POST /api/projects`, `GET/PUT/DELETE /api/projects/[id]`, tasks CRUD + `kanban/reorder` + `status` + `priority` proxies to `BACKEND_URL/api/projects/...` (`app/api/projects/**`; callers `ProjectForm.tsx:69`, `useProjects.ts:17`, `useProjectDetail.ts:32`, `useStorageSync.ts:38`) | project CRUD screens | ⚠️ Rust `api/projects.rs` defines scope `/projects` (GET/POST/PUT/DELETE) but **not mounted**; path lacks `/api` prefix expected by proxies (`api/routes.rs:6-11` only `/api/v1/auth`) |
| `DELETE /api/projects/[id]/members/bulk`, `PATCH .../members/roles` (`membersSlice.ts:74,102`) | bulk member ops | ❌ route missing even in web (dir `app/api/projects/[id]/members` is EMPTY) — frontend falls back to GraphQL |
| `POST /api/dev/graphql-log` (`apollo-client.ts:55`) | dev logging only | not needed |
| `POST ${BACKEND_URL}/api/auth/refresh` (`web/src/lib/api.ts:32`) | legacy path | ❌ |

Rust REST surface actually mounted today: `backend/src/api/routes.rs` → scope `/api/v1` + `auth::config` only, plus `media::config` at `/media` (upload + serve). `api/projects.rs`, `api/comments.rs`, `api/attachments.rs`, `api/task_assignments.rs`, `api/logging.rs` are compiled but **unwired**.

## 7. Database / migrations

- Both trees converge on the same core schema (users/projects/project_members/tasks/comments/notifications/plans/…). Backend initial: `backend/migrations/20250319000000_create_initial_schema.sql`; plans table `20230705000001_create_plans_table.sql` (same `plan_id` columns as web); reports `20240616000001`; notifications update `20250408000000`; fcm `20250501000000`; member_role values manager/leader/guest added `20260325000000_report_system_refactor.sql`.
- Backend's copy of `20260328000001` additionally converts `task_snapshots.status` and `report_tasks.status` to the uppercase type (web's copy does not) — minor drift to reconcile.
- **Missing in backend DB:** `project_members.position` (web `supabase/migrations/20260401000001_add_position_to_project_members.sql`).
- Web `attachments` table (`owner_type/owner_id/file_name/file_path/file_size/file_type/uploaded_by/uploaded_at`, initial schema line 210) ≠ what web services read (`task_id/file_url/mime_type/attachment_id`, `web/src/lib/services/attachment-service.ts`) — decide canonical schema before porting.
- Auth dualism: Supabase `auth.users` + app `users` table resolved by email (`web/src/lib/graphql/context.ts:19-34`; `firebase/login` route upserts both). Rust must keep that mapping.

## 8. Realtime & storage

- Web realtime = **Supabase Realtime** postgres_changes on `tasks` (`web/src/hooks/use-realtime-tasks.ts`), `notifications` (`use-realtime-notifications.ts`), documents + presence (`use-realtime-document.ts`) via anon key — independent of the GraphQL/REST base URL. If the Supabase project stays, **Rust needs nothing**; otherwise it must reproduce those channels (web has no GraphQL subscriptions; Rust `/ws` broadcaster — `backend/src/websocket/*` — targets the mobile app, incompatible protocol).
- Storage: web uploads to Supabase Storage buckets `media`/`attachments` with public URLs. Rust stores local files under `MEDIA_UPLOAD_DIR` and serves `/media/{path}` (`api/media.rs`). To switch cleanly, Rust should write into Supabase Storage (or expose byte-identical public URL semantics).

## 9. Implementation phases (Rust side)

**Phase 0 — Contract freeze & test harness (no frontend changes)**
- Dump web Yoga SDL (introspection of `/api/graphql` + `/api/design-doc`); confirm `type_` exposure (`type` vs `type_`) under async-graphql.
- Files: new `backend/tests/contract/`; regenerate `backend/schema.graphql` as the real target (current file is a stale legacy doc listing ops not in code, e.g. `updateProject`, `assignTask`, `uploadAttachment`, old `TaskProgressType` values).

**Phase 1 — Naming & enums (biggest lever, unlocks ~80% of ops)**
- Add snake_case renaming (attribute `rename_fields`/`rename_args = "snake_case"` or per-field `name`) to all Objects/SimpleObjects/InputObjects: `backend/src/graphql/types/{project,task,comment,notification,media_upload,user}.rs`, `backend/src/graphql/resolvers/{tasks,members,comments,plans,notifications,project,project_member,user,auth}/**`.
- Flip TaskStatus/TaskPriority GraphQL values to UPPERCASE and sqlx mappings to uppercase (DB stores `'TODO'` post-migration); keep progress_type/member_role lowercase; audit `FromStr`/`Display` paths: `types/task.rs`, `types/project.rs`.
- Fix `ReorderTasksInput` to `{project_id, tasks:[TaskOrderItem{task_id,priority_order}]}`: `types/task.rs:269`, `resolvers/tasks/mutation/reorder.rs`.
- Add `full_name` to `Assignee`; add `username/avatar_url` to `CommentResponse` (join users): `types/task.rs`, `types/comment.rs`, `resolvers/comments/query/*`.
- Align `create_project` return to web `Project` shape (add `createdAt`, owner, `is_public` input): `resolvers/project.rs:302`, `types/project.rs:272`.
- Preserve camelCase aliases for the divergent ops the frontend sends camelCase (plans mutations) — e.g. keep `createPlan` AND add `create_plan`, or migrate frontend later.

**Phase 2 — Auth semantics**
- Accept Supabase JWTs (HS256 with project secret) in `graphql_handler`; resolve `users.user_id` by email mirroring `web/src/lib/graphql/context.ts`: `backend/src/graphql/handlers.rs`, new `backend/src/auth/supabase.rs`, `backend/src/graphql/context.rs`.
- Implement `/api/v1/auth/firebase/login` parity: verify Firebase ID token, upsert app `users` row, create Supabase auth user + magic-link, return `session.properties.email_otp`, set `auth-token`/`user-session` cookies: `backend/src/api/auth.rs`, `backend/src/auth/service.rs`.
- Add `/api/v1/auth/me`, `/logout`, Supabase-compatible `/register`, `/resend-verification`: `backend/src/api/auth.rs`.

**Phase 3 — Missing GraphQL surface**
- `update_project`; `update_member_position` (+ migration for `project_members.position`); `users`/`user` with `username/full_name`; align `remove_multiple_project_members` arg names; plans: accept `plan_data` as String + `is_active` in `CreatePlanInput`; notifications: keep `mark_notification_as_read → Notification` (frontend shape) + web-SDL aliases if needed; `tasks_paginated` + `TaskFiltersInput` (flip `isPaginationApiReady` later).
- Files: `resolvers/project.rs`, `resolvers/members/**`, `resolvers/plans/mutation.rs`, `types/notification.rs`, `types/task.rs`, new `backend/migrations/2026XXXX_add_member_position.sql`.

**Phase 4 — REST compatibility + storage**
- Mount & path-align REST: register `projects`, `attachments`, `comments`, `logging` scopes; add `/api`-prefixed aliases expected by web proxies (`/api/projects/...`, `/api/v1/...`): `backend/src/api/routes.rs`, `api/projects.rs`.
- Media/attachments → Supabase Storage buckets `media`/`attachments`, return `{url,path}` / `{attachment}`: `backend/src/api/media.rs`, `api/attachments.rs`, new `backend/src/storage/supabase.rs`; reconcile `attachments` table columns.

**Phase 5 — Design-doc domain**
- Either point the web design-doc Apollo client (`web/src/apollo/design-doc-client.ts`) at the existing root `design-doc-service/` (env-only change), or port its 6 queries + 16 mutations into the main backend over tables `systems/modules/design_documents/screens/components/field_mappings/flows/flow_steps/design_tags/entity_tags` (spec: `web/src/lib/design-doc/{schema,resolvers}.ts`): new module under `backend/src/graphql/`.

**Phase 6 — Reports, pagination, cleanup**
- Reports GraphQL (`reports`, `report`, `createReport/updateReport/deleteReport` + `ReportInput` per `web/src/redux/features/reportsSlice.ts`) over `reports/report_tasks/bugs`.
- Dead web ops — decide implement-vs-delete with frontend owner: `graphql/mutations/mediaUpload.ts`, `graphql/queries/{reports,projects,GetProjectById}.ts`, members REST bulk/roles, `/api/auth/send-verification`, `lib/apollo.ts` (localhost:8000).

## 10. Unresolved questions

1. Will Supabase (DB + auth + realtime + storage) remain in the stack after the switch? (Determines Phases 2/4 and realtime strategy.)
2. For ops where the frontend contradicts the web's own schema (camelCase plan mutations, `mark_notification_as_read` object return, lowercase role/progress_type enum variables, `update_task_effort(input)`): should Rust replicate frontend reality (recommended) or should the frontend be fixed to the web SDL?
3. Is `/api/design-doc` served long-term by `design-doc-service/`, or consolidated into the main backend?
4. `type_` trailing-underscore rendering under async-graphql must be confirmed by introspection before locking the Phase 1 rename strategy.
