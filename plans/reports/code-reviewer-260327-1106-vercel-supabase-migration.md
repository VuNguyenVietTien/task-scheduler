# Code Review: Vercel + Supabase Migration

**Date:** 2026-03-27 | **Branch:** feat/v2.29 | **Score: 7.0/10**

## Scope

- **Focus:** Supabase clients, GraphQL Yoga server, service layer, resolvers, auth bridge, REST endpoints, realtime hooks, Apollo client
- **Files reviewed:** ~35 files across `src/lib/supabase/`, `src/app/api/`, `src/lib/graphql/`, `src/lib/services/`, `src/services/`, `src/hooks/use-realtime-*`
- **Architecture:** 2 Rust microservices consolidated into unified Next.js + Supabase

## Overall Assessment

Solid migration structure. Clean separation between Supabase clients (server/browser/middleware), service layer, and GraphQL resolvers. Consistent patterns across resolvers. Several security gaps require immediate attention before production deployment.

---

## Critical Issues

### 1. [CRITICAL] Firebase Auth Bridge Does NOT Verify Firebase Token
**File:** `src/app/api/auth/firebase/route.ts` (line 11-12)

The `firebaseToken` is extracted from the request body but **never verified**. Any attacker can send `{ firebaseToken: "anything", email: "victim@example.com" }` and get a Supabase session for any email.

```typescript
// CURRENT: Token is accepted but never verified
const { firebaseToken, email, name, avatarUrl } = await request.json();
if (!firebaseToken || !email) { ... }
// firebaseToken is never passed to firebase-admin.auth().verifyIdToken()
```

**Fix:** Import `firebase-admin` and call `admin.auth().verifyIdToken(firebaseToken)` before trusting the email. Reject if verification fails.

### 2. [CRITICAL] Notification IDOR - Any User Can Read/Modify Other Users' Notifications
**File:** `src/lib/graphql/resolvers/notification.ts` (lines 7-13, 21-24)

`notifications(user_id)` and `mark_all_notifications_read(user_id)` accept an arbitrary `user_id` from the client. An authenticated user can query or mark-read another user's notifications by passing their ID.

**Fix:** Ignore `args.user_id` and use `ctx.user.id` instead:
```typescript
notifications: async (_, _args, ctx) => {
  requireAuth(ctx.user);
  return notificationService.getNotifications(ctx.supabaseAdmin, ctx.user.id);
},
```

### 3. [CRITICAL] Design-Doc Queries Have No Auth Checks
**Files:** `src/lib/graphql/resolvers/screen.ts` (lines 7-12), `src/lib/graphql/resolvers/document.ts` (lines 7-12), `src/lib/graphql/resolvers/system.ts` (lines 7-12), `src/lib/graphql/resolvers/module.ts` (line 7-8)

All query resolvers for `screens`, `screen`, `documents`, `document`, `systems`, `system`, `module` are **unauthenticated** -- they skip `requireAuth()`. Any anonymous user hitting `/api/graphql` can read all design documents.

**Fix:** Add `requireAuth(ctx.user)` to every query resolver, consistent with task-scheduler resolvers.

---

## High Priority

### 4. [HIGH] `supabaseAdmin` Bypasses RLS Everywhere
All resolvers use `ctx.supabaseAdmin` (service role key) for every operation. This means Supabase RLS policies are completely bypassed. Any authenticated user can access any project's data regardless of membership.

**Impact:** No row-level isolation between projects/users at the database layer.

**Fix (short-term):** Add authorization checks in resolvers (e.g., verify user is member of project before returning data).
**Fix (long-term):** Use `ctx.supabase` (user-scoped client) for read operations so RLS applies, reserve `supabaseAdmin` for cross-user operations only.

### 5. [HIGH] `listUsers()` Called Without Pagination in Auth Bridge
**File:** `src/app/api/auth/firebase/route.ts` (line 23)

```typescript
const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
```

This loads ALL users into memory on every Firebase auth request. At scale this will OOM or timeout.

**Fix:** Use `supabaseAdmin.auth.admin.getUserByEmail(email)` or `listUsers({ filter: email })` instead.

### 6. [HIGH] No File Type/Size Validation on Uploads
**Files:** `src/app/api/attachments/route.ts`, `src/app/api/media/upload/route.ts`

No MIME type allowlist, no file size limits. Attacker can upload executable files or multi-GB payloads.

**Fix:** Validate `file.type` against allowlist, enforce `file.size` limit (e.g., 10MB), and sanitize filenames.

### 7. [HIGH] `reorderTasks` - Unbounded Parallel Mutations
**File:** `src/lib/services/task-service.ts` (lines 89-97)

`Promise.all(updates)` fires N individual UPDATE queries. No transaction, no limit on array size. A malicious client can send thousands of items.

**Fix:** Add array size limit, use a database function or batch update for atomicity.

---

## Medium Priority

### 8. [MED] Excessive `as never` Type Casts
Throughout services: `insert(input as never)`, `update(input as never)`. This suppresses all type checking at the Supabase boundary. Any field name typo or wrong type passes silently.

**Fix:** Generate proper types with `npx supabase gen types typescript` (noted as TODO in `types.ts`) and remove `as never` casts.

### 9. [MED] Service Layer Input Types All `Record<string, unknown>`
All service functions accept `Record<string, unknown>` instead of typed input interfaces. Combined with `as never` casts, there is zero compile-time safety for data flowing into the database.

### 10. [MED] `getNotificationCount` Fetches All Rows to Count
**File:** `src/lib/services/notification-service.ts` (lines 17-27)

Fetches all notifications client-side to count them. Use Supabase `count` option:
```typescript
const { count } = await supabase
  .from('notifications')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', userId)
  .eq('is_read', false);
```

### 11. [MED] Apollo Client Disables Caching
**File:** `src/lib/apollo-client.ts` (lines 64-67)

`fetchPolicy: 'no-cache'` on all queries means every component mount triggers a network request. Consider `cache-and-network` for better UX.

### 12. [MED] Missing `register`/`login` Resolver Implementations
GraphQL schema defines `register` and `login` mutations but no resolver implements them. Will throw at runtime.

### 13. [MED] `delete_comment` Has No Ownership Check
**File:** `src/lib/graphql/resolvers/comment.ts` (line 22)

Any authenticated user can delete any comment. Should verify `comment.user_id === ctx.user.id`.

---

## Low Priority

### 14. [LOW] Realtime Helper Uses `as never` Casts
**File:** `src/lib/supabase/realtime.ts` -- Triple `as never` casts on `.on()` calls. Likely a Supabase SDK typing issue, but should track for upstream fix.

### 15. [LOW] Pagination Util Defined but Never Used
**File:** `src/lib/graphql/utils/pagination.ts` -- `getPaginationParams` exists but no resolver uses it. All list queries return unbounded results.

### 16. [LOW] Multiple Apollo Client Instances
Files: `src/lib/apollo-client.ts`, `src/apollo/client.ts`, `src/apollo/design-doc-client.ts`, `src/lib/apollo.ts`, `src/lib/logging-apollo-client.ts` -- Five Apollo client files. Consolidate to the new `src/lib/apollo-client.ts` and remove legacy ones.

---

## Positive Observations

- Clean Supabase client separation (server/browser/middleware) follows official patterns
- `requireAuth` assertion type guard is well-typed
- Audit trail pattern (fire-and-forget) is pragmatic for non-critical logging
- GraphQL Yoga route handler is minimal and correct
- Middleware correctly refreshes sessions and redirects unauthenticated users
- Service layer properly separates DB access from resolver logic
- Context creation properly uses `getUser()` (not `getSession()`) for server-side auth

---

## Recommended Actions (Priority Order)

1. **Verify Firebase token** in auth bridge -- blocks account takeover
2. **Add auth checks** to all design-doc query resolvers
3. **Fix notification IDOR** -- use `ctx.user.id` not `args.user_id`
4. **Add file upload validation** (type allowlist, size limit)
5. **Replace `listUsers()` with `getUserByEmail()`** in auth bridge
6. Switch resolvers from `supabaseAdmin` to `supabase` where RLS suffices
7. Generate Supabase types and remove `as never` casts
8. Add ownership check to `delete_comment`
9. Implement or remove `register`/`login` mutations from schema

## Metrics

| Metric | Value |
|--------|-------|
| Type Coverage | Low (~40%) -- `Record<string, unknown>` + `as never` pervasive |
| Auth Coverage | ~70% -- design-doc queries unprotected |
| Authorization | Weak -- no resource-level access control |
| Error Handling | Adequate -- consistent `if (error) throw error` pattern |
| Caching | None -- `no-cache` everywhere |

## Unresolved Questions

1. Is the Firebase auth bridge intended for production, or just local dev migration? If production, token verification is mandatory.
2. Are Supabase RLS policies defined at the DB level? If so, using `supabaseAdmin` defeats their purpose.
3. Why do design-doc resolvers intentionally skip auth? Is there a public-access requirement?
4. Are the legacy Apollo client files (`src/apollo/client.ts`, etc.) still imported anywhere, or can they be removed?
