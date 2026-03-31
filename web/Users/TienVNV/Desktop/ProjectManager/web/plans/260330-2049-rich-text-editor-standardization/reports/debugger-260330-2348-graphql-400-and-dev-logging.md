# Debugger Report: GraphQL 400 Fix + Dev Logging

Date: 2026-03-30 23:48
Branch: feat/vercel-supabase-migration

---

## Executive Summary

- **Root cause of POST /api/graphql 400**: `progress_type` sent as lowercase (`"study"`) but GraphQL schema defines `TaskProgressType` as uppercase enum (`STUDY`). GraphQL validation rejects mismatched enum value → 400.
- **Fix**: one-line `.toUpperCase()` in `NewTaskForm.tsx` `onSubmit`.
- **Logging**: Added `ApolloLink` middleware in `apollo-client.ts` + new API route `/api/dev/graphql-log` that appends every operation+response to `logs/graphql-dev.log` (dev only).

---

## Task 1: Root Cause Analysis

### Chain of events

1. `taskFormSchema` (`src/schemas/taskForm.ts`) defines `progressType` as `z.enum(['study', 'investigate', ...])` — lowercase.
2. Form default is `progressType: "study"`.
3. `onSubmit` passes `progress_type: data.progressType` → lowercase string `"study"`.
4. GraphQL schema (`task-scheduler.ts` line 36) declares:
   ```
   enum TaskProgressType { STUDY INVESTIGATE CODE TEST REVIEW_CODE REVIEW_TEST_REPORT RELEASE }
   ```
5. GraphQL-Yoga validates enum at request time → value `"study"` does not match `STUDY` → **400 Bad Request**.

### Secondary issues found (not causing 400, but bugs)

- `start_date` in `onSubmit`: `start_date: data.startDate ? new Date().toISOString() : null` — `startDate` is not in Zod schema so it is always `undefined`. Always sends `null`. Benign but wrong.
- `status` and `priority` are already uppercase (form defaults `"TODO"`, `"MEDIUM"`) — match the enum, no issue.

### Fix applied

**File:** `src/components/tasks/NewTaskForm.tsx` line ~315

```diff
- progress_type: data.progressType || null,
+ progress_type: data.progressType ? data.progressType.toUpperCase() : null,
```

Note: The server-side resolver (`resolvers/task.ts` line 33) also calls `.toLowerCase()` before writing to DB, so the round-trip is: client sends `STUDY` → resolver lowercases to `study` for Supabase → field resolver uppercases back to `STUDY` for GraphQL response. The fix aligns client with this contract.

---

## Task 2: GraphQL Dev Logging

### Files created/modified

| File | Action |
|---|---|
| `src/lib/apollo-client.ts` | Added `devLoggerMiddleware` ApolloLink + inserted first in link chain |
| `src/app/api/dev/graphql-log/route.ts` | New Next.js API route: accepts POST, appends to `logs/graphql-dev.log` |
| `logs/` directory | Created; added to `.gitignore` |
| `.gitignore` | Added `/logs/` entry |

### How it works

1. `devLoggerMiddleware` is the first link — intercepts every operation.
2. In non-dev (`NODE_ENV !== 'development'`) it passes through instantly (zero overhead).
3. In dev: after response arrives, fires `fetch('/api/dev/graphql-log', ...)` (fire-and-forget, never throws).
4. API route writes to `process.cwd()/logs/graphql-dev.log` with format:
   ```
   [2026-03-30T16:48:00.000Z] === GraphQL mutation: CreateTask ===
   Variables: { "input": { ... } }
   Response: { ... }
   ```
5. Route returns 403 if called outside development (safety guard).

### TypeScript

`npx tsc --noEmit` — zero errors in all three modified/created files. All pre-existing errors are in unrelated files (`CommentForm.tsx`, `LoginForm.tsx`, etc.).

---

## Files Changed

- `/Users/TienVNV/Desktop/ProjectManager/web/src/components/tasks/NewTaskForm.tsx` — line ~315 `progress_type` fix
- `/Users/TienVNV/Desktop/ProjectManager/web/src/lib/apollo-client.ts` — dev logger link added
- `/Users/TienVNV/Desktop/ProjectManager/web/src/app/api/dev/graphql-log/route.ts` — new file
- `/Users/TienVNV/Desktop/ProjectManager/web/.gitignore` — `/logs/` added

---

## Unresolved Questions

- `startDate` field missing from Zod schema — if `start_date` is intentionally always `null` on create that is fine, but if the field is desired, it needs a Zod entry and a form input.
- `description` Zod rule `min(1)` means an empty AdvancedEditor (blank HTML `<p></p>`) may still fail validation even though visually not empty — depends on what Tiptap outputs for an empty editor. Worth verifying.
