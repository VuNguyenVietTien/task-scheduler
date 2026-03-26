# Phase 1: Apollo Client Setup

## Context Links
- [Current Apollo client](../../frontend/src/apollo/client.ts) - main backend only (port 8080)
- [Providers.tsx](../../frontend/src/app/Providers.tsx) - app-level ApolloProvider
- [System Architecture](../../docs/system-architecture.md) - design-doc-service on port 8081

## Overview
- **Priority**: High (blocker for Phase 2-3)
- **Status**: complete
- **Description**: Create a dedicated Apollo client for design-doc-service (port 8081) with auth middleware reuse

## Key Insights
- Current `Providers.tsx` creates one Apollo client for `NEXT_PUBLIC_BACKEND_URL` (port 8080)
- Design-doc-service shares JWT auth (same secret) so same auth middleware works
- The design client should NOT be added to the global ApolloProvider; it wraps DocumentsTab only
- `Providers.tsx` has auth middleware (cookie-based `getToken()`) that can be extracted and reused

## Requirements

### Functional
- Separate Apollo client pointing to `NEXT_PUBLIC_DESIGN_DOC_API_URL/graphql`
- Same auth token forwarding (Bearer JWT from cookie)
- Independent cache (no interference with main backend queries)

### Non-functional
- Client created lazily (only when Documents tab is mounted)
- Env var fallback to `http://localhost:8081`

## Architecture
```
Providers.tsx (ApolloProvider → main backend client)
  └── ProjectDetailView
        └── DocumentsTab
              └── ApolloProvider (design-doc-client) ← NEW
                    └── Design components (reuse existing)
```

## Related Code Files

### Modify
- `frontend/.env.local` - Add `NEXT_PUBLIC_DESIGN_DOC_API_URL=http://localhost:8081`

### Create
- `frontend/src/apollo/design-doc-client.ts` - Dedicated Apollo client factory

## Implementation Steps

1. Add `NEXT_PUBLIC_DESIGN_DOC_API_URL=http://localhost:8081` to `frontend/.env.local`
2. Create `frontend/src/apollo/design-doc-client.ts`:
   - Import `ApolloClient`, `InMemoryCache`, `createHttpLink`, `ApolloLink` from `@apollo/client`
   - Create `httpLink` using `NEXT_PUBLIC_DESIGN_DOC_API_URL` env var with `/graphql` suffix, fallback `http://localhost:8081/graphql`
   - Extract the `getToken()` function (or import from shared util) for cookie-based auth
   - Create `authMiddleware` ApolloLink that sets `Authorization: Bearer <token>` header
   - Export `createDesignDocClient()` factory function returning `new ApolloClient({ link, cache: new InMemoryCache(), defaultOptions: { watchQuery: { fetchPolicy: 'network-only' } } })`
3. Verify no circular imports between `client.ts` and `design-doc-client.ts`

## Todo List
- [x] Add env var to `.env.local`
- [x] Create `design-doc-client.ts` with factory function
- [x] Verify auth token forwarding works with design-doc-service

## Success Criteria
- `createDesignDocClient()` creates a working Apollo client
- Auth headers forwarded correctly
- No impact on existing main Apollo client

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| CORS issues between frontend and port 8081 | Medium | High | Ensure design-doc-service allows frontend origin |
| Token format mismatch | Low | High | Both services share JWT secret per architecture docs |

## Security Considerations
- Auth token passed via same cookie mechanism, no new auth surface
- No credentials stored in client code

## Next Steps
- Phase 2: Wire up tab navigation
