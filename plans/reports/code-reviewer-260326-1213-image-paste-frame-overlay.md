# Code Review: Image Paste & Frame Overlay System

**Branch:** feat/v2.29
**Date:** 2026-03-26
**Files reviewed:** 14 (backend + frontend)
**LOC changed:** ~900 net additions
**Focus:** Security, logic correctness, edge cases, code quality

---

## Overall Assessment

Solid feature implementation. Architecture is clean: backend properly differentiates SVG vs image content types with appropriate validation paths, frontend introduces a well-structured canvas overlay system for frame drawing/selection. A few high-confidence issues found below.

---

## Critical Issues

### 1. [SECURITY] Base64 image data stored raw in database -- no content validation
**Files:** `screen.rs` (resolver), `use-clipboard-paste.ts`

The backend enforces a 5MB size limit for images, but does **zero content validation** on the image data. A user can paste any arbitrary string (including script payloads, SQL, or binary junk) as long as `content_type = "image"` and it's under 5MB. The string is stored in `svg_content` and later rendered as an `<img src={screen.svgContent}>`.

**Risk:** While `<img>` tags don't execute scripts from `src`, malicious data stored in the DB could be exploited by future consumers of the API (other clients, export features, etc.). Also, the data URL is not validated to be a legitimate `data:image/...` format.

**Recommendation:**
```rust
// In paste_design and update_screen resolvers, for image content:
if ct == "image" {
    if !input.svg_content.starts_with("data:image/") {
        return Err(AppError::Validation("Invalid image data format".into()).into_graphql_error());
    }
}
```

### 2. [SECURITY] `content_type` not validated -- accepts arbitrary strings
**Files:** `screen.rs` (resolver lines for update_screen, paste_design, update_design_from_paste)

The `content_type` field is used in conditional logic (`== "image"` / `== "svg"`) but no validation rejects invalid values. A user sending `content_type: "script"` would bypass both SVG sanitization and image size checks since neither `if ct == "image"` nor the `else` (SVG) block would match correctly.

Wait -- actually the `else` branch catches non-"image" values and treats them as SVG, so SVG validation runs. This is safe by accident but fragile.

**Recommendation:** Add explicit validation:
```rust
let ct = content_type.as_deref().unwrap_or("svg");
if ct != "svg" && ct != "image" {
    return Err(AppError::Validation("content_type must be 'svg' or 'image'".into()).into_graphql_error());
}
```

---

## High Priority

### 3. [BUG] `computeResize` can produce negative x/y when dragging handle past opposite edge
**File:** `frame-overlay-canvas.tsx` (line 337-356)

When a user drags the `nw` handle far past the `se` corner, `width` goes negative before being clamped to `minSize`, but `x` has already been adjusted by the full `dx`. This results in an incorrect `x` position. Same issue for `y` with vertical handles.

**Recommendation:** After clamping `width`/`height`, recalculate `x`/`y`:
```typescript
if (width < minSize) {
  if (handle === 'nw' || handle === 'w' || handle === 'sw') x = orig.x + orig.width - minSize;
  width = minSize;
}
if (height < minSize) {
  if (handle === 'nw' || handle === 'n' || handle === 'ne') y = orig.y + orig.height - minSize;
  height = minSize;
}
```

### 4. [BUG] `customId` numbering for new frames uses `screen.components?.length` which becomes stale
**File:** `design-viewer-split-pane.tsx` (line 50-51)

```typescript
const nextIndex = (screen.components?.length || 0) + 1;
const customId = String(nextIndex);
```

If a user creates multiple frames quickly before `onRefresh()` resolves, all frames get the same `customId` because `screen.components` hasn't updated yet. This leads to duplicate IDs.

**Recommendation:** Use a timestamp-based suffix or track the counter in local state that increments immediately on create.

### 5. [PERFORMANCE] `onRefresh` (refetch) called on every frame move/resize
**File:** `design-viewer-split-pane.tsx` (line 81)

The debounced `handleFrameUpdate` calls `onRefresh()` (a full GraphQL refetch) after every position update. During drag operations, this triggers a full screen refetch every 250ms. The overlay already has the correct visual position via `dragState`, so the refetch is unnecessary until mouse-up.

**Recommendation:** Remove `onRefresh()` from `handleFrameUpdate`. The `handleMouseUp` in `FrameOverlayCanvas` already calls `onFrameUpdate` which triggers the mutation. Only refetch when the mutation succeeds for the final position.

---

## Medium Priority

### 6. [CODE QUALITY] `screen: any` used pervasively
**Files:** `design-content-viewer.tsx` (line 9), `design-viewer-split-pane.tsx` (line 12)

The `screen` prop is typed as `any` in multiple components. This defeats TypeScript type safety and makes refactoring error-prone.

**Recommendation:** Create a shared `ScreenData` interface derived from the GraphQL query type:
```typescript
interface ScreenData {
  id: string;
  name: string;
  svgContent: string | null;
  contentType: string;
  frameWidth: number | null;
  frameHeight: number | null;
  components: ComponentData[];
  breakpoint: string;
}
```

### 7. [DEAD CODE] Old files not removed
**Files:** `use-clipboard-svg-paste.ts`, `design-frame-interactive-svg.tsx`

These files are no longer imported anywhere but still exist in the codebase. They should be deleted to avoid confusion.

### 8. [CODE QUALITY] `sortByCustomId` crashes on components without `customId`
**File:** `component-description-table.tsx` (line 17)

```typescript
const partsA = a.customId.split('.').map(Number);
```

If `customId` is `null` or `undefined` (which is possible for components created outside the frame system), this throws a runtime error.

**Recommendation:** Add null check:
```typescript
const partsA = (a.customId || '0').split('.').map(Number);
```

### 9. [UX] Canvas does not resize on window resize
**File:** `frame-overlay-canvas.tsx` (line 218-312)

The canvas size is set in the render `useEffect` based on `container.getBoundingClientRect()`, but there is no `ResizeObserver` to handle window/container resize. After a resize, frames will be drawn at wrong positions until a state change triggers re-render.

**Recommendation:** Add a `ResizeObserver` on the container div.

---

## Low Priority

### 10. Inline `handleInlineEdit` has no error handling
**File:** `component-description-table.tsx` (line 42-55)

The `await updateComponent(...)` call has no try/catch. A network error will result in an unhandled promise rejection.

### 11. Console.log statements left in production code
**File:** `use-clipboard-paste.ts` -- multiple `console.log('[Paste] ...')` statements. Consider using a debug utility or removing before release.

---

## Edge Cases Found by Scouting

1. **Image paste into existing SVG screen**: When `updateDesignFromPaste` is called with `content_type: "image"` on a screen that previously had SVG, the `svg_layers` data becomes meaningless but is still stored
2. **Large base64 images**: A 5MB PNG produces a ~6.7MB base64 data URL (base64 adds ~33% overhead). The 5MB check in `readImageFile` checks `file.size` (raw bytes), but the backend checks `svg_content.len()` (base64 string length). A 3.75MB image would pass frontend validation but the resulting ~5MB base64 string would pass backend too -- so this is borderline. Consider aligning the limits.
3. **Concurrent frame operations**: If two users paste designs to the same screen simultaneously, `paste_design` creates a screen then updates it in two separate queries without a transaction. Race condition could leave orphaned screens.

---

## Positive Observations

- Clean separation of concerns: clipboard hook, canvas overlay, content viewer, and split pane are well-modularized
- Good use of DOMPurify for SVG sanitization on both frontend and backend
- Debounced position updates prevent mutation spam during drag
- Keyboard shortcut (Delete/Backspace) properly checks for input/textarea focus to avoid interfering with text editing
- Canvas coordinate system mapping (content <-> viewport) is correct and handles scaling properly
- Migration is backwards-compatible with `DEFAULT 'svg'`

---

## Recommended Actions (Priority Order)

1. Validate `content_type` to only allow "svg" or "image" (backend)
2. Validate data URL format for image content (backend)
3. Fix `computeResize` negative position bug (frontend)
4. Remove `onRefresh()` from debounced position update to reduce unnecessary refetches
5. Fix `customId` collision on rapid frame creation
6. Add null guard in `sortByCustomId`
7. Add proper TypeScript interfaces for `screen` prop
8. Delete dead files (`use-clipboard-svg-paste.ts`, `design-frame-interactive-svg.tsx`)
9. Add `ResizeObserver` to canvas component

---

## Metrics

- Type Coverage: Low (multiple `any` types on screen/component props)
- Test Coverage: Not assessed (no test files for new components)
- Linting Issues: 0 (tsc passes per verification status)

## Unresolved Questions

1. Should the old `use-clipboard-svg-paste.ts` be kept as a fallback or fully removed?
2. Is there a plan for adding tests for the frame overlay canvas interactions?
3. The `paste_design` resolver does create + update in two queries -- should this be wrapped in a transaction?
