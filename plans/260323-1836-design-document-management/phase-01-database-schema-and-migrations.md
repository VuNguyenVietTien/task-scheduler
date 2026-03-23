# Phase 01: Database Schema & Migrations

## Context Links
- [DB Schema Research](research/researcher-02-db-schema-impact-analysis.md)
- [Scout: Current DB Schema](scout/scout-01-codebase-report.md#2-database-schema)

## Overview
- **Priority**: P1 (foundation for all other phases)
- **Status**: completed
- **Effort**: 6h
- Design all tables for the microservice's own PostgreSQL database. Hybrid relational + JSONB approach. Includes audit table, GIN indexes, seed data.

## Key Insights
- Existing task-scheduler uses SQLx with raw SQL migrations
- JSONB for component props/positions/i18n; relational for structure/relationships
- Audit table with full JSONB snapshots for version control (not delta-based - simpler, fast reads)
- GIN indexes with `jsonb_path_ops` for 10-30% smaller indexes

## Requirements

### Functional
- Store design documents with system/module/screen/component hierarchy
- Component translations (i18n) via JSONB `{"en":"..","vi":"..","ja":".."}`
- Field mappings: component → DB table.column
- Business flow definitions with steps
- External link references (Jira/Trello/Git)
- Audit trail for all document changes
- Tag system for cross-referencing

### Non-Functional
- Separate database from task-scheduler (microservice isolation)
- GIN indexes on all JSONB columns used in queries
- Foreign key constraints with CASCADE deletes where appropriate
- UUID primary keys for external API consumption

## Architecture

### Entity Relationship
```
systems (1) → (n) modules (1) → (n) design_documents (1) → (n) screens
screens (1) → (n) components
components (n) → (n) field_mappings → db_fields
design_documents (1) → (n) document_versions (audit)
screens (1) → (n) flow_steps → flows
entities → (n) entity_tags → tags
entities → (n) external_links
```

### Core Tables

```sql
-- Hierarchy: System → Module → Document → Screen → Component

CREATE TABLE systems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id BIGINT NOT NULL,  -- references task-scheduler project
    name VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_by BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE design_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',  -- draft, review, approved, archived
    description TEXT,
    source_tool VARCHAR(50),            -- figma, google_stitch, other
    last_imported_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_by BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE screens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES design_documents(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    svg_content TEXT,                  -- Raw sanitized SVG from clipboard paste
    svg_layers JSONB DEFAULT '[]',    -- Extracted layer hierarchy for quick access
    frame_width INT,                   -- SVG viewBox dimensions
    frame_height INT,
    breakpoint VARCHAR(20) DEFAULT 'pc',  -- mobile, tablet, pc
    sort_order INT DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    screen_id UUID NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
    custom_id VARCHAR(50) NOT NULL,    -- user-assigned: "1", "1.1", "1.2"
    name VARCHAR(255) NOT NULL,
    component_type VARCHAR(100),       -- Button, Input, Card, etc.
    data_type VARCHAR(100),            -- string, number, date, etc.
    display_logic TEXT,
    position JSONB NOT NULL,           -- { x, y, width, height } from SVG bbox
    svg_element_id VARCHAR(255),       -- Links to SVG <g> element ID
    descriptions JSONB DEFAULT '{}',   -- i18n: {"en":"Save","vi":"Luu","ja":"保存"}
    metadata JSONB DEFAULT '{}',       -- styles, props, etc.
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(screen_id, custom_id)
);

CREATE TABLE field_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    db_table VARCHAR(255) NOT NULL,
    db_column VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Flow Tables

```sql
CREATE TABLE flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES design_documents(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    mermaid_definition TEXT,           -- Mermaid diagram source
    flow_type VARCHAR(50) DEFAULT 'business',  -- business, navigation, data
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE flow_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
    screen_id UUID REFERENCES screens(id) ON DELETE SET NULL,
    component_id UUID REFERENCES components(id) ON DELETE SET NULL,
    step_order INT NOT NULL,
    label VARCHAR(255),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tags & External Links

```sql
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7),                  -- hex color
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE entity_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,  -- document, screen, component, flow
    entity_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tag_id, entity_type, entity_id)
);

CREATE TABLE external_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,  -- document, screen, component, flow
    entity_id UUID NOT NULL,
    provider VARCHAR(50) NOT NULL,     -- jira, trello, github
    external_id VARCHAR(255) NOT NULL,
    external_url VARCHAR(500),
    sync_status VARCHAR(50) DEFAULT 'linked',
    last_synced_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entity_type, entity_id, provider, external_id)
);
```

### Audit Table

```sql
CREATE TABLE document_audit (
    id BIGSERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,  -- document, screen, component
    entity_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,       -- INSERT, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    changed_by BIGINT NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_entity ON document_audit(entity_type, entity_id);
CREATE INDEX idx_audit_changed_at ON document_audit(changed_at DESC);
```

### GIN Indexes

```sql
CREATE INDEX idx_components_position_gin ON components USING gin(position jsonb_path_ops);
CREATE INDEX idx_components_descriptions_gin ON components USING gin(descriptions jsonb_path_ops);
CREATE INDEX idx_components_metadata_gin ON components USING gin(metadata jsonb_path_ops);
CREATE INDEX idx_screens_metadata_gin ON screens USING gin(metadata jsonb_path_ops);
CREATE INDEX idx_field_mappings_table_col ON field_mappings(db_table, db_column);
CREATE INDEX idx_entity_tags_lookup ON entity_tags(entity_type, entity_id);
CREATE INDEX idx_external_links_lookup ON external_links(entity_type, entity_id);
CREATE INDEX idx_screens_document ON screens(document_id);
CREATE INDEX idx_components_screen ON components(screen_id);
```

## Related Code Files
- **Create**: `design-doc-service/migrations/` - All migration SQL files
- **Create**: `design-doc-service/seeds/` - Seed data for development

## Implementation Steps
1. Create migration directory structure
2. Write `001_create_systems_modules.sql` - systems, modules tables
3. Write `002_create_documents_screens.sql` - design_documents, screens tables
4. Write `003_create_components_mappings.sql` - components, field_mappings tables
5. Write `004_create_flows.sql` - flows, flow_steps tables
6. Write `005_create_tags_links.sql` - tags, entity_tags, external_links tables
7. Write `006_create_audit.sql` - document_audit table + trigger function
8. Write `007_create_indexes.sql` - All GIN and composite indexes
9. Write seed data for development/testing
10. Test migrations with `sqlx migrate run`

## Todo List
- [x] Create migration files for all tables
- [x] Add audit trigger function
- [x] Create GIN indexes
- [x] Write seed data script
- [x] Test migration up/down
- [x] Verify foreign key constraints
- [x] Test JSONB query performance with sample data

## Success Criteria
- All migrations run without errors
- Foreign key relationships enforce referential integrity
- JSONB queries use GIN indexes (verified with EXPLAIN ANALYZE)
- Audit trigger captures INSERT/UPDATE/DELETE on documents

## Risk Assessment
- **JSONB bloat**: Large component metadata could hit TOAST threshold. Mitigation: Keep JSONB lean, store large blobs (images) externally.
- **UUID performance**: Slightly slower than BIGSERIAL for indexes. Mitigation: Acceptable tradeoff for external API usability.
- **Cross-service references**: `project_id` and `created_by` reference task-scheduler DB. Mitigation: No FK constraint (microservice boundary), validate via API.

## Security Considerations
- No direct user data stored (references user IDs from auth service)
- Audit trail captures `changed_by` for accountability
- Row-level security possible via PostgreSQL RLS if needed later

## Next Steps
- Phase 02: Backend service setup with SQLx connection to this schema
