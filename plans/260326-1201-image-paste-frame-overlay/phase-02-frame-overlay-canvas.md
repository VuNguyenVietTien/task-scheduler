# Phase 2: Frame Overlay Canvas

## Context Links
- [Plan overview](./plan.md)
- [Phase 1](./phase-01-image-paste-support.md)
- Viewer: `frontend/src/components/designs/design-frame-interactive-svg.tsx`
- Split pane: `frontend/src/components/designs/design-viewer-split-pane.tsx`

## Overview
- **Priority**: P1
- **Status**: pending
- **Description**: Create a transparent canvas overlay on top of the image/SVG viewer where users draw rectangles (frames) by click-drag. Frames are visually rendered as colored rectangles with labels. Supports select, move, resize, delete.

## Key Insights
- HTML5 Canvas sits absolutely positioned over the image/SVG container
- Frame data stored as component `position` objects: `{x, y, width, height}` -- already in schema
- Coordinates must be normalized to image/SVG dimensions (not viewport pixels) for consistency across zoom levels
- Keep overlay as a standalone component for reuse and testability
- Existing `design-frame-interactive-svg.tsx` renders SVG only. New component replaces it as the primary viewer, wrapping both SVG and image content.

## Requirements

### Functional
- User draws rectangle by click-drag on overlay canvas
- Drawn frames appear as semi-transparent colored rectangles with border
- Each frame shows its customId label at top-left corner
- Click a frame to select it (highlighted border)
- Selected frame shows resize handles (8 corners/edges)
- Drag selected frame to reposition
- Press Delete/Backspace to remove selected frame
- Double-click frame to focus its row in component table
- Toolbar toggle: "Draw mode" vs "Select mode"

### Non-Functional
- Smooth 60fps rendering during drag operations
- Support zoom via container scroll (coordinates stay consistent)
- Mobile-friendly: touch events for draw/move (stretch goal)

## Architecture

```
DesignViewerSplitPane
  |-- DesignContentViewer (new, replaces DesignFrameInteractiveSvg)
  |     |-- <img> or <svg> (based on contentType)
  |     |-- FrameOverlayCanvas (new, absolutely positioned over content)
  |           |-- HTML5 Canvas for drawing/interaction
  |           |-- Renders frames from components[].position
  |           |-- Emits: onFrameCreate, onFrameUpdate, onFrameSelect, onFrameDelete
  |-- ComponentDescriptionTable (existing, minor updates)
```

### Coordinate System
- All frame coordinates normalized to content dimensions (0-based, pixel units matching image/SVG natural size)
- Canvas renders at container size; mouse coords translated: `(mouseX / containerWidth) * contentWidth`
- This ensures frames stay correct regardless of viewport size or zoom

## Related Code Files

### Create
- `frontend/src/components/designs/frame-overlay-canvas.tsx` -- Canvas overlay component
- `frontend/src/components/designs/design-content-viewer.tsx` -- Unified viewer (SVG or image + overlay)

### Modify
- `frontend/src/components/designs/design-viewer-split-pane.tsx` -- Use `DesignContentViewer` instead of `DesignFrameInteractiveSvg`

## Implementation Steps

1. **Create `frame-overlay-canvas.tsx`**:
   - Props: `frames: Frame[]`, `contentWidth`, `contentHeight`, `selectedFrameId`, `mode: 'draw' | 'select'`
   - Callbacks: `onFrameCreate(rect)`, `onFrameUpdate(id, rect)`, `onFrameSelect(id)`, `onFrameDelete(id)`
   - Uses `useRef<HTMLCanvasElement>` with `useEffect` render loop
   - Mouse event handlers: `onMouseDown`, `onMouseMove`, `onMouseUp` for draw/select/move/resize
   - Draw mode: click-drag creates new rectangle, emits `onFrameCreate` on mouseup
   - Select mode: click selects frame, drag moves it, corner handles resize
   - Render loop: clear canvas, draw all frames as semi-transparent rects, highlight selected, draw labels
   - Resize handles: 8 small squares at corners and midpoints of selected frame

2. **Create `design-content-viewer.tsx`**:
   - Props: `screen`, `components`, `selectedComponentId`, `mode`, callbacks
   - Renders `<img>` for image content, injects SVG for svg content (reuse sanitizer)
   - Wraps content in `relative` container, overlays `FrameOverlayCanvas` with `absolute inset-0`
   - Measures content natural dimensions for coordinate normalization
   - Passes component positions as frames to overlay

3. **Update `design-viewer-split-pane.tsx`**:
   - Replace `DesignFrameInteractiveSvg` with `DesignContentViewer`
   - Add mode toggle button (Draw/Select) in toolbar
   - Wire frame callbacks to component CRUD

4. **Frame type definition**:
   ```ts
   interface Frame {
     id: string;
     x: number; y: number; width: number; height: number;
     label: string;
     color?: string;
   }
   ```

## Todo List
- [ ] Define Frame interface and types
- [ ] Implement `frame-overlay-canvas.tsx` with draw mode
- [ ] Add select mode with click-to-select
- [ ] Add frame move via drag in select mode
- [ ] Add resize handles (8-point) for selected frame
- [ ] Add Delete/Backspace to remove selected frame
- [ ] Add frame label rendering (customId)
- [ ] Implement `design-content-viewer.tsx` wrapping image/SVG + overlay
- [ ] Add coordinate normalization (viewport -> content space)
- [ ] Update `design-viewer-split-pane.tsx` with mode toggle
- [ ] Wire overlay callbacks to split pane state

## Success Criteria
- Draw rectangle on image -> colored frame appears
- Click frame -> selects it with highlight
- Drag frame -> repositions smoothly
- Resize handles work correctly
- Delete key removes selected frame
- Frames render correctly after page reload (from component positions)
- SVG content still works with overlay

## Risk Assessment
- **Canvas coordinate precision**: Must handle container scroll offset and any CSS transforms. Mitigated by using `getBoundingClientRect()` for mouse translation.
- **Performance with many frames**: Canvas redraws all frames each mouse move. For <100 frames (typical), this is negligible.
- **SVG click-through**: Existing SVG element click mapping (for unmapped elements) will be replaced by frame overlay. This is intentional -- frame overlay is the new interaction model.

## Security Considerations
- No user input rendered as HTML from canvas operations
- Frame data is numeric coordinates only

## Next Steps
- Phase 3 connects frame create/update/delete events to GraphQL component CRUD mutations
