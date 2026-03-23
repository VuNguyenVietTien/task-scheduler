# Phase 05: Frontend Design Viewer

## Context Links
- [Figma API Research: SVG Overlay](reports/researcher-01-figma-api-ui-mapping.md#3-bi-directional-mapping)
- [Scout: Frontend Architecture](scout/scout-01-codebase-report.md#3-frontend-architecture)
- [Phase 04: Component Data](phase-04-figma-integration-and-component-mapping.md)

## Overview
- **Priority**: P1
- **Status**: completed
- **Effort**: 8h
- Build Next.js pages for design document viewer. Core feature: split-view with SVG-overlay design frame (left) + component description table (right). Bi-directional highlight interaction. i18n language switcher. Responsive preview modes.

## Key Insights
- Existing frontend uses Next.js 14 App Router + Apollo Client + Tailwind + MUI
- SVG overlay with viewBox scales responsively (no recalculation needed)
- Custom SVG approach preferred over libraries (full control over hotspot behavior)
- React Hook Form + Zod for form validation (existing pattern)
- TipTap editor available for rich text descriptions

## Requirements

### Functional
- **Navigation tree**: System → Module → Document → Screen (sidebar or breadcrumb)
- **Split-view**: Design frame (left ~60%) + Description table (right ~40%), resizable
- **Design frame**: Interactive SVG (pasted from clipboard), clickable `<g>` elements per component
- **Description table**: Columns: Custom ID, Component Name, DataType, DB Table, DB Column, Display Logic, Description
- **Bi-directional highlight**: Click hotspot → highlight table row; click row → highlight hotspot
- **Custom ID assignment**: Inline editable in table (1, 1.1, 1.2 hierarchical)
- **i18n switcher**: Toggle description language (en/vi/ja) via dropdown
- **Responsive preview**: Tabs for Mobile/Tablet/PC showing different Figma frames per breakpoint
- **Paste design UI**: Paste zone (Ctrl+V) to import SVG from Figma/Google Stitch clipboard

### Non-Functional
- Smooth highlight transitions (CSS transition on opacity/stroke)
- Table sortable by custom_id
- Keyboard navigation between table rows
- Loading states for Figma import (can take seconds)

## Architecture

### Page Structure
```
app/
├── designs/
│   ├── page.tsx                        # System/Module list
│   ├── [systemId]/
│   │   ├── page.tsx                    # Module list for system
│   │   └── [moduleId]/
│   │       ├── page.tsx                # Document list for module
│   │       └── [documentId]/
│   │           ├── page.tsx            # Document detail + screen tabs
│   │           └── screens/
│   │               └── [screenId]/
│   │                   └── page.tsx    # Split-view design viewer
```

### Component Structure
```
components/
├── designs/
│   ├── design-viewer-split-pane.tsx    # Split-view container (resizable)
│   ├── design-frame-interactive-svg.tsx # Interactive SVG from clipboard
│   ├── component-description-table.tsx # Right-side table
│   ├── component-row-editor.tsx        # Inline edit for table row
│   ├── paste-design-zone.tsx           # Paste zone (Ctrl+V) for SVG import
│   ├── breakpoint-tabs.tsx             # Mobile/Tablet/PC tabs
│   ├── i18n-language-switcher.tsx      # Language dropdown
│   ├── system-module-tree.tsx          # Navigation sidebar
│   ├── document-status-badge.tsx       # Status indicator
│   └── field-mapping-editor.tsx        # DB table/column picker
```

### Core Component: Interactive SVG Frame

```tsx
// design-frame-interactive-svg.tsx
interface Props {
  svgContent: string;        // Raw SVG from clipboard paste
  components: Component[];    // Mapped components with svgElementId
  selectedComponentId: string | null;
  onElementClick: (componentId: string) => void;
}

// 1. Render sanitized SVG via DOMPurify
// 2. After mount, attach click listeners to <g> elements matching component.svgElementId
// 3. On click: highlight element (add stroke/fill overlay), fire onElementClick
// 4. Selected element gets blue highlight border
// 5. SVG viewBox handles responsive scaling automatically
// 6. Unmapped elements show dashed border on hover (inviting user to assign)
```

### Core Component: Description Table

```tsx
// component-description-table.tsx
// Columns: Custom ID | Name | DataType | DB Table | DB Column | Display Logic | Description

interface Props {
  components: Component[];
  selectedComponentId: string | null;
  onRowClick: (id: string) => void;
  locale: 'en' | 'vi' | 'ja';
  onComponentUpdate: (id: string, data: Partial<Component>) => void;
}

// Table row highlights when selected (matching hotspot selection)
// Description column shows locale-specific text from JSONB
// Inline editing via React Hook Form
// Sort by custom_id (hierarchical: 1 < 1.1 < 1.2 < 2)
```

### Bi-directional Highlight State
```tsx
// Shared state in parent (design-viewer-split-pane.tsx)
const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);

// Pass to both children:
// <DesignFrameWithHotspots selectedComponentId={...} onComponentClick={setSelectedComponentId} />
// <ComponentDescriptionTable selectedComponentId={...} onRowClick={setSelectedComponentId} />

// Auto-scroll table row into view when hotspot clicked
// Auto-pan frame (if zoomed) when table row clicked
```

### GraphQL Queries
```graphql
query GetDesignScreen($screenId: UUID!) {
  screen(id: $screenId) {
    id
    name
    figmaImageUrl
    frameWidth
    frameHeight
    breakpoint
    components {
      id
      customId
      name
      componentType
      dataType
      displayLogic
      position
      descriptions
      fieldMappings {
        id
        dbTable
        dbColumn
      }
    }
  }
}

query GetDocumentWithScreens($documentId: UUID!) {
  designDocument(id: $documentId) {
    id
    name
    status
    screens {
      id
      name
      breakpoint
      figmaImageUrl
    }
    flows { id, name }
  }
}
```

### Apollo Client Setup
```ts
// graphql/design-queries.ts
// Separate query file for design-doc-service
// Apollo link points to design-doc-service URL (different port)
// Or: use Apollo link splitting to route by operation name
```

## Related Code Files
- **Reference**: `task-scheduler-frontend/src/graphql/schema.ts` - Apollo setup
- **Reference**: `task-scheduler-frontend/src/components/` - existing component patterns
- **Create**: `task-scheduler-frontend/src/app/designs/` - all page files
- **Create**: `task-scheduler-frontend/src/components/designs/` - all component files
- **Create**: `task-scheduler-frontend/src/graphql/queries/designs.ts` - GraphQL queries
- **Create**: `task-scheduler-frontend/src/graphql/mutations/designs.ts` - GraphQL mutations

## Implementation Steps
1. Create Apollo link config for design-doc-service endpoint
2. Create GraphQL query/mutation files for designs
3. Build `system-module-tree.tsx` navigation sidebar
4. Build `design-frame-with-hotspots.tsx` (PNG + SVG overlay)
5. Build `component-description-table.tsx` with inline editing
6. Build `design-viewer-split-pane.tsx` (resizable split, shared selection state)
7. Build `breakpoint-tabs.tsx` (Mobile/Tablet/PC)
8. Build `i18n-language-switcher.tsx`
9. Build `figma-import-dialog.tsx` (form + loading state)
10. Build `field-mapping-editor.tsx` (table/column picker)
11. Create page routes: `/designs/`, `/designs/[systemId]/`, etc.
12. Wire bi-directional highlight with auto-scroll
13. Add keyboard navigation (arrow keys in table, Escape to deselect)
14. Test with real imported Figma data

## Todo List
- [x] Apollo link for design-doc-service
- [x] GraphQL queries/mutations for designs
- [x] Navigation tree (system → module → document)
- [x] Design frame SVG overlay component
- [x] Description table with inline editing
- [x] Split-view container (resizable)
- [x] Bi-directional highlight interaction
- [x] Auto-scroll on selection
- [x] Breakpoint tabs (mobile/tablet/pc)
- [x] i18n language switcher
- [x] Figma import dialog
- [x] Field mapping editor
- [x] Page routes
- [x] Keyboard navigation
- [x] Loading/error states

## Success Criteria
- Click hotspot on design → corresponding table row highlights and scrolls into view
- Click table row → corresponding hotspot highlights on design
- Description shows correct language based on i18n switcher
- Breakpoint tabs switch between different screen frames
- Inline editing saves component data via GraphQL mutation
- SVG overlay scales correctly at all viewport sizes

## Risk Assessment
- **SVG performance**: Many components (>100 rects) could be slow. Mitigation: Virtualize offscreen rects, use CSS containment.
- **Split-pane responsiveness**: Resizable split can break on small screens. Mitigation: Stack vertically on mobile.
- **Apollo multi-endpoint**: Two GraphQL backends complicates client setup. Mitigation: Use Apollo Link splitting or merge via gateway.
- **Image loading**: Large PNGs slow to load. Mitigation: Export at 1x scale, lazy load, use WebP.

## Security Considerations
- JWT forwarded to design-doc-service (same token)
- Image URLs should not be publicly accessible (serve through authenticated endpoint)
- Sanitize component names rendered in SVG (prevent SVG injection)

## Unresolved Questions
1. Should split-pane ratio persist per user? (localStorage vs DB preference)
2. Export description table as CSV/Excel for stakeholders?
3. Should we support zoom/pan on design frame? (adds complexity)

## Next Steps
- Phase 06: Impact analysis UI and flow diagram rendering use this viewer as foundation
