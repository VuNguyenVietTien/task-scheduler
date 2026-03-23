# Phase 06: Impact Analysis & Flow Tracking

## Context Links
- [DB Research: Recursive CTE](research/researcher-02-db-schema-impact-analysis.md#2-graph-based-impact-analysis)
- [Phase 01: Flows/Field Mappings Tables](phase-01-database-schema-and-migrations.md)
- [Phase 04: Field Mapping CRUD](phase-04-figma-integration-and-component-mapping.md)

## Overview
- **Priority**: P2
- **Status**: completed
- **Effort**: 5h
- Implement DB field impact analysis (which screens use a given DB column), business flow diagrams with Mermaid, and cross-referencing between flows/screens/components.

## Key Insights
- Recursive CTE efficient for shallow hierarchies (<5 levels); app-layer sort for deeper graphs
- field_mappings table links component → db_table.db_column; reverse lookup finds all components using same column
- Mermaid diagrams rendered client-side (no server rendering needed)
- Flow steps link to screens/components for cross-referencing

## Requirements

### Functional
- **Impact query**: Given a db_table + db_column → return all components + screens using it (cross-document within same system)
- **Reverse impact**: Given a component → show all other components sharing same DB fields (cross-document)
- **Cross-screen graph**: Visual representation of field dependencies across screens and documents within a system
<!-- Updated: Validation Session 1 - Impact scope: cross-document within same system -->
- **Flow CRUD**: Create/edit business logic flows with Mermaid definitions
- **Flow step linking**: Each step can reference a screen + component
- **Flow rendering**: Mermaid diagram with clickable nodes linking to screens
- **Dependency report**: Exportable list of all field → screen → component mappings

### Non-Functional
- Impact query < 200ms for typical dataset (<1000 components)
- Mermaid rendering client-side via mermaid.js
- Flow diagrams support: flowchart, sequence, state diagrams

## Architecture

### Impact Analysis Query
```sql
-- Find all screens/components that use a specific DB column
SELECT
    c.id as component_id,
    c.custom_id,
    c.name as component_name,
    s.id as screen_id,
    s.name as screen_name,
    d.id as document_id,
    d.name as document_name,
    fm.db_table,
    fm.db_column
FROM field_mappings fm
JOIN components c ON fm.component_id = c.id
JOIN screens s ON c.screen_id = s.id
JOIN design_documents d ON s.document_id = d.id
JOIN modules m ON d.module_id = m.id
WHERE fm.db_table = $1 AND fm.db_column = $2
  AND m.system_id = $3  -- scope: within same system
ORDER BY d.name, s.name, c.custom_id;

-- Cross-screen dependency: find all components sharing fields with a given component
WITH target_fields AS (
    SELECT db_table, db_column
    FROM field_mappings
    WHERE component_id = $1
)
SELECT DISTINCT
    c.id, c.custom_id, c.name,
    s.id as screen_id, s.name as screen_name,
    fm.db_table, fm.db_column
FROM target_fields tf
JOIN field_mappings fm ON fm.db_table = tf.db_table AND fm.db_column = tf.db_column
JOIN components c ON fm.component_id = c.id
JOIN screens s ON c.screen_id = s.id
WHERE c.id != $1;
```

### Recursive Flow Traversal
```sql
-- Find all screens reachable from a given screen via flows
WITH RECURSIVE reachable_screens AS (
    SELECT
        fs.screen_id,
        f.id as flow_id,
        f.name as flow_name,
        1 as depth,
        ARRAY[fs.screen_id] as path
    FROM flow_steps fs
    JOIN flows f ON fs.flow_id = f.id
    WHERE fs.screen_id = $1

    UNION ALL

    SELECT
        fs2.screen_id,
        fs2.flow_id,
        f2.name,
        rs.depth + 1,
        rs.path || fs2.screen_id
    FROM reachable_screens rs
    JOIN flow_steps fs_next ON fs_next.flow_id = rs.flow_id
        AND fs_next.step_order > (
            SELECT step_order FROM flow_steps WHERE flow_id = rs.flow_id AND screen_id = rs.screen_id LIMIT 1
        )
    JOIN flow_steps fs2 ON fs2.screen_id = fs_next.screen_id
    JOIN flows f2 ON fs2.flow_id = f2.id
    WHERE rs.depth < 10
      AND NOT fs2.screen_id = ANY(rs.path)
)
SELECT DISTINCT screen_id, flow_name, depth FROM reachable_screens ORDER BY depth;
```

### GraphQL Schema Additions
```graphql
type ImpactResult {
  componentId: UUID!
  componentCustomId: String!
  componentName: String!
  screenId: UUID!
  screenName: String!
  documentId: UUID!
  documentName: String!
  dbTable: String!
  dbColumn: String!
}

type Flow {
  id: UUID!
  documentId: UUID!
  name: String!
  description: String
  mermaidDefinition: String!
  flowType: FlowType!
  steps: [FlowStep!]!
  tags: [Tag!]!
}

type FlowStep {
  id: UUID!
  flowId: UUID!
  screen: Screen
  component: Component
  stepOrder: Int!
  label: String
  description: String
}

enum FlowType { BUSINESS, NAVIGATION, DATA }

type Query {
  # Impact analysis
  fieldImpact(dbTable: String!, dbColumn: String!): [ImpactResult!]!
  componentDependencies(componentId: UUID!): [ImpactResult!]!

  # Flows
  flows(documentId: UUID!): [Flow!]!
  flow(id: UUID!): Flow
}

input CreateFlowInput {
  documentId: UUID!
  name: String!
  description: String
  mermaidDefinition: String!
  flowType: FlowType
}

input CreateFlowStepInput {
  flowId: UUID!
  screenId: UUID
  componentId: UUID
  stepOrder: Int!
  label: String
  description: String
}
```

### Frontend: Impact Analysis UI
```tsx
// components/designs/field-impact-panel.tsx
// Click a component's DB field → opens panel showing all other screens using same field
// Each result is a link to that screen's viewer (navigates to screen + highlights component)

// components/designs/mermaid-flow-viewer.tsx
// Renders Mermaid diagram from flow.mermaidDefinition
// Clickable nodes: click node → navigate to linked screen
// Uses mermaid.js client-side rendering

// components/designs/flow-editor.tsx
// Textarea for Mermaid source + live preview
// Step linking: assign screen/component to each flow step
```

## Related Code Files
- **Create**: `design-doc-service/src/graphql/resolvers/impact.rs`
- **Create**: `design-doc-service/src/graphql/resolvers/flow.rs`
- **Create**: `design-doc-service/src/services/impact_service.rs`
- **Create**: `design-doc-service/src/db/queries/impact.rs`
- **Create**: `design-doc-service/src/db/queries/flow.rs`
- **Create**: `task-scheduler-frontend/src/components/designs/field-impact-panel.tsx`
- **Create**: `task-scheduler-frontend/src/components/designs/mermaid-flow-viewer.tsx`
- **Create**: `task-scheduler-frontend/src/components/designs/flow-editor.tsx`

## Implementation Steps
1. Create `impact_service.rs` with field impact and component dependency queries
2. Create impact GraphQL resolvers (fieldImpact, componentDependencies)
3. Create Flow CRUD resolvers (create, update, delete, list)
4. Create FlowStep CRUD resolvers (create, update, delete, reorder)
5. Build `field-impact-panel.tsx` - shows affected screens when clicking a field
6. Install `mermaid` npm package in frontend
7. Build `mermaid-flow-viewer.tsx` - renders Mermaid diagram with clickable nodes
8. Build `flow-editor.tsx` - Mermaid source editor + live preview + step linking
9. Integrate impact panel into design viewer (Phase 05 split-view)
10. Add flow tab to document detail page
11. Test with interconnected sample data

## Todo List
- [x] Impact analysis SQL queries
- [x] Impact GraphQL resolvers
- [x] Flow CRUD resolvers
- [x] FlowStep CRUD resolvers
- [x] Field impact panel component
- [x] Mermaid flow viewer component
- [x] Flow editor with live preview
- [x] Integration with design viewer
- [x] Flow tab on document page
- [x] Test with sample dependency data

## Success Criteria
- Click DB field → see all screens/components using same column
- Click component → see all related components sharing DB fields
- Mermaid diagrams render correctly from stored definitions
- Flow nodes link to screens (clickable navigation)
- Impact query < 200ms on dataset with 500 components

## Risk Assessment
- **Query performance**: Complex JOINs with many components could be slow. Mitigation: Add indexes on field_mappings(db_table, db_column), limit result set.
- **Mermaid rendering**: Large diagrams can be slow/unreadable. Mitigation: Limit diagram complexity, offer zoom/pan.
- **Circular flows**: Recursive CTE needs cycle detection. Mitigation: Path array tracking (already in CTE).

## Security Considerations
- Impact queries respect document access (filter by user's project membership)
- Mermaid definitions sanitized before rendering (XSS via Mermaid callbacks)
- Flow step references validated (screen/component must belong to same document)

## Unresolved Questions
1. Should impact analysis cross document boundaries (across modules/systems)?
2. Export dependency graph as image/PDF for documentation?
3. Should we support custom Mermaid themes per project?

## Next Steps
- Phase 07: External integrations and AI-readable export
