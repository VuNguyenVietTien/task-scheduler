# Phase 3: Documents Tab Component

## Context Links
- [designs/page.tsx](../../frontend/src/app/designs/page.tsx) - Standalone designs page (hardcoded projectId=1)
- [design-doc-client.ts](./phase-01-apollo-client-setup.md) - Phase 1 Apollo client
- [GraphQL queries](../../frontend/src/graphql/queries/designs.ts) - GET_SYSTEMS, GET_SYSTEM, etc.
- [GraphQL mutations](../../frontend/src/graphql/mutations/designs.ts) - CREATE_SYSTEM, CREATE_MODULE, etc.
- [Design components](../../frontend/src/components/designs/) - Existing reusable components

## Overview
- **Priority**: High
- **Status**: complete
- **Description**: Create DocumentsTab component that wraps existing designs UI with proper Apollo provider and real projectId

## Key Insights
- Existing `designs/page.tsx` uses `const [projectId] = useState(1)` (hardcoded) - we pass real projectId
- Design-doc-service GraphQL uses `projectId: Int!` - our project IDs are string UUIDs
  - **Resolution needed**: Check if design-doc-service supports UUID project IDs or if we need a mapping. If Int, we need `parseInt(projectId)` or a project-to-int mapping table
- The tab should wrap content in its own `ApolloProvider` using the design-doc-client
- `useMemo` the Apollo client instance to prevent re-creation on re-renders
- Existing `/designs/` pages continue using the main Apollo client (they still work independently)

## Requirements

### Functional
- Show list of design systems for the current project
- Allow creating new systems from within the tab
- Navigate to system detail (modules, documents) inline or via links
- Pass real `projectId` from project context

### Non-functional
- Fresh data on tab switch (no stale cache from other tabs)
- Loading and empty states
- Under 200 lines

## Architecture
```
DocumentsTab (props: { projectId: string })
  └── ApolloProvider (design-doc-client instance via useMemo)
        └── DocumentsTabContent
              ├── System list (GET_SYSTEMS query)
              ├── Create system form (CREATE_SYSTEM mutation)
              └── System cards with links to /designs/{systemId}
```

## Related Code Files

### Create
- `frontend/src/components/projects/DocumentsTab.tsx`

### Reference (read-only, reuse patterns from)
- `frontend/src/app/designs/page.tsx` - System list UI pattern
- `frontend/src/components/designs/` - Existing design components
- `frontend/src/graphql/queries/designs.ts` - GET_SYSTEMS query
- `frontend/src/graphql/mutations/designs.ts` - CREATE_SYSTEM mutation

## Implementation Steps

1. Create `frontend/src/components/projects/DocumentsTab.tsx`:

2. **Outer wrapper** (`DocumentsTab`):
   - Accept `{ projectId: string }` props
   - `useMemo` to create design-doc Apollo client (call `createDesignDocClient()`)
   - Render `<ApolloProvider client={designClient}>` wrapping `<DocumentsTabContent projectId={projectId} />`
   - Use `key={projectId}` on ApolloProvider to force re-mount when project changes

3. **Inner component** (`DocumentsTabContent`):
   - Adapt logic from `designs/page.tsx`:
     - Replace `const [projectId] = useState(1)` with prop
     - Convert projectId: `parseInt(projectId, 10)` for the Int! GraphQL variable (if needed)
     - Keep same `useQuery(GET_SYSTEMS, { variables: { projectId: numericId } })`
     - Keep same `useMutation(CREATE_SYSTEM)` with form
   - Add system cards grid (same layout as designs page)
   - System card links: point to `/designs/${system.id}` (existing detail pages)
   - Loading state: spinner
   - Empty state: "No design systems yet. Create one to get started."

4. **projectId type handling**:
   - Check design-doc-service schema: `projectId: Int!` in GET_SYSTEMS
   - If project IDs are numeric strings (e.g., "1", "2"), use `parseInt(projectId, 10)`
   - If project IDs are UUIDs, need a mapping approach (future concern - flag as known limitation)

5. Test the component renders correctly within ProjectDetailView

## Todo List
- [x] Create DocumentsTab.tsx with ApolloProvider wrapper
- [x] Implement DocumentsTabContent with system list
- [x] Handle projectId type conversion (string to Int)
- [x] Add create system form
- [x] Add loading and empty states
- [x] Verify links to `/designs/{systemId}` work
- [x] Test tab switching (documents -> other tabs -> documents)
- [x] Run `npm run build` to check compilation

## Success Criteria
- Documents tab shows design systems for current project
- Can create new design system from tab
- System cards link to existing detail pages
- Tab switch causes fresh data fetch
- No console errors
- Build passes

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| projectId type mismatch (UUID vs Int) | High | High | Check DB schema; may need migration or mapping table |
| Design-doc-service not running | Medium | Medium | Show connection error message in tab |
| Apollo provider nesting conflicts | Low | Medium | Tested pattern; inner provider overrides for its subtree |

## Security Considerations
- Same JWT auth as main app; no new auth surface
- No sensitive data exposed in client
- Design-doc-service validates JWT independently

## Next Steps
- After implementation: update `docs/project-changelog.md` with new Documents tab feature
- Future: inline document detail view within tab (instead of navigating to `/designs/`)
- Future: handle UUID-to-Int projectId mapping if design-doc-service schema requires Int

## Unresolved Questions
1. **projectId type**: Design-doc-service schema uses `projectId: Int!` but main backend uses UUID strings. Need to verify how project IDs map between services. Current plan: use `parseInt()` and document as known limitation.
2. **CORS config**: Is design-doc-service configured to accept requests from `localhost:3000`? Need to verify Actix-web CORS settings.
