# Debugger Report: Tiptap Empty Comment Guard

**Date:** 2026-03-31
**Branch:** feat/vercel-supabase-migration

---

## Root Cause

When `ReactQuill` was replaced with `AdvancedEditor` (Tiptap), empty-content checks were not updated. Tiptap emits `"<p></p>"` (or `"<p><br></p>"`) when the editor is visually blank. All existing guards used `.trim()` or plain falsy checks — both fail against these non-empty HTML strings.

### Bug 1 — `handleSubmitComment` in `TaskDetailPage.tsx` (line 826)

```ts
// BEFORE (broken)
if (!newComment.trim() || !currentUser) return;

// "<p></p>".trim() === "<p></p>" → truthy → guard is bypassed → empty comment submitted
```

### Bug 2 — Submit button disabled state in `TaskDetailPage.tsx` (line 2202)

```ts
// BEFORE (broken)
disabled={isPostingComment || !newComment}

// !newComment → false because "<p></p>" is truthy → button enabled when visually empty
```

### Bug 3 — `CommentsTab.tsx` button + mention detection

```ts
// BEFORE (broken)
disabled={isSubmittingComment || !commentText}
if (commentText) { detectMentions(...) }

// Same issue: "<p></p>" is truthy in both checks
```

---

## Fix

### New helper — `src/utils/mentionUtils.ts`

Added `isTiptapContentEmpty(html: string): boolean` — strips all HTML tags and checks if visible text remains.

### Changes

| File | Change |
|---|---|
| `src/utils/mentionUtils.ts` | Added `isTiptapContentEmpty` export |
| `src/components/tasks/TaskDetailPage.tsx` | Import + use helper in `handleSubmitComment` guard and button `disabled` prop |
| `src/components/tasks/tabs/CommentsTab.tsx` | Import + use helper in `useEffect` mention detection and button `disabled` prop |

---

## TypeScript check

`npx tsc --noEmit` — no errors in modified files. Pre-existing unrelated errors remain (field naming mismatches on `author_id`/`created_at` vs `authorId`/`createdAt` in `TaskDetailPage.tsx`, dashboard type duplicates, etc.).

---

## Unresolved Questions

- `CommentsTab` is imported in `TaskDetailPage.tsx` (line 39) but never rendered — the comment UI is inline. The import is dead code. Safe to remove but out of scope for this fix.
- Pre-existing TS errors on `data.create_comment.author_id` / `data.create_comment.created_at` (lines 926, 929, 1039, 1042) suggest the GraphQL response type `LocalTaskComment` uses camelCase fields — should be addressed separately.
