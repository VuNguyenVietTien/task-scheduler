# Phase 1: Image Paste Support

## Context Links
- [Plan overview](./plan.md)
- Hook: `frontend/src/hooks/use-clipboard-svg-paste.ts`
- Paste zone: `frontend/src/components/designs/paste-design-zone.tsx`
- Backend screen model: `design-doc-service/src/db/models/screen.rs`
- Backend screen queries: `design-doc-service/src/db/queries/screen.rs`
- Backend screen resolver: `design-doc-service/src/graphql/resolvers/screen.rs`

## Overview
- **Priority**: P1
- **Status**: pending
- **Description**: Extend clipboard handler to accept PNG/JPG images alongside SVG. Store image data as base64 data URL in `svg_content`. Add `content_type` column to differentiate SVG vs image content.

## Key Insights
- Browser clipboard API provides image files as `image/png` blobs via `event.clipboardData.files` or `navigator.clipboard.read()`
- Current `svg_content` column is TEXT type -- can store base64 data URLs without schema change
- Need a `content_type` discriminator so viewer knows whether to render `<img>` or inject SVG innerHTML
- Component `position` field already stores `{x, y, width, height}` JSON -- no change needed

## Requirements

### Functional
- User can paste PNG/JPG screenshot (e.g., from Figma screenshot, browser screenshot)
- Pasted image stored as base64 data URL in screen record
- Viewer renders image when `content_type = "image"`, SVG when `content_type = "svg"`
- Paste zone UI shows "Paste SVG or Image" messaging

### Non-Functional
- Max image size: 5MB (enforced frontend + backend)
- Base64 encoding adds ~33% overhead, so effective max file is ~3.75MB raw

## Architecture

```
Clipboard Event
  -> use-clipboard-paste.ts (renamed from use-clipboard-svg-paste.ts)
     -> detects SVG text OR image blob
     -> if image: FileReader.readAsDataURL() -> base64 string
     -> returns PasteResult { content, contentType: 'svg' | 'image', width, height, layers? }
  -> paste-design-zone.tsx
     -> calls PASTE_DESIGN mutation with content + contentType
  -> Backend screen resolver
     -> stores in svg_content + content_type columns
```

## Related Code Files

### Modify
- `frontend/src/hooks/use-clipboard-svg-paste.ts` -> rename to `use-clipboard-paste.ts`, add image handling
- `frontend/src/components/designs/paste-design-zone.tsx` -- update to pass `contentType`
- `frontend/src/graphql/mutations/designs.ts` -- add `contentType` to PASTE_DESIGN and UPDATE_DESIGN_FROM_PASTE
- `frontend/src/graphql/queries/designs.ts` -- add `contentType` to GET_SCREEN
- `design-doc-service/src/db/models/screen.rs` -- add `content_type` field
- `design-doc-service/src/db/queries/screen.rs` -- update queries for `content_type`
- `design-doc-service/src/graphql/resolvers/screen.rs` -- add `content_type` to types and inputs

### Create
- `design-doc-service/migrations/YYYYMMDD_add_content_type_to_screens.sql`

## Implementation Steps

1. **Backend migration**: Add `content_type VARCHAR(10) NOT NULL DEFAULT 'svg'` to `screens` table
2. **Backend model**: Add `content_type: String` to `Screen` struct
3. **Backend resolver**: Add `content_type` to `ScreenType`, `PasteDesignInput`, `UpdateScreenInput`. Skip SVG validation/sanitization when `content_type = "image"`.
4. **Backend query**: Update `create_screen`, `update_screen` to include `content_type`
5. **Frontend hook**: Rename `use-clipboard-svg-paste.ts` -> `use-clipboard-paste.ts`. Refactor:
   - After SVG checks fail, check `clipboardData.files` for `image/png` or `image/jpeg`
   - Read file as data URL via `FileReader`
   - Also check `navigator.clipboard.read()` for image blobs as fallback
   - Enforce 5MB max size
   - Return `{ content, contentType, width, height, layers }` (layers empty for images)
   - Get image dimensions via `new Image()` load
6. **Frontend paste zone**: Pass `contentType` through to mutations
7. **Frontend GraphQL**: Update queries/mutations to include `contentType` field
8. **Update imports**: All files importing `use-clipboard-svg-paste` must update import path

## Todo List
- [ ] Create DB migration for `content_type` column
- [ ] Update `Screen` Rust model with `content_type`
- [ ] Update screen queries to handle `content_type`
- [ ] Update GraphQL resolver types and inputs
- [ ] Skip SVG validation for image content type
- [ ] Rename and refactor clipboard hook
- [ ] Add image blob reading (PNG/JPG) to clipboard handler
- [ ] Enforce 5MB size limit
- [ ] Extract image dimensions from pasted image
- [ ] Update paste-design-zone to pass contentType
- [ ] Update GraphQL queries/mutations
- [ ] Update all import references

## Success Criteria
- Paste a PNG screenshot -> stored in DB, page reloads showing image
- Paste SVG from Figma -> still works as before
- Images over 5MB show error message
- `content_type` column correctly set to "svg" or "image"

## Risk Assessment
- **Base64 size**: Large screenshots could be 2-4MB base64. Acceptable for design doc use case.
- **Browser compatibility**: `navigator.clipboard.read()` not available in all browsers. Mitigated by checking `clipboardData.files` first (works everywhere).
- **Existing data**: Migration adds DEFAULT 'svg', so existing rows are unaffected.

## Security Considerations
- Validate image MIME type (only allow PNG/JPG)
- Enforce size limit server-side (not just client)
- No script execution risk from base64 images rendered via `<img src>`

## Next Steps
- Phase 2 will add canvas overlay on top of rendered image/SVG for frame drawing
