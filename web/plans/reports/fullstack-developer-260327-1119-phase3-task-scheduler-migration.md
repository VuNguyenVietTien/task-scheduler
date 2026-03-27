# Phase Implementation Report

## Executed Phase
- Phase: Phase 3 — Task Scheduler Migration (services + resolvers)
- Plan: /Users/TienVNV/Desktop/ProjectManager/web/plans/260327-1039-vercel-supabase-migration/
- Status: completed

## Files Modified
- `src/lib/graphql/resolvers/project.ts` — full Supabase implementation (~52 lines)
- `src/lib/graphql/resolvers/task.ts` — full Supabase implementation (~60 lines)
- `src/lib/graphql/resolvers/comment.ts` — full Supabase implementation (~30 lines)
- `src/lib/graphql/resolvers/notification.ts` — full Supabase implementation (~28 lines)
- `src/lib/graphql/resolvers/plan.ts` — full Supabase implementation (~33 lines)
- `src/app/api/auth/login/route.ts` — replaced mock with Supabase signInWithPassword (~22 lines)
- `src/app/api/auth/register/route.ts` — replaced Firebase with Supabase admin.createUser + users table insert (~35 lines)
- `src/app/api/notifications/route.ts` — replaced mock with real Supabase query (~22 lines)
- `src/app/api/notifications/[id]/read/route.ts` — replaced in-memory mock with Supabase update (~24 lines)

## Files Created
- `src/lib/services/project-service.ts` — getProject, getProjectsForUser, createProject, updateProject
- `src/lib/services/task-service.ts` — getTask, getTasksForProject, getSubtasks, createTask, updateTask, updateTaskStatus, updateTaskEffort, deleteTask, reorderTasks
- `src/lib/services/user-service.ts` — getUser, getUserByEmail, getUsers
- `src/lib/services/member-service.ts` — getMembers, addMember, updateMember, removeMember
- `src/lib/services/notification-service.ts` — getNotifications, getNotificationCount, markAsRead, markAllAsRead, createNotification
- `src/lib/services/plan-service.ts` — getProjectPlans, getLatestPlan, getPlan, createPlan, updatePlan
- `src/lib/services/comment-service.ts` — getComment, getTaskComments, createComment, deleteComment (soft)
- `src/lib/services/attachment-service.ts` — getAttachments, createAttachment, deleteAttachment
- `src/lib/firebase-admin.ts` — Firebase Admin singleton (lazy init from env)
- `src/app/api/comments/route.ts` — POST create comment (auth-gated)
- `src/app/api/comments/[comment-id]/route.ts` — PUT update, DELETE soft-delete (ownership check)
- `src/app/api/attachments/route.ts` — POST upload to Supabase Storage 'attachments' bucket + DB record
- `src/app/api/attachments/[attachment-id]/route.ts` — DELETE removes from storage + DB (ownership check)
- `src/app/api/media/upload/route.ts` — POST upload to Supabase Storage 'media' bucket

## Tasks Completed
- [x] Created all 8 service files in `src/lib/services/`
- [x] Updated all 5 GraphQL resolver stubs with real service calls
- [x] All mutations call `requireAuth(ctx.user)`
- [x] Updated `auth/login` and `auth/register` routes to use Supabase
- [x] Updated `notifications` REST route to use Supabase
- [x] Created comments CRUD REST routes with ownership validation
- [x] Created attachments upload/delete REST routes with Supabase Storage
- [x] Created media upload REST route
- [x] Created Firebase Admin singleton
- [x] Installed `firebase-admin` npm package

## Tests Status
- Type check (phase 3 files only): pass — 0 errors in new/modified files
- Pre-existing type errors in other files (test fixtures, legacy components): not introduced by this phase, out of scope
- Unit tests: not run (no test files for services/resolvers in scope)

## Issues Encountered
- `notification_service.getNotificationCount`: Supabase returns `never` typed rows when selecting a single column — fixed with explicit cast `as { is_read: boolean }[]`
- `[attachment-id]/route.ts`: used `attachmentService.getAttachments` (by task_id) which returned `never[]` — replaced with direct `.from('attachments').select('*').eq('id', ...)` + explicit row cast
- `[comment-id]/route.ts`: comment service return typed as `never` — fixed with `as { user_id: string }` cast
- `firebase-admin` was not in package.json — installed automatically

## Next Steps
- Phase 5 (Real-time/WebSocket) can now use `notificationService.createNotification` for push events
- Phase 6 (Frontend Refactoring) can point existing hooks to new GraphQL resolvers
- `FIREBASE_SERVICE_ACCOUNT_KEY` env var must be set in Vercel for `firebase-admin.ts` to work
