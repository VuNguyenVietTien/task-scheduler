---
title: "Document Tab Integration"
description: "Integrate design-doc-service document module as a new Documents tab in project detail view"
status: complete
priority: P2
effort: 2h
branch: feat/v2.29
tags: [frontend, integration, documents, tabs]
created: 2026-03-26
---

# Document Tab Integration

## Goal
Add a "Documents" tab to the project detail view that embeds existing design-doc-service UI, passing the real `projectId` instead of hardcoded `1`.

## Architecture Decision
- Create a **separate Apollo client** for design-doc-service (port 8081) to avoid cache conflicts
- Wrap `DocumentsTab` in its own `ApolloProvider` with the design client
- Reuse all existing GraphQL queries/mutations from `frontend/src/graphql/queries/designs.ts` and `frontend/src/graphql/mutations/designs.ts`
- Reuse existing design components from `frontend/src/components/designs/`

## Phases

| # | Phase | Status | Effort |
|---|-------|--------|--------|
| 1 | [Apollo Client Setup](./phase-01-apollo-client-setup.md) | complete | 20min |
| 2 | [Tab Navigation Integration](./phase-02-tab-navigation-integration.md) | complete | 30min |
| 3 | [Documents Tab Component](./phase-03-documents-tab-component.md) | complete | 1h |

## Files to Modify
- `frontend/src/apollo/client.ts` - Add `designDocClient` export
- `frontend/src/components/ui/navigation/sidebar-project-tree-item.tsx` - Add documents to SUB_TABS
- `frontend/src/components/projects/ProjectDetailView.tsx` - Add documents ViewType + render

## Files to Create
- `frontend/src/components/projects/DocumentsTab.tsx` - Documents tab wrapper
- `frontend/src/apollo/design-doc-client.ts` - Separate Apollo client for design-doc-service

## Dependencies
- design-doc-service running on port 8081
- `NEXT_PUBLIC_DESIGN_DOC_API_URL` env var

## Key Risks
- design-doc-service uses `projectId: Int!` (not String UUID) - need type conversion
- Existing `/designs/` standalone pages must continue working unchanged
