---
title: "Phase 03 — Standardize CommentsTab Editor"
status: completed
priority: P1
effort: 1.5h
completed: 2026-03-30
---

# Phase 03 — Standardize CommentsTab Editor

## Context Links

- Target file: `src/components/tasks/tabs/CommentsTab.tsx`
- Editor to use: `src/components/common/AdvancedEditor.tsx`
- GraphQL mutation: `CREATE_TASK_COMMENT` (content field is HTML string)

## Overview

Replace React Quill in `CommentsTab.tsx` with `AdvancedEditor` in `compact` mode. The comment editor is a smaller input area — `mode="compact"` gives 150px min-height (vs 300px for full).

## Key Insights

- `CommentsTab.tsx` uses `ReactQuill` with a compact toolbar (bold, italic, underline, strike, lists, link, code-block, clean)
- State is managed via `commentText` / `setCommentText` props passed in from parent
- Comment submit calls a mutation with `content: commentText` (HTML string)
- `AdvancedEditor` compact mode has the same basic formatting — adequate for comments
- `@mentions` supported in `AdvancedEditor` via `projectMembers` prop — check if `CommentsTab` has access to `projectMembers`; if yes, pass through. If not, omit.
- Editor height: current `h-32` class on ReactQuill → set `minHeight="128px"` on AdvancedEditor

## Related Code Files

**Modify:**
- `src/components/tasks/tabs/CommentsTab.tsx`
  - Remove: `dynamic` import of `react-quill`, `import 'react-quill/dist/quill.snow.css'`
  - Add: `import { AdvancedEditor } from '@/components/common/AdvancedEditor'`
  - Replace: `<ReactQuill ...>` with `<AdvancedEditor ...>`

## Implementation Steps

1. Read the full CommentsTab component to understand props and state structure.

2. Remove from `CommentsTab.tsx`:
   ```typescript
   // DELETE:
   const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });
   import 'react-quill/dist/quill.snow.css';
   ```

3. Add import:
   ```typescript
   import { AdvancedEditor } from '@/components/common/AdvancedEditor';
   ```

4. Replace the ReactQuill instance with AdvancedEditor:
   ```tsx
   <AdvancedEditor
     value={commentText}
     onChange={setCommentText}
     placeholder="Thêm bình luận của bạn... (Sử dụng @ để nhắc đến người dùng)"
     mode="compact"
     minHeight="128px"
     projectMembers={projectMembers}  // pass if available in props, else omit
   />
   ```

5. Check if `CommentsTab` has a `projectMembers` prop — if not, check if it can be threaded from the parent. If threaded is complex, omit for now (mentions work in `CommentSection` already).

6. Run `npx tsc --noEmit` to verify no type errors.

## Todo List

- [x] Read `CommentsTab.tsx` fully (lines 1–end) to confirm state/props structure
- [x] Remove ReactQuill dynamic import and CSS import
- [x] Add `AdvancedEditor` import
- [x] Replace `<ReactQuill>` with `<AdvancedEditor mode="compact">`
- [x] Pass `projectMembers` if available, otherwise omit
- [x] Type-check with `npx tsc --noEmit`
- [x] Visual check: comment editor renders and submit works

## Success Criteria

- Comment editor in task detail shows Tiptap compact editor
- Submitting a comment sends HTML string to `CREATE_TASK_COMMENT` mutation unchanged
- Existing comment display (read-only) is unaffected
- No React Quill CSS/JS loaded on this page

## Risk Assessment

- **Content format**: Both Quill and Tiptap output HTML — no DB migration needed
- **Existing comments**: Rendered via `dangerouslySetInnerHTML` — Quill-generated HTML will still render correctly in Tiptap's output viewer
- **Mentions**: If `projectMembers` not available, @ mentions silently disabled in comments (acceptable trade-off)

## Next Steps

After phases 02 and 03 both pass, proceed to Phase 04 to remove React Quill packages.
