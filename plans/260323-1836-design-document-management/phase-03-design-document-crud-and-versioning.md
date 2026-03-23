# Phase 03: Design Document CRUD & Versioning

## Context Links
- [Phase 01: DB Schema](phase-01-database-schema-and-migrations.md)
- [Phase 02: Service Setup](phase-02-backend-service-setup.md)
- [DB Research: Audit Table](research/researcher-02-db-schema-impact-analysis.md#3-document-version-control-without-git)

## Overview
- **Priority**: P1
- **Status**: completed
- **Effort**: 5h
- Implement CRUD for systems, modules, documents, screens. Add audit-based versioning. Tag system for cross-referencing.

## Key Insights
- Hierarchy: System → Module → Document → Screen (navigable tree)
- Audit table captures full JSONB snapshots on every change
- Tags are polymorphic (entity_type + entity_id pattern)
- Existing task-scheduler uses MergedObject pattern for query/mutation roots

## Requirements

### Functional
- CRUD for: systems, modules, design_documents, screens
- List with filters (status, project_id, module_id)
- Document status transitions: draft → review → approved → archived
- Version history: list all changes to a document with diffs
- Restore previous version from audit snapshot
- Tag assignment/removal on any entity
- Hierarchy navigation: system → modules → documents → screens

### Non-Functional
- Pagination on list queries (cursor-based)
- Audit logging transparent (trigger-based, no app code needed for basic logging)
- Batch operations for bulk screen/component creation

## Architecture

### GraphQL Schema (Key Types)

```graphql
type System {
  id: UUID!
  projectId: Int!
  name: String!
  description: String
  modules: [Module!]!
  tags: [Tag!]!
  createdAt: DateTime!
}

type Module {
  id: UUID!
  systemId: UUID!
  name: String!
  documents: [DesignDocument!]!
  sortOrder: Int!
}

type DesignDocument {
  id: UUID!
  moduleId: UUID!
  name: String!
  status: DocumentStatus!
  screens: [Screen!]!
  flows: [Flow!]!
  tags: [Tag!]!
  versions: [DocumentVersion!]!
  createdBy: Int!
  createdAt: DateTime!
}

type Screen {
  id: UUID!
  documentId: UUID!
  name: String!
  figmaNodeId: String
  figmaImageUrl: String
  frameWidth: Int
  frameHeight: Int
  breakpoint: Breakpoint!
  components: [Component!]!
  sortOrder: Int!
}

enum DocumentStatus { DRAFT, REVIEW, APPROVED, ARCHIVED }
enum Breakpoint { MOBILE, TABLET, PC }

type DocumentVersion {
  id: Int!
  entityType: String!
  entityId: UUID!
  action: String!
  oldData: JSON
  newData: JSON
  changedBy: Int!
  changedAt: DateTime!
}

# Mutations
input CreateSystemInput { projectId: Int!, name: String!, description: String }
input CreateModuleInput { systemId: UUID!, name: String!, sortOrder: Int }
input CreateDocumentInput { moduleId: UUID!, name: String!, description: String, figmaFileKey: String }
input CreateScreenInput { documentId: UUID!, name: String!, breakpoint: Breakpoint, sortOrder: Int }
input UpdateDocumentInput { id: UUID!, name: String, status: DocumentStatus, description: String }
```

### Resolver Pattern
```rust
// Follow existing MergedObject pattern
#[derive(MergedObject, Default)]
pub struct QueryRoot(
    SystemQuery,
    ModuleQuery,
    DocumentQuery,
    ScreenQuery,
    TagQuery,
);

#[derive(MergedObject, Default)]
pub struct MutationRoot(
    SystemMutation,
    ModuleMutation,
    DocumentMutation,
    ScreenMutation,
    TagMutation,
);
```

### Audit Trigger (auto-captures changes)
```sql
-- Applied in Phase 01 migration
-- App code only needs to SET app.user_id before mutations:
SET LOCAL app.user_id = $1;
UPDATE design_documents SET name = $2 WHERE id = $3;
-- Trigger auto-inserts audit row
```

### Version Restore Logic
```rust
// Restore document to previous version
async fn restore_version(pool: &PgPool, audit_id: i64) -> Result<()> {
    let audit = sqlx::query_as!(DocumentAudit,
        "SELECT * FROM document_audit WHERE id = $1", audit_id
    ).fetch_one(pool).await?;

    // Apply old_data snapshot back to entity
    match audit.entity_type.as_str() {
        "document" => restore_document(pool, audit.entity_id, audit.old_data).await,
        "screen" => restore_screen(pool, audit.entity_id, audit.old_data).await,
        _ => Err(anyhow!("Unknown entity type"))
    }
}
```

## Related Code Files
- **Reference**: `task-scheduler-backend/src/graphql/resolvers/project.rs` - CRUD pattern
- **Create**: `design-doc-service/src/graphql/resolvers/system.rs`
- **Create**: `design-doc-service/src/graphql/resolvers/module.rs`
- **Create**: `design-doc-service/src/graphql/resolvers/document.rs`
- **Create**: `design-doc-service/src/graphql/resolvers/screen.rs`
- **Create**: `design-doc-service/src/graphql/resolvers/tag.rs`
- **Create**: `design-doc-service/src/db/queries/` - SQL query functions

## Implementation Steps
1. Create DB model structs (FromRow) for all entities
2. Implement SystemQuery + SystemMutation resolvers
3. Implement ModuleQuery + ModuleMutation resolvers
4. Implement DocumentQuery + DocumentMutation resolvers (with status transitions)
5. Implement ScreenQuery + ScreenMutation resolvers
6. Implement TagQuery + TagMutation resolvers (polymorphic entity_tags)
7. Add `SET LOCAL app.user_id` before every mutation for audit trigger
8. Implement version history query (list audit entries for entity)
9. Implement version restore mutation
10. Add pagination (cursor-based) to list queries
11. Wire all resolvers into MergedObject QueryRoot/MutationRoot
12. Test all CRUD operations via GraphQL playground

## Todo List
- [x] DB model structs for all entities
- [x] System CRUD resolvers
- [x] Module CRUD resolvers
- [x] Document CRUD resolvers + status transitions
- [x] Screen CRUD resolvers
- [x] Tag CRUD + polymorphic assignment
- [x] Audit trigger `SET LOCAL app.user_id` in mutations
- [x] Version history query
- [x] Version restore mutation
- [x] Cursor-based pagination
- [x] Integration tests for CRUD operations

## Success Criteria
- All CRUD operations work via GraphQL
- Status transitions enforce valid state machine (draft→review→approved→archived)
- Audit table auto-captures all changes with correct user_id
- Version history returns chronological list of changes
- Version restore correctly reverts entity to previous state
- Tags can be assigned/removed from any entity type

## Risk Assessment
- **Audit trigger overhead**: Every mutation triggers audit INSERT. Mitigation: Async audit via AFTER trigger (non-blocking).
- **JSONB snapshot size**: Full row snapshots could be large. Mitigation: Acceptable for MVP; switch to delta storage later if needed.
- **Pagination consistency**: Cursor-based pagination needed for stable ordering. Mitigation: Use created_at + id composite cursor.

## Security Considerations
- All mutations require valid JWT (middleware from Phase 02)
- Status transitions should check user role (admin/member can approve, viewer cannot)
- Audit trail is append-only (no DELETE/UPDATE on document_audit)

## Next Steps
- Phase 04: Figma integration adds figma_node_id and component data to screens
