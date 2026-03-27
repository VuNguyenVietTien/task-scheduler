# Phase 04: Design Doc Service Migration

## Context Links
- Parent: [plan.md](./plan.md)
- Depends on: [Phase 01](./phase-01-foundation-supabase-setup.md), [Phase 02](./phase-02-graphql-yoga-server.md)
- Parallel with: [Phase 03](./phase-03-task-scheduler-migration.md)
- Scope: [Backend Scope](./scout/scout-01-backend-scope.md)

## Overview
- **Date**: 2026-03-27
- **Priority**: P1
- **Status**: complete
- **Effort**: 8h
- **Description**: Rewrite design-doc-service GraphQL resolvers in TypeScript. Handle JSONB metadata, nested entity hierarchy (system→module→document→screen→component), audit trail, tagging, flows, and external links.

## Key Insights
- ~9 queries + ~12 mutations to migrate
- Heavy JSONB usage (metadata fields) — use Supabase `.filter('metadata->key', 'eq', 'value')`
- Nested relations: `.select('*, screens(*, components(*))')` for deep fetches
- Audit trail inserts on every mutation — implement as service-layer middleware
- GIN indexes on JSONB columns already exist in Supabase; no migration needed
- Entity hierarchy: system → module → document → screen → component

## Requirements

### Functional
- All design-doc queries/mutations work identically to Rust service
- Audit trail records every create/update with old/new data diff
- Multi-entity tagging system (tag any entity by type + ID)
- Flow management with step ordering
- External link associations per document
- SVG content storage and retrieval for screens

### Non-Functional
- Deep nested queries complete < 1s
- Audit trail writes don't block response
- JSONB queries leverage existing GIN indexes

## Architecture

### Services Layer

```
web/src/lib/services/
├── system-service.ts              # Design system CRUD
├── module-service.ts              # Module CRUD within systems
├── document-service.ts            # Document CRUD with audit
├── screen-service.ts              # Screen CRUD with SVG content
├── component-service.ts           # Component CRUD + field mappings
├── flow-service.ts                # Flow CRUD with step ordering
├── tag-service.ts                 # Multi-entity tagging
├── external-link-service.ts       # External link management
└── audit-service.ts               # Audit trail recording
```

### Resolver Files

```
web/src/lib/graphql/resolvers/
├── system.ts                      # System queries
├── module.ts                      # Module queries/mutations
├── document.ts                    # Document queries/mutations
├── screen.ts                      # Screen queries/mutations
├── component.ts                   # Component queries/mutations
├── flow.ts                        # Flow queries/mutations
└── tag.ts                         # Tag queries/mutations
```

## Related Code Files

### Source (Rust - reference only)
- `design-doc-service/src/graphql/resolvers/` - All resolver files
- `design-doc-service/src/db/queries/` - All SQLx query files
- `design-doc-service/src/db/models/` - Model definitions
- `design-doc-service/src/services/` - Service layer

### Create
- All files in `web/src/lib/services/` (design-doc domain)
- GraphQL resolver implementations (fill Phase 2 stubs)

### Modify
- `web/src/lib/graphql/types/design-doc.ts` - Finalize type defs based on actual models

## Implementation Steps

### Step 1: Create Design Doc Services (4h)

1. **system-service.ts**
   - `getSystem(id)` → `.from('systems').select('*, modules(*)').eq('id', id).single()`
   - Systems are read-mostly; simple CRUD

2. **module-service.ts**
   - `getModules(systemId)` → `.from('modules').select('*').eq('system_id', systemId).order('position')`
   - `createModule(input)` → `.from('modules').insert(input).select().single()`
   - `updateModule(id, input)` → `.from('modules').update(input).eq('id', id).select().single()`

3. **document-service.ts**
   - `getDocuments(moduleId)` → `.from('documents').select('*, screens(count)').eq('module_id', moduleId)`
   - `createDocument(input)` → Insert + audit trail
   - `updateDocument(id, input)` → Fetch old data → Update → Audit diff
   - **Audit pattern**:
     ```typescript
     async function updateDocument(id: string, input: DocumentInput, userId: string) {
       const { data: old } = await supabase.from('documents').select('*').eq('id', id).single();
       const { data: updated } = await supabase.from('documents').update(input).eq('id', id).select().single();
       await auditService.record('document', id, 'update', old, updated, userId);
       return updated;
     }
     ```

4. **screen-service.ts**
   - `getScreens(documentId)` → `.from('screens').select('*, components(*)').eq('document_id', documentId)`
   - SVG content stored as text column; handle `content_type` field
   - `createScreen(input)` / `updateScreen(id, input)` with content type handling

5. **component-service.ts**
   - `getComponents(screenId)` → `.from('components').select('*, field_mappings(*)').eq('screen_id', screenId)`
   - `createComponent(input)` → Insert component + field mappings in transaction
   - **Field mappings**: `.from('field_mappings').insert(mappings)` after component creation
   - For transactional safety, use `supabase.rpc('create_component_with_mappings', {...})` if needed

6. **flow-service.ts**
   - `getFlows(documentId)` → `.from('flows').select('*').eq('document_id', documentId).order('position')`
   - Flow steps stored as JSONB array in `steps` column
   - `.filter('steps', 'cs', JSON.stringify([{type: 'action'}]))` for filtering

7. **tag-service.ts**
   - `getTags(entityType, entityId)` → `.from('tags').select('*').eq('entity_type', entityType).eq('entity_id', entityId)`
   - Generic tagging: works across systems, modules, documents, screens, components

8. **external-link-service.ts**
   - `getExternalLinks(documentId)` → `.from('external_links').select('*').eq('document_id', documentId)`
   - Simple CRUD

9. **audit-service.ts**
   - `record(entityType, entityId, action, oldData, newData, changedBy)` → `.from('audits').insert({...})`
   - Used by document, screen, component services
   - Fire-and-forget (don't await in resolver response path if latency matters)

### Step 2: Implement GraphQL Resolvers (2h)

1. Fill in resolver stubs with service calls
2. **Nested resolvers** (critical):
   ```typescript
   // Module resolver
   Module: {
     documents: (parent, args, ctx) => documentService.getDocuments(parent.id, ctx.supabaseAdmin)
   }
   // Document resolver
   Document: {
     screens: (parent, args, ctx) => screenService.getScreens(parent.id, ctx.supabaseAdmin)
   }
   ```
3. Implement DataLoader pattern if N+1 becomes issue (batch by parent IDs)

### Step 3: Handle Complex Queries (2h)

1. **JSONB queries** — Supabase JS supports:
   - `containedBy`, `contains`, `overlaps` for JSONB arrays
   - Arrow notation for nested keys: `.filter('metadata->status', 'eq', 'active')`

2. **Complex joins not expressible in Supabase JS** → Create PostgreSQL functions:
   ```sql
   -- Example: Impact analysis query
   CREATE OR REPLACE FUNCTION get_component_impact(p_component_id UUID)
   RETURNS TABLE(document_id UUID, screen_id UUID, component_name TEXT) AS $$
     SELECT d.id, s.id, c.name FROM components c
     JOIN screens s ON c.screen_id = s.id
     JOIN documents d ON s.document_id = d.id
     WHERE c.id = p_component_id;
   $$ LANGUAGE SQL;
   ```
   - Call via `supabase.rpc('get_component_impact', { p_component_id: id })`

3. **Aggregation queries** — `.select('*, screens(count)')` for counts

## Todo List
- [ ] Create system-service.ts
- [ ] Create module-service.ts
- [ ] Create document-service.ts with audit trail
- [ ] Create screen-service.ts with SVG handling
- [ ] Create component-service.ts with field mappings
- [ ] Create flow-service.ts with JSONB step management
- [ ] Create tag-service.ts (multi-entity)
- [ ] Create external-link-service.ts
- [ ] Create audit-service.ts
- [ ] Implement all design-doc GraphQL resolvers
- [ ] Implement nested resolvers (Module→Documents, Document→Screens, etc.)
- [ ] Create PostgreSQL RPC functions for complex queries
- [ ] Test nested query depth (system→module→document→screen→component)
- [ ] Verify audit trail records on mutations

## Success Criteria
- All 9 design-doc queries return correct nested data
- All 12 mutations create/update with audit trail
- JSONB metadata queries filter correctly
- Nested 4-level deep queries complete < 1s
- Tags work across all entity types
- SVG content stores/retrieves correctly

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| N+1 queries on deeply nested resolvers | High | Implement DataLoader; use single deep `.select()` |
| Complex SQL not expressible in Supabase JS | Medium | Create PostgreSQL functions, call via `.rpc()` |
| Audit trail slows mutations | Low | Fire-and-forget inserts; don't block response |
| Large SVG content exceeds payload limits | Medium | Store SVGs in Supabase Storage; reference by URL |

## Security Considerations
- Validate user has access to system before any operation
- Audit trail captures `changed_by` user ID (non-spoofable from context)
- JSONB inputs sanitized (no script injection in metadata)
- Component field mappings validated against known field types

## Next Steps
- Phase 05: Set up Supabase Realtime for document change notifications
- Phase 06: Update frontend to consume unified GraphQL endpoint
