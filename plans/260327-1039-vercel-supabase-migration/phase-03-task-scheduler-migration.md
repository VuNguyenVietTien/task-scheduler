# Phase 03: Task Scheduler Backend Migration

## Context Links
- Parent: [plan.md](./plan.md)
- Depends on: [Phase 01](./phase-01-foundation-supabase-setup.md), [Phase 02](./phase-02-graphql-yoga-server.md)
- Research: [Vercel Migration](./research/researcher-02-vercel-migration.md)
- Scope: [Backend Scope](./scout/scout-01-backend-scope.md)

## Overview
- **Date**: 2026-03-27
- **Priority**: P1
- **Status**: complete
- **Effort**: 10h
- **Description**: Rewrite all task-scheduler GraphQL resolvers + REST endpoints in TypeScript using Supabase JS client. Includes projects, tasks, users, members, notifications, plans, comments, attachments, media, auth.

## Key Insights
- ~11 queries + ~12 mutations + ~14 REST endpoints to migrate
- SQLx queries translate to Supabase JS `.select()`, `.insert()`, `.update()`, `.delete()`
- Complex joins use Supabase nested selects: `.select('*, members(*), tasks(*)')`
- File uploads move to Supabase Storage buckets
- FCM push works from serverless via firebase-admin singleton
- Auth endpoints become Next.js API routes (some already exist)

## Requirements

### Functional
- All existing GraphQL queries/mutations work identically
- All REST endpoints have equivalent API routes
- File upload/download works via Supabase Storage
- FCM notifications send from serverless functions
- Auth flow preserved (register, login, Firebase OAuth, email verify, password reset)

### Non-Functional
- Query response time comparable to Rust backend (< 500ms typical)
- File upload supports up to 10MB
- Serverless function stays within 60s timeout (Pro plan)

## Architecture

### GraphQL Resolvers → Supabase JS Translation

```
Rust SQLx Query                    →  Supabase JS Equivalent
─────────────────────────────────────────────────────────────
sqlx::query_as!(Project, "SELECT   →  supabase.from('projects')
  * FROM projects WHERE id = $1",      .select('*')
  id)                                  .eq('id', id).single()

sqlx::query!("INSERT INTO tasks    →  supabase.from('tasks')
  (title, ...) VALUES ($1, ...)",      .insert({ title, ... })
  title, ...)                          .select().single()

sqlx::query!("UPDATE projects      →  supabase.from('projects')
  SET status = $1 WHERE id = $2",      .update({ status })
  status, id)                          .eq('id', id).select().single()

Complex JOIN with filtering        →  supabase.from('projects')
                                       .select('*, members(*), tasks(*)')
                                       .eq('id', id)
```

### REST API Routes

```
web/src/app/api/
├── auth/
│   ├── register/route.ts          # POST - User registration
│   ├── login/route.ts             # POST - Email/password login
│   ├── firebase/route.ts          # POST - Firebase token auth (exists, update)
│   ├── verify-email/[token]/route.ts  # GET - Email verification
│   ├── request-password-reset/route.ts  # POST
│   ├── reset-password/route.ts    # POST
│   └── change-password/route.ts   # POST
├── comments/
│   ├── route.ts                   # POST - Create comment
│   └── [commentId]/route.ts       # PUT, DELETE
├── attachments/
│   ├── route.ts                   # POST - Upload attachment
│   └── [attachmentId]/route.ts    # DELETE
├── media/
│   ├── upload/route.ts            # POST - Upload media
│   └── [...path]/route.ts         # GET - Serve media (redirect to Supabase Storage URL)
└── notifications/                 # (existing, update)
```

### Services Layer

```
web/src/lib/services/
├── project-service.ts             # Project CRUD + access control
├── task-service.ts                # Task CRUD + filtering + status
├── user-service.ts                # User lookup, profile
├── member-service.ts              # Member management, role checks
├── notification-service.ts        # Notification CRUD, FCM push
├── plan-service.ts                # Plan CRUD, activation
├── comment-service.ts             # Comment CRUD with mentions
├── attachment-service.ts          # Attachment CRUD + storage
├── media-service.ts               # Media upload/serve via Supabase Storage
└── auth-service.ts                # Auth operations (Supabase Auth + Firebase bridge)
```

## Related Code Files

### Source (Rust - reference only)
- `backend/src/graphql/` - All resolver files
- `backend/src/db/queries/` - All SQLx query files
- `backend/src/api/` - REST endpoint handlers
- `backend/src/auth/` - Auth service, JWT, Firebase
- `backend/src/websocket/` - WebSocket (Phase 5)

### Create
- All files in `web/src/lib/graphql/resolvers/` (project, task, user, member, notification, plan, comment, attachment)
- All files in `web/src/lib/services/`
- All files in `web/src/app/api/auth/` (new routes)
- All files in `web/src/app/api/comments/`
- All files in `web/src/app/api/attachments/`
- All files in `web/src/app/api/media/`

### Modify
- `web/src/app/api/auth/` (existing routes - update to use Supabase)
- `web/src/app/api/notifications/` (existing - update)
- `web/package.json` - Add `firebase-admin` if not present

### Delete (Phase 7)
- `backend/` directory (entire Rust backend - deferred to Phase 7)

## Implementation Steps

### Step 1: Create Services Layer (4h)
1. **project-service.ts** - Translate `backend/src/db/queries/project.rs`:
   - `getProject(id)` → `.from('projects').select('*').eq('id', id).single()`
   - `getProjectsForUser(userId)` → `.from('projects').select('*, members!inner(*)').eq('members.user_id', userId)`
   - `createProject(input)` → `.from('projects').insert(input).select().single()`
   - `updateProject(id, input)` → `.from('projects').update(input).eq('id', id).select().single()`

2. **task-service.ts** - Translate `backend/src/db/queries/task.rs`:
   - `getTask(id)` → `.from('tasks').select('*, task_status(*)').eq('id', id).single()`
   - `getTasksForProject(projectId, filters)` → `.from('tasks').select('*').eq('project_id', projectId)` + dynamic filters
   - `createTask(input)` → `.from('tasks').insert(input).select().single()`
   - `updateTask(id, input)` → `.from('tasks').update(input).eq('id', id).select().single()`

3. **user-service.ts** - Translate `backend/src/db/queries/user.rs`
4. **member-service.ts** - Translate `backend/src/db/queries/member.rs`
5. **notification-service.ts** - Translate `backend/src/db/queries/notification.rs` + FCM push
6. **plan-service.ts** - Translate plan queries
7. **comment-service.ts** - Translate `backend/src/db/queries/comment.rs`
8. **attachment-service.ts** - Translate attachment queries + Supabase Storage

### Step 2: Implement GraphQL Resolvers (3h)
1. Fill in resolver stubs from Phase 2 with service calls
2. Each resolver: validate auth → call service → return result
3. Handle nested resolvers (e.g., `Project.members`, `Project.tasks`)
4. Implement input validation in resolvers

### Step 3: Implement REST API Routes (2h)
1. **Auth routes**: Register, login, Firebase login, email verify, password reset
   - Use Supabase Auth for register/login: `supabase.auth.signUp()`, `supabase.auth.signInWithPassword()`
   - Firebase bridge: verify Firebase token → create/link Supabase user
2. **Comment routes**: CRUD with auth check
3. **Attachment routes**: Upload to Supabase Storage, store reference in DB
4. **Media routes**: Upload to `media` bucket, serve via signed URLs or public URLs

### Step 4: FCM Integration (1h)
1. Create `lib/firebase-admin.ts` - singleton initialization
2. `notification-service.ts` calls `admin.messaging().send()` after DB insert
3. Module-level init pattern for serverless reuse

## Todo List
- [ ] Create project-service.ts with all CRUD operations
- [ ] Create task-service.ts with filtering and status management
- [ ] Create user-service.ts
- [ ] Create member-service.ts with role-based access
- [ ] Create notification-service.ts with FCM integration
- [ ] Create plan-service.ts
- [ ] Create comment-service.ts with mentions
- [ ] Create attachment-service.ts with Supabase Storage
- [ ] Create media-service.ts
- [ ] Create auth-service.ts (Supabase Auth + Firebase bridge)
- [ ] Implement all GraphQL resolvers (project, task, user, member, notification, plan)
- [ ] Implement GraphQL comment/attachment mutations
- [ ] Create auth API routes
- [ ] Create comment API routes
- [ ] Create attachment API routes
- [ ] Create media upload/serve routes
- [ ] Create firebase-admin singleton
- [ ] Test each resolver with GraphiQL
- [ ] Test REST endpoints with curl/Postman

## Success Criteria
- All 11 queries return correct data matching Rust backend
- All 12 mutations create/update/delete correctly
- All 14 REST endpoints respond identically
- File upload works end-to-end with Supabase Storage
- FCM notifications deliver to devices
- Auth flow works (register → verify → login → use)

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Complex SQL not expressible in Supabase JS | High | Use `supabase.rpc()` with PostgreSQL functions |
| FCM timeout in serverless | Medium | Fire-and-forget pattern; use background job if needed |
| 4.5MB payload for large task lists | Medium | Enforce pagination; limit select fields |
| Supabase rate limits on high-frequency operations | Low | Batch operations; use service role efficiently |

## Security Considerations
- All resolvers check `context.user` before executing
- Service role only for admin operations (never exposed to client context)
- Input sanitization on all mutations
- SQL injection not possible with Supabase JS (parameterized)
- File upload: validate MIME type, enforce size limits
- Rate limit auth endpoints (5 attempts/minute)

## Next Steps
- Phase 04: Design Doc Service migration (can run in parallel)
- Phase 05: Replace WebSocket with Supabase Realtime
