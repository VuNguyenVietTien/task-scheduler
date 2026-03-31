---
title: "Phase 01 — Enhance RichTextEditor"
status: completed
priority: P1
effort: 2h
completed: 2026-03-30
---

# Phase 01 — Enhance RichTextEditor

## Context Links
- Core editor: `src/components/common/RichTextEditor.tsx` (1248 lines)
- Wrapper: `src/components/common/AdvancedEditor.tsx`

## Overview

Enhance `RichTextEditor.tsx` with missing features without changing the public API:
1. **Image from URL** — add an inline URL input dialog alongside the existing file upload
2. **Delete row** / **Delete column** toolbar buttons — show when cursor is inside a table
3. Minor toolbar UX polish (optional: icons instead of "+H"/"+C" text labels)

## Key Insights

- `addImage()` currently only triggers `fileInputRef.current.click()` — no URL path at all
- Table toolbar shows when `editor.isActive("table")`: has `+H`, `+C`, `Trash2 (delete table)` — missing delete row/col
- Tiptap commands for delete: `deleteRow()`, `deleteColumn()` — already available via `@tiptap/extension-table`
- `ResizableImageComponent` already handles image resize via drag handles — no changes needed
- Table `resizable: true` already set — Tiptap handles column resize via drag — no changes needed
- File size: 1248 lines — close to 200-line guideline; consider extracting toolbar sub-components if further growth occurs. For this phase keep changes minimal and targeted.

## Requirements

- Image insert via URL: show a small inline input (not a blocking `window.prompt`) when user clicks image button and selects "From URL"
- Image insert via file: keep existing behavior
- Delete row: button appears when `editor.isActive("table")`, calls `editor.chain().focus().deleteRow().run()`
- Delete column: same, calls `editor.chain().focus().deleteColumn().run()`

## Architecture

Image button → dropdown with two options:
```
[🖼️ Image ▾]
  ├── 📁 Upload from file  (triggers hidden file input)
  └── 🔗 Insert from URL  (shows inline URL input below toolbar)
```

URL input state lives in component: `const [imageUrlInput, setImageUrlInput] = useState<string | null>(null)`
- `null` = hidden, `""` = visible/empty, `"https://..."` = filled
- On confirm: `editor.chain().focus().setImage({ src: imageUrlInput }).run()` then reset to `null`
- On cancel: reset to `null`

Table toolbar (when inside table):
```
[+H] [+C] [-H] [-C] [🗑️ table]
```
Where `-H` = delete row, `-C` = delete column (use same text label style as existing `+H`/`+C` for consistency)

## Related Code Files

**Modify:**
- `src/components/common/RichTextEditor.tsx` — add URL input state, URL image handler, delete row/col buttons

**No changes needed:**
- `src/components/common/AdvancedEditor.tsx` — API unchanged

## Implementation Steps

1. In `RichTextEditor.tsx`, add state:
   ```typescript
   const [showImageUrlInput, setShowImageUrlInput] = useState(false)
   const [imageUrlValue, setImageUrlValue] = useState('')
   ```

2. Add `addImageFromUrl` handler:
   ```typescript
   const addImageFromUrl = () => {
     if (!imageUrlValue.trim() || !editor) return
     editor.chain().focus().setImage({ src: imageUrlValue.trim() }).run()
     setImageUrlValue('')
     setShowImageUrlInput(false)
   }
   ```

3. Replace current single image toolbar button with a split button group:
   ```tsx
   {/* Image: file upload */}
   <button type="button" onClick={addImage} className="toolbar-item" title="Upload image">
     <ImageIcon size={16} />
   </button>
   {/* Image: from URL toggle */}
   <button type="button" onClick={() => setShowImageUrlInput(v => !v)} className={`toolbar-item ${showImageUrlInput ? 'is-active' : ''}`} title="Insert image from URL">
     <span className="text-xs font-medium">URL</span>
   </button>
   ```

4. Add inline URL input below toolbar (inside the toolbar div, after the button rows):
   ```tsx
   {showImageUrlInput && (
     <div className="flex items-center gap-2 px-2 py-1.5 border-t border-gray-200 bg-gray-50 w-full">
       <input
         type="url"
         value={imageUrlValue}
         onChange={e => setImageUrlValue(e.target.value)}
         onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addImageFromUrl(); } if (e.key === 'Escape') { setShowImageUrlInput(false); setImageUrlValue(''); } }}
         placeholder="https://example.com/image.png"
         className="flex-1 text-sm px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-300"
         autoFocus
       />
       <button type="button" onClick={addImageFromUrl} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Chèn</button>
       <button type="button" onClick={() => { setShowImageUrlInput(false); setImageUrlValue(''); }} className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Hủy</button>
     </div>
   )}
   ```

5. Add delete row/column buttons in the table-active block:
   ```tsx
   <button type="button" onClick={() => editor?.chain().focus().deleteRow().run()} className="toolbar-item" title="Xóa hàng">
     <span className="text-xs font-medium">-H</span>
   </button>
   <button type="button" onClick={() => editor?.chain().focus().deleteColumn().run()} className="toolbar-item" title="Xóa cột">
     <span className="text-xs font-medium">-C</span>
   </button>
   ```

6. Run `npx tsc --noEmit` to verify no type errors.

## Todo List

- [x] Add `showImageUrlInput` / `imageUrlValue` state
- [x] Add `addImageFromUrl` function
- [x] Add "URL" toggle button next to image upload button
- [x] Add inline URL input panel below toolbar
- [x] Add delete row (`-H`) button in table-active section
- [x] Add delete column (`-C`) button in table-active section
- [x] Type-check with `npx tsc --noEmit`

## Success Criteria

- Can insert image by URL: paste URL, press Enter or click "Chèn" → image appears in editor
- Can insert image by file: existing behavior unchanged
- Delete row button appears when cursor is in a table → deletes current row
- Delete column button appears when cursor is in a table → deletes current column
- No TypeScript errors introduced

## Risk Assessment

- **File size**: Adding ~30 lines to a 1248-line file. If file grows past 1300 lines, consider extracting `EditorToolbar` into `src/components/common/editor-toolbar.tsx` (but only if needed).
- **URL injection**: Only inserting as `src` attr in Tiptap node — no `dangerouslySetInnerHTML` risk. URLs are not executed.

## Security Considerations

- Image URL is set as `src` attribute only — no XSS risk from Tiptap's `setImage`
- File upload creates a local blob URL via `imageService.createTempImage` — no server-side upload in this component (handled upstream)

## Next Steps

Phase 02 depends on this phase being stable (AdvancedEditor API unchanged).
