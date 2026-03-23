# PostgreSQL JSONB Schema, Impact Analysis & Integration Research

**Date:** 2026-03-23  
**Scope:** Design Document Management Microservice  
**Status:** Complete

---

## 1. PostgreSQL JSONB Schema Design

### Hybrid Relational-JSONB Pattern (Recommended)

Store atomic identifiers and common query fields as columns; variable/extensible data in JSONB.

```sql
-- Document table example
CREATE TABLE documents (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,  -- indexed column
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,  -- component props, colors, fonts
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Screens table
CREATE TABLE screens (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    layout JSONB NOT NULL,  -- { components: [...], flows: [...] }
    FOREIGN KEY (document_id) REFERENCES documents(id)
);

-- Components mapping (relational + JSONB for flexibility)
CREATE TABLE components (
    id BIGSERIAL PRIMARY KEY,
    screen_id BIGINT NOT NULL,
    component_type VARCHAR(100),  -- Button, Input, Card
    props JSONB DEFAULT '{}'::jsonb,  -- { color, size, label, i18n: {...} }
    position JSONB NOT NULL,  -- { x, y, width, height }
    FOREIGN KEY (screen_id) REFERENCES screens(id)
);
```

### Indexing Strategy (GIN Indexes)

```sql
-- Create GIN index for component property queries
CREATE INDEX idx_components_props_gin 
  ON components USING gin(props);

-- Specific path index for better performance
CREATE INDEX idx_components_props_type 
  ON components USING gin(props jsonb_path_ops) 
  WHERE component_type = 'Input';

-- Index for component_type + props combination
CREATE INDEX idx_components_type_props 
  ON components(component_type, props);
```

**Key Insight:** Use `jsonb_path_ops` operator class for 10-30% smaller indexes with better specificity than default `jsonb_ops`.

### When to Use JSONB vs. Relational Columns

| Data | Use JSONB | Use Column | Reason |
|------|-----------|-----------|--------|
| Component style variants | ✓ | | Extensible without schema migrations |
| Component props (label, color, size) | ✓ | | Varies per component type |
| Relationship IDs (user_id, project_id) | | ✓ | Foreign keys require relational columns |
| Component position/layout | ✓ | | Float/coordinate data is flexible |
| Document status enum | | ✓ | Indexed query, fixed set of values |
| Field mappings (Jira → DB column) | ✓ | | Dynamic mapping per integration |

**⚠️ Avoid JSONB for:** Fixed structures that never change, high-frequency updates to single JSON properties (row-level locking), frequently JOINed relationships.

---

## 2. Graph-Based Impact Analysis

### Recursive CTE Pattern for Dependency Traversal

```sql
-- Find all screens affected by changing component type
WITH RECURSIVE component_impacts AS (
    -- Base case: find all components with specific type
    SELECT 
        c.id as component_id,
        c.screen_id,
        s.document_id,
        1 as depth,
        ARRAY[c.id] as path
    FROM components c
    JOIN screens s ON c.screen_id = s.id
    WHERE c.component_type = 'Input'  -- e.g., changing Input component base
    
    UNION ALL
    
    -- Recursive case: find screens that flow to these screens
    SELECT 
        ci.component_id,
        f.target_screen_id,
        f.target_document_id,
        ci.depth + 1,
        ci.path || f.target_screen_id
    FROM component_impacts ci
    JOIN flows f ON f.source_screen_id = ci.screen_id
    WHERE ci.depth < 10  -- limit recursion depth
      AND NOT f.target_screen_id = ANY(ci.path)  -- avoid cycles
)
SELECT DISTINCT 
    document_id, 
    COUNT(*) as affected_components,
    MAX(depth) as cascade_depth
FROM component_impacts
GROUP BY document_id
ORDER BY cascade_depth DESC;
```

**Performance Notes:**
- Efficient for narrow dependency graphs (fanout ≤ 5 levels)
- NOT efficient for dense graphs (use application code for topological sort if >100 edges)
- Use `UNION ALL` (not `UNION`) to avoid sorting overhead

### Materialized Path Pattern (Alternative to CTE)

For frequently-queried hierarchies, store path as string:

```sql
ALTER TABLE screens ADD COLUMN path TEXT;  -- e.g., '1/2/5' for hierarchy
CREATE INDEX idx_screens_path ON screens(path);

-- Query: find all descendants of screen 2
SELECT * FROM screens WHERE path LIKE '1/2/%';
```

**Tradeoff:** Slightly slower inserts (must update path), significantly faster reads.

---

## 3. Document Version Control Without Git

### Audit Table Approach (Recommended for Design Docs)

```sql
CREATE TABLE document_audit (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL,
    action VARCHAR(20),  -- INSERT, UPDATE, DELETE
    old_data JSONB,  -- full document snapshot before change
    new_data JSONB,  -- full document snapshot after change
    changed_fields TEXT[],  -- ['metadata.color', 'screens[0].layout']
    changed_by BIGINT,  -- user_id
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    transaction_id BIGINT,
    FOREIGN KEY (document_id) REFERENCES documents(id)
);

-- Trigger to auto-log changes
CREATE OR REPLACE FUNCTION audit_document_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO document_audit (document_id, action, old_data, new_data, changed_by, transaction_id)
    VALUES (
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) ELSE NULL END,
        current_setting('app.user_id')::BIGINT,
        txid_current()
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_document_audit AFTER INSERT OR UPDATE OR DELETE
ON documents FOR EACH ROW EXECUTE FUNCTION audit_document_changes();
```

### Delta Storage (Space-Efficient)

For large documents, store only changed fields instead of full snapshots:

```sql
CREATE TABLE document_deltas (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT,
    version_number INT,
    delta JSONB,  -- only changed paths: { "metadata.color": "#FF0000" }
    parent_version INT,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reconstruct version from deltas
WITH RECURSIVE version_chain AS (
    SELECT id, delta, parent_version, 1 as level
    FROM document_deltas 
    WHERE document_id = $1 AND version_number = $2
    
    UNION ALL
    
    SELECT d.id, d.delta, d.parent_version, vc.level + 1
    FROM document_deltas d
    JOIN version_chain vc ON d.version_number = vc.parent_version
)
SELECT jsonb_object_agg(...) FROM version_chain;  -- reconstruct from bottom-up
```

**Tradeoff:** Deltas save ~70% storage but require reconstruction for viewing old versions. Use snapshots for frequently accessed historical versions.

---

## 4. Jira/Trello Integration Patterns

### Schema for External References

```sql
CREATE TABLE external_links (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL,
    provider VARCHAR(50),  -- 'jira', 'trello', 'github'
    external_id VARCHAR(255),  -- 'PROJ-123' or card_id
    external_url VARCHAR(500),
    sync_status VARCHAR(50),  -- 'synced', 'pending', 'failed'
    last_synced_at TIMESTAMP,
    metadata JSONB,  -- provider-specific fields
    FOREIGN KEY (document_id) REFERENCES documents(id),
    UNIQUE(document_id, provider, external_id)
);
```

### Jira Integration Pattern

```python
# Pseudo-code: Store link via Jira REST API v3
POST /rest/api/3/issue/{issueKey}/remotelinks

{
    "url": "https://designs.internal.com/doc/abc123",
    "title": "Design Document: User Registration Flow",
    "globalId": "design-doc-abc123-jira",
    "application": {
        "name": "Design System",
        "type": "com.example.app"
    }
}

# In PostgreSQL: log the link
INSERT INTO external_links 
  (document_id, provider, external_id, external_url, sync_status, metadata)
VALUES 
  (123, 'jira', 'PROJ-456', 'https://jira.company.com/browse/PROJ-456', 
   'synced', '{"link_id": "12345"}'::jsonb);
```

### Webhook Handler for Sync

```sql
-- Table for Jira status changes
CREATE TABLE jira_status_cache (
    external_link_id BIGINT PRIMARY KEY,
    issue_status VARCHAR(100),
    updated_at TIMESTAMP,
    FOREIGN KEY (external_link_id) REFERENCES external_links(id)
);

-- Trigger: alert on design document if linked Jira issue status changes
-- (Jira webhook → API endpoint → UPDATE jira_status_cache)
```

---

## 5. Internationalization (i18n) Architecture

### Approach A: JSONB Single Column (Faster Reads, Simpler Code)

```sql
ALTER TABLE components ADD COLUMN i18n JSONB DEFAULT '{}'::jsonb;

-- Example data
UPDATE components 
SET i18n = '{
  "label": {
    "en": "Save Button",
    "vi": "Nút Lưu",
    "ja": "保存ボタン"
  },
  "tooltip": {
    "en": "Click to save changes",
    "vi": "Nhấp để lưu thay đổi",
    "ja": "変更を保存するにはクリック"
  }
}'::jsonb
WHERE id = 1;

-- Query specific locale
CREATE INDEX idx_components_i18n_gin 
  ON components USING gin(i18n);

SELECT i18n -> 'label' ->> 'vi' as vietnamese_label 
FROM components 
WHERE id = 1;
```

**Pros:** No JOINs; single row update for multi-locale content; smaller query payload.  
**Cons:** Less granular permissions; all locales stored together; harder to track translation progress per locale.

### Approach B: Separate Translation Table (Better Flexibility, Easier Auditing)

```sql
CREATE TABLE component_translations (
    id BIGSERIAL PRIMARY KEY,
    component_id BIGINT NOT NULL,
    locale VARCHAR(10),  -- 'en', 'vi', 'ja'
    field_name VARCHAR(100),  -- 'label', 'tooltip'
    value TEXT,
    translated_by BIGINT,
    translated_at TIMESTAMP,
    is_approved BOOLEAN DEFAULT FALSE,
    UNIQUE(component_id, locale, field_name),
    FOREIGN KEY (component_id) REFERENCES components(id)
);

CREATE INDEX idx_translations_component_locale 
  ON component_translations(component_id, locale);
```

**Pros:** Per-locale permissions; audit trail; easier translation management; supports progress tracking.  
**Cons:** N+1 JOINs if loading all locales; slower for multi-locale queries.

### Recommendation for Design System

**Use JSONB** for AI-agent readability (single column, cleaner API responses) but add a separate `translations_metadata` table to track:
- Translation status (pending, reviewed, approved)
- Translator assignments
- Translation deadline

```sql
-- Hybrid: JSONB content + relational metadata
CREATE TABLE translation_metadata (
    id BIGSERIAL PRIMARY KEY,
    component_id BIGINT,
    locale VARCHAR(10),
    status VARCHAR(50),  -- 'pending', 'in_progress', 'approved'
    assigned_to BIGINT,
    created_at TIMESTAMP,
    UNIQUE(component_id, locale)
);
```

---

## Key Tradeoffs Summary

| Pattern | Pros | Cons | Use When |
|---------|------|------|----------|
| JSONB Hybrid | Flexible, no migrations, fast reads | Row-level locking, TOAST overhead | Extensible component props |
| Recursive CTE | Single query, elegant | O(2^V) for dense graphs, difficult debugging | Shallow hierarchies (<5 levels) |
| Audit Table | Complete history, versioning | Storage overhead, slower updates | Compliance/audit required |
| Delta Storage | 70% space savings | Reconstruction complexity | Long-lived document history |
| JSONB i18n | No JOINs, simpler | Less granular control | AI-friendly APIs |

---

## Architecture Recommendation

**Schema Structure:**
1. **Core Tables** (relational): documents, screens, components, projects
2. **Relationship Tables** (relational): flows, field_mappings, external_links
3. **Flexible Data** (JSONB): props, metadata, i18n, position in components
4. **Audit Trail** (append-only): document_audit, jira_sync_log
5. **Cache/Metadata** (relational): jira_status_cache, translation_metadata

**Indexing Strategy:**
- Column indexes on: project_id, document_id, status, provider
- GIN indexes on: props, i18n, metadata (for component queries)
- Composite indexes on: (component_type, component_id) for type-specific queries

**Versioning:** Use audit table approach with snapshots (fast history access) + delta compression for storage.

**Integration:** External links stored as relational records; sync status tracked; metadata in JSONB for provider-specific fields.

---

## Sources

- [AWS PostgreSQL JSON Database Patterns](https://aws.amazon.com/blogs/database/postgresql-as-a-json-database-advanced-patterns-and-best-practices/)
- [JSONB: PostgreSQL's Secret Weapon](https://medium.com/@richardhightower/jsonb-postgresqls-secret-weapon-for-flexible-data-modeling-cf2f5087168f)
- [PostgreSQL Recursive CTEs and Graph Algorithms](https://www.fusionbox.com/blog/detail/graph-algorithms-in-a-database-recursive-ctes-and-topological-sort-with-postgres/620/)
- [PostgreSQL Recursive Queries Documentation](https://www.postgresql.org/docs/current/queries-with.html)
- [pgMemento: Audit Trail Extension](https://github.com/pgMemento/pgMemento)
- [PostgreSQL Audit Trails with Triggers](https://oneuptime.com/blog/post/2026-01-25-postgresql-audit-trails-triggers/view)
- [Jira REST API v3 Webhooks](https://developer.atlassian.com/cloud/jira/platform/webhooks/)
- [I18n Database Patterns](https://medium.com/walkin/database-internationalization-i18n-localization-l10n-design-patterns-94ff372375c6)
- [PostgreSQL i18n with JSONB](https://salihdev.medium.com/mastering-i18n-in-postgresqls-jsonb-2631ad50376a)

---

## Unresolved Questions

1. **Jira Cloud vs. Server**: Should microservice support both API v3 (Cloud) and v11 (Data Center)? v3 supports webhooks; v11 has broader feature set.
2. **Recursive CTE Complexity**: What's the expected maximum screen flow depth? If >5, topological sort in application layer is necessary.
3. **Trello Integration Priority**: Trello API is less powerful than Jira. Should it be Phase 2?
4. **TOAST Compression Threshold**: At what document size do we need to consider partitioning JSONB columns into separate storage?
