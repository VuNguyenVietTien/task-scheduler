---
title: "Phase 02 — Standardize NewTaskForm Description"
status: completed
priority: P1
effort: 1h
completed: 2026-03-30
---

# Phase 02 — Standardize NewTaskForm Description

## Context Links

- Target file: `src/components/tasks/NewTaskForm.tsx`
- Editor to use: `src/components/common/AdvancedEditor.tsx`
- Schema: `src/schemas/taskForm.ts` (description field)

## Overview

Replace React Quill in `NewTaskForm.tsx` with `AdvancedEditor`. The description is a controlled string field managed by `react-hook-form`.

## Key Insights

- `NewTaskForm.tsx` uses `react-hook-form` with `Controller` pattern (already used for tags field)
- Current description field: plain `ReactQuill` with `quillModules` toolbar config (lines 60-69)
- `quillModules` and `react-quill` import can be removed from this file after replacement
- `description` field in form schema: `z.string()` — no type changes needed
- `AdvancedEditor` accepts `value: string` and `onChange: (value: string) => void` — maps directly to Controller's `field.value` / `field.onChange`
- Use `mode="full"` to match the rich editing capability currently offered by Quill

## Related Code Files

**Modify:**
- `src/components/tasks/NewTaskForm.tsx`
  - Remove: `dynamic` import of `react-quill`, `import 'react-quill/dist/quill.snow.css'`, `quillModules` const
  - Add: `import { AdvancedEditor } from '@/components/common/AdvancedEditor'`
  - Replace: `<ReactQuill ...>` with `<AdvancedEditor ...>` inside Controller render

## Implementation Steps

1. Remove from `NewTaskForm.tsx`:
   ```typescript
   // DELETE these lines:
   const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });
   import "react-quill/dist/quill.snow.css";

   const quillModules = { toolbar: [...] };
   ```

2. Add import:
   ```typescript
   import { AdvancedEditor } from '@/components/common/AdvancedEditor';
   ```

3. Find the description field render (look for `<ReactQuill` in the form JSX). Replace with:
   ```tsx
   <Controller
     name="description"
     control={control}
     render={({ field }) => (
       <AdvancedEditor
         value={field.value || ''}
         onChange={field.onChange}
         placeholder="Mô tả task..."
         mode="full"
       />
     )}
   />
   ```
   > If the description field is not already wrapped in `Controller`, wrap it now. Check if it uses `register` instead — if so, convert to `Controller` pattern (same as `tags` field).

4. Run `npx tsc --noEmit` to verify no type errors.

## Todo List

- [x] Remove `dynamic` ReactQuill import and CSS import
- [x] Remove `quillModules` const
- [x] Add `AdvancedEditor` import
- [x] Replace `<ReactQuill>` with `<AdvancedEditor>` inside Controller
- [x] Type-check with `npx tsc --noEmit`
- [x] Visual check: description field renders correctly in create task form

## Success Criteria

- Create task form shows Tiptap editor (with toolbar) in description field
- Content typed in description is correctly passed to GraphQL `CREATE_TASK` mutation as HTML string
- No React Quill CSS/JS loaded on this page

## Risk Assessment

- **Form submission**: `AdvancedEditor` produces HTML string (same as Quill) — no API change
- **Validation**: `z.string()` schema unchanged — no issues

## Next Steps

Phase 03 (CommentsTab) is independent of this phase — can be done in parallel.
