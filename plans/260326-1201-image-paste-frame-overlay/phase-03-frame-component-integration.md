# Phase 3: Frame-to-Component Integration

## Context Links
- [Plan overview](./plan.md)
- [Phase 2](./phase-02-frame-overlay-canvas.md)
- Component table: `frontend/src/components/designs/component-description-table.tsx`
- Split pane: `frontend/src/components/designs/design-viewer-split-pane.tsx`
- Component resolver: `design-doc-service/src/graphql/resolvers/component.rs`
- Mutations: `frontend/src/graphql/mutations/designs.ts`

## Overview
- **Priority**: P1
- **Status**: pending
- **Description**: Wire frame overlay events to component CRUD. Drawing a frame creates a component; moving/resizing updates position; deleting removes component. Component table becomes editable for frame properties.

## Key Insights
- `CreateComponentInput` already accepts `position` as JSON `{x, y, width, height}` -- perfect match
- `UpdateComponentInput` already accepts optional `position` -- can update on move/resize
- Component table needs minor updates: show position info, allow inline edit of customId/name/description
- Frame draw -> create component -> refetch -> overlay re-renders from component positions (single source of truth)
- No new backend changes needed -- existing component CRUD is sufficient

## Requirements

### Functional
- Draw frame -> auto-creates component via `CREATE_COMPONENT` mutation with position + auto-generated customId
- Move/resize frame -> calls `UPDATE_COMPONENT` with new position
- Delete frame -> calls `DELETE_COMPONENT`
- Select frame -> highlights corresponding row in component table
- Click table row -> highlights corresponding frame on overlay
- Component table allows inline edit of: customId, name, description
- Auto-increment customId (e.g., "1", "2", "3") on new frame creation
- New "description" column in table is inline-editable

### Non-Functional
- Optimistic UI for move/resize (update local state immediately, persist async)
- Refetch after create/delete to stay in sync

## Architecture

```
FrameOverlayCanvas
  onFrameCreate(rect) -> DesignViewerSplitPane
    -> CREATE_COMPONENT({ screenId, position: rect, customId: autoIncrement, name: "Component N" })
    -> refetch() -> overlay re-renders

  onFrameUpdate(id, rect) -> DesignViewerSplitPane
    -> UPDATE_COMPONENT({ id, position: rect })
    -> optimistic local state update

  onFrameDelete(id) -> DesignViewerSplitPane
    -> DELETE_COMPONENT({ id })
    -> refetch()

  onFrameSelect(id) -> setSelectedComponentId(id)
    -> ComponentDescriptionTable highlights row
    -> FrameOverlayCanvas highlights frame
```

## Related Code Files

### Modify
- `frontend/src/components/designs/design-viewer-split-pane.tsx` -- wire frame callbacks to mutations
- `frontend/src/components/designs/component-description-table.tsx` -- add description inline edit, show position info
- `frontend/src/components/designs/design-content-viewer.tsx` -- pass component data as frames

### No Backend Changes
- Existing `CreateComponentInput`, `UpdateComponentInput`, `DeleteComponent` mutations handle everything

## Implementation Steps

1. **Wire frame create in split pane**:
   - `onFrameCreate(rect)`: compute next customId from `screen.components.length + 1`, call `CREATE_COMPONENT` with `{ screenId, customId, name: "Component {N}", position: rect, componentType: "frame" }`, then `refetch()`
   - Set new component as selected after creation

2. **Wire frame update in split pane**:
   - `onFrameUpdate(componentId, newRect)`: call `UPDATE_COMPONENT` with `{ id: componentId, position: newRect }`
   - Use optimistic update: keep local state of positions, sync to server debounced (250ms)

3. **Wire frame delete in split pane**:
   - `onFrameDelete(componentId)`: call `DELETE_COMPONENT` with id, then `refetch()`
   - Clear selection if deleted component was selected

4. **Map components to frames**:
   - In `design-content-viewer.tsx`, transform `screen.components` to `Frame[]`:
     ```ts
     const frames = components.map(c => ({
       id: c.id,
       x: c.position?.x ?? 0,
       y: c.position?.y ?? 0,
       width: c.position?.width ?? 0,
       height: c.position?.height ?? 0,
       label: c.customId,
     }));
     ```
   - Only include components that have non-zero position (skip legacy SVG-mapped ones)

5. **Update component table**:
   - Add inline-editable `description` column (similar to existing `name` edit pattern)
   - Update `handleInlineEdit` to support description field via `UPDATE_COMPONENT` with `descriptions: { [locale]: value }`
   - Show position as read-only "(x, y, w, h)" column or tooltip
   - Add delete button per row

6. **Bidirectional selection sync**:
   - Already partially implemented via `selectedComponentId` state
   - Ensure frame overlay receives `selectedFrameId` prop mapped from `selectedComponentId`
   - Ensure table row click sets `selectedComponentId` (already done)

## Todo List
- [ ] Wire `onFrameCreate` -> `CREATE_COMPONENT` mutation in split pane
- [ ] Wire `onFrameUpdate` -> `UPDATE_COMPONENT` with debounce
- [ ] Wire `onFrameDelete` -> `DELETE_COMPONENT` mutation
- [ ] Map component positions to Frame[] for overlay
- [ ] Filter out zero-position components from overlay
- [ ] Add inline description editing to component table
- [ ] Add delete button per component row
- [ ] Auto-generate customId on frame creation
- [ ] Bidirectional selection sync (frame <-> table)
- [ ] Optimistic position update during drag

## Success Criteria
- Draw frame -> component appears in table with auto ID and name
- Edit name/description in table -> persists to backend
- Move frame -> position updates in DB
- Delete frame (keyboard or table button) -> component removed
- Select frame -> table row highlights; click row -> frame highlights
- Page reload shows all frames correctly positioned from stored component data

## Risk Assessment
- **Race condition on rapid create**: User draws multiple frames quickly. Mitigated by queuing creates and using refetch after each.
- **Optimistic update drift**: Local position state could diverge from server. Mitigated by refetching after debounced save completes.
- **Legacy components**: SVG-mapped components (with `svgElementId` but no meaningful position) should not appear as overlay frames. Filtered by checking `position.width > 0`.

## Security Considerations
- All mutations require auth (already enforced by backend resolvers)
- Position data is numeric only, no injection risk

## Next Steps
- After all 3 phases complete: update docs, test E2E flow, consider adding undo/redo as follow-up
