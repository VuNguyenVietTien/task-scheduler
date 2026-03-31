---
title: "Rich Text Editor Standardization"
description: "Unify all description/comment editors to use AdvancedEditor (Tiptap); add image-from-URL, delete row/column, table context menu"
status: completed
priority: P1
effort: 5h
branch: feat/vercel-supabase-migration
tags: [editor, tiptap, ui, forms]
created: 2026-03-30
completed: 2026-03-30
---

# Rich Text Editor Standardization

## Overview

The app currently has two different editor implementations:
- **Tiptap** (`AdvancedEditor` / `RichTextEditor.tsx`) — used in task detail description, CommentSection
- **React Quill** — used in `NewTaskForm.tsx` and `CommentsTab.tsx` (legacy, inconsistent)

Goal: standardize everything on Tiptap (`AdvancedEditor`), enhance it with missing features, then remove React Quill.

## Current State

| Location | Editor | File |
|---|---|---|
| Task detail description | ✅ Tiptap (AdvancedEditor) | `src/components/tasks/description/TaskDescription.tsx` |
| CommentSection (alt) | ✅ Tiptap (AdvancedEditor) | `src/components/tasks/comments/CommentSection.tsx` |
| **New task form description** | ❌ React Quill | `src/components/tasks/NewTaskForm.tsx` |
| **Comments tab editor** | ❌ React Quill | `src/components/tasks/tabs/CommentsTab.tsx` |

## Missing Features in RichTextEditor

| Feature | Status |
|---|---|
| Image from URL | ❌ Missing (only file upload) |
| Delete row | ❌ Missing (only add row) |
| Delete column | ❌ Missing (only add col) |
| Image resize | ✅ Exists |
| Table column resize | ✅ Exists (resizable: true) |

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Enhance RichTextEditor | Completed | 2h | [phase-01](./phase-01-enhance-rich-text-editor.md) |
| 2 | Standardize NewTaskForm | Completed | 1h | [phase-02](./phase-02-standardize-new-task-form.md) |
| 3 | Standardize CommentsTab | Completed | 1.5h | [phase-03-standardize-comments-tab.md](./phase-03-standardize-comments-tab.md) |
| 4 | Cleanup React Quill | Completed | 0.5h | [phase-04-cleanup-react-quill.md](./phase-04-cleanup-react-quill.md) |

## Dependencies

- Tiptap v2.11.5 already installed (no new packages needed)
- `@tiptap/extension-table`, `@tiptap/extension-image` already installed
- React Quill removal only after all replacements verified working
