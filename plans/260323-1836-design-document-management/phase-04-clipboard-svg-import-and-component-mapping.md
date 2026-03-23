# Phase 04: Clipboard SVG Import & Component Mapping

<!-- Updated: Validation Session 1 - Changed from Figma REST API to clipboard-based SVG paste -->

## Context Links
- [Figma API Research](reports/researcher-01-figma-api-ui-mapping.md)
- [Phase 01: Components Table](phase-01-database-schema-and-migrations.md)
- [Phase 03: Screen CRUD](phase-03-design-document-crud-and-versioning.md)

## Overview
- **Priority**: P1
- **Status**: completed
- **Effort**: 8h
- Users copy frames/components from Figma or Google Stitch, paste into web app. App extracts SVG from clipboard, renders with exact dimensions/colors/proportions. No Figma API token needed.

## Key Insights
- Figma clipboard contains multiple formats: `image/svg+xml`, `text/html` (with embedded SVG), and `image/png`
- SVG preserves vector data, colors, gradients, fonts, dimensions - renders identically to Figma
- Browser Clipboard API (`navigator.clipboard.read()`) can extract SVG MIME type
- SVG elements have unique IDs from Figma (layer names) - usable for hotspot mapping
- Google Stitch also copies SVG to clipboard
- Read-only render: to edit design, re-copy from Figma and paste again

## Requirements

### Functional
- **Clipboard paste**: Copy from Figma/Google Stitch → Ctrl+V in web app → SVG extracted & rendered
- **SVG parsing**: Extract viewBox, dimensions, layer structure from pasted SVG
- **Component detection**: Parse SVG groups/layers as selectable components (each `<g>` with ID)
- **Interactive SVG**: Click any SVG element → select it → assign custom ID, name, description
- **Component CRUD**: custom_id, name, data_type, descriptions (i18n), display_logic
- **Field mapping CRUD**: component → db_table.db_column
- **Re-paste**: Paste updated design → merge with existing component assignments (match by SVG element ID)
- **SVG storage**: Store raw SVG in DB (TEXT column) for re-rendering without re-paste

### Non-Functional
- SVG sanitization (prevent XSS via malicious SVG)
- Max SVG size limit (default 5MB)
- Preserve SVG fidelity: gradients, masks, filters, text, embedded images

## Architecture

### Clipboard Paste Flow
```
1. User copies frame/component in Figma (Ctrl+C)
2. User navigates to screen in web app, presses Ctrl+V
3. Frontend: navigator.clipboard.read() → get ClipboardItem
4. Extract 'image/svg+xml' blob → convert to string
5. Parse SVG: extract viewBox, all <g> elements with IDs
6. Sanitize SVG (DOMPurify with SVG profile)
7. Send to backend: mutation pasteDesign(svg, layers, metadata)
8. Backend stores: raw SVG + extracted layer tree (JSONB)
9. Frontend renders interactive SVG with selectable layers
```

### SVG Layer Extraction (Frontend)
```typescript
interface SVGLayer {
  svgElementId: string;  // Figma layer ID in SVG
  tagName: string;       // g, rect, text, path, etc.
  label: string;         // Layer name from id/class/aria-label
  bbox: { x: number; y: number; width: number; height: number };
  children: SVGLayer[];
}

function extractLayers(svgElement: SVGElement): SVGLayer[] {
  // Walk SVG DOM tree
  // Extract <g> groups with meaningful IDs
  // Calculate bounding box via getBBox()
  // Return hierarchical layer structure
}
```

### Interactive SVG Component (Frontend)
```tsx
interface DesignFrameProps {
  svgContent: string;
  components: Component[];
  selectedComponentId: string | null;
  onElementClick: (svgElementId: string, bbox: BBox) => void;
}
// Render sanitized SVG, add click listeners to <g> elements
// Highlight selected element with overlay stroke/fill
// Scale via CSS width:100% (SVG viewBox handles proportions)
```

### DB Schema Changes (update Phase 01)
```sql
-- screens table: replace figma columns with SVG columns
-- Remove: figma_node_id, figma_image_url
-- Add:
ALTER TABLE screens ADD COLUMN svg_content TEXT;        -- raw sanitized SVG
ALTER TABLE screens ADD COLUMN svg_layers JSONB;        -- extracted layer tree

-- components table: replace figma_node_id with svg_element_id
-- Remove: figma_node_id
ALTER TABLE components ADD COLUMN svg_element_id VARCHAR(255);  -- links to SVG <g> element
```

### GraphQL Schema
```graphql
type Screen {
  id: UUID!
  documentId: UUID!
  name: String!
  svgContent: String!
  svgLayers: JSON!
  frameWidth: Int
  frameHeight: Int
  breakpoint: Breakpoint!
  components: [Component!]!
}

type Component {
  id: UUID!
  screenId: UUID!
  customId: String!
  name: String!
  svgElementId: String!
  componentType: String
  dataType: String
  displayLogic: String
  position: JSON!
  descriptions: JSON!
  fieldMappings: [FieldMapping!]!
  tags: [Tag!]!
}

input PasteDesignInput {
  documentId: UUID!
  screenName: String!
  svgContent: String!
  svgLayers: JSON!
  breakpoint: Breakpoint!
}

type Mutation {
  pasteDesign(input: PasteDesignInput!): Screen!
  updateDesignFromPaste(screenId: UUID!, svgContent: String!, svgLayers: JSON!): Screen!
  createComponent(input: CreateComponentInput!): Component!
  updateComponent(input: UpdateComponentInput!): Component!
  deleteComponent(id: UUID!): Boolean!
  createFieldMapping(input: CreateFieldMappingInput!): FieldMapping!
  deleteFieldMapping(id: UUID!): Boolean!
}
```

### Re-paste Merge Strategy
```
On updateDesignFromPaste(screenId, newSvg):
1. Parse new SVG layers
2. Compare existing component.svgElementId with new layer IDs
3. Matched → update position only (preserve custom_id, descriptions, mappings)
4. New layers → show as "unmapped elements"
5. Missing layers → flag as "removed from design"
6. Replace stored SVG content
```

## Related Code Files
- **Modify**: Phase 01 migration - replace figma columns with svg columns
- **Create**: `design-doc-service/src/services/svg_service.rs` - SVG validation, sanitization
- **Create**: `design-doc-service/src/graphql/resolvers/component.rs`
- **Create**: `design-doc-service/src/graphql/resolvers/field_mapping.rs`
- **Create**: `design-doc-service/src/db/queries/component.rs`
- **Create**: `design-doc-service/src/db/queries/field_mapping.rs`
- **Create**: `task-scheduler-frontend/src/hooks/use-clipboard-svg-paste.ts`
- **Create**: `task-scheduler-frontend/src/lib/svg-layer-parser.ts`
- **Create**: `task-scheduler-frontend/src/lib/svg-sanitizer.ts`

## Implementation Steps
1. Create `use-clipboard-svg-paste.ts` hook: listen paste event, extract SVG from clipboard
2. Create `svg-layer-parser.ts`: parse SVG DOM, extract layers with bboxes
3. Create `svg-sanitizer.ts`: DOMPurify config for SVG (allow gradients, masks; strip scripts)
4. Create `svg_service.rs` backend: validate SVG size, sanitize server-side, store
5. Update Phase 01 migration: svg_content/svg_layers on screens, svg_element_id on components
6. Create `pasteDesign` mutation
7. Create Component CRUD resolvers
8. Create FieldMapping CRUD resolvers
9. Implement `updateDesignFromPaste` with merge strategy
10. Add i18n descriptions support
11. Test with real Figma & Google Stitch copy-paste

## Todo List
- [x] Clipboard paste hook (frontend)
- [x] SVG layer parser (frontend)
- [x] SVG sanitizer (DOMPurify for SVG)
- [x] SVG service (backend validation + storage)
- [x] Update screens migration (svg columns)
- [x] pasteDesign mutation
- [x] Component CRUD resolvers
- [x] FieldMapping CRUD resolvers
- [x] updateDesignFromPaste with merge
- [x] i18n descriptions JSONB
- [x] Test Figma clipboard paste
- [x] Test Google Stitch clipboard paste

## Success Criteria
- Copy frame in Figma → paste in web app → SVG renders exact colors/dimensions/proportions
- Click SVG element → assign custom ID, name, description, DB mapping
- Re-paste updated design → existing component assignments preserved
- SVG scales responsively at all viewport sizes
- i18n descriptions queryable per locale

## Risk Assessment
- **Clipboard API support**: `navigator.clipboard.read()` needs HTTPS + secure context. Mitigation: fallback to paste event `clipboardData`.
- **SVG complexity**: Complex designs may produce huge SVGs (>5MB). Mitigation: size limit + warn user.
- **SVG element ID stability**: Figma may not preserve IDs across copies. Mitigation: manual re-linking UI.
- **XSS via SVG**: Malicious SVG with scripts. Mitigation: DOMPurify mandatory on both frontend & backend.
- **Google Stitch format**: May differ from Figma. Mitigation: test both, handle multiple extraction paths.

## Security Considerations
- SVG sanitized via DOMPurify before storage AND rendering
- No external API tokens needed (clipboard-only)
- SVG size limit on backend (configurable, default 5MB)
- Strip `<script>`, `<foreignObject>`, event handlers from SVG

## Unresolved Questions
1. Does Figma clipboard always contain full vector SVG or sometimes rasterized?
2. Max depth for SVG layer extraction? (Suggest: 3-4 levels)
3. How does Google Stitch clipboard format differ from Figma?
4. Support paste from Sketch, Adobe XD in future?

## Next Steps
- Phase 05: Frontend renders interactive SVG + description table
