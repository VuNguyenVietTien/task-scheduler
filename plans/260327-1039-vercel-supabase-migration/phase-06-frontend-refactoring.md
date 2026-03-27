# Phase 06: Frontend Refactoring

## Context Links
- Parent: [plan.md](./plan.md)
- Depends on: [Phase 02](./phase-02-graphql-yoga-server.md), [Phase 03](./phase-03-task-scheduler-migration.md), [Phase 04](./phase-04-design-doc-migration.md), [Phase 05](./phase-05-realtime-migration.md)

## Overview
- **Date**: 2026-03-27
- **Priority**: P1
- **Status**: complete
- **Effort**: 4h
- **Description**: Merge dual Apollo clients into single client pointing to `/api/graphql`, update auth flow to use Supabase Auth, update all endpoint references.

## Key Insights
- Frontend currently uses TWO Apollo clients: one for task-scheduler, one for design-doc-service
- Both backends now merged into single `/api/graphql` endpoint → single Apollo client
- Auth tokens change from custom JWT to Supabase session tokens
- GraphQL queries/mutations remain the same (schema preserved)
- Real-time subscriptions moved to Supabase Realtime (Phase 5), not Apollo subscriptions

## Requirements

### Functional
- Single Apollo client for all GraphQL operations
- Auth context uses Supabase sessions instead of custom JWT
- All existing pages continue to function
- Login/register flows use Supabase Auth

### Non-Functional
- No increase in bundle size from dual→single client
- Auth state persists across page navigations
- Smooth migration with no user-facing auth disruption

## Architecture

### Before (Current)
```
web/src/lib/
├── apollo-client.ts           # Client for task-scheduler backend
├── graphqlClient.ts           # Client for design-doc-service
├── authApi.ts                 # Custom JWT auth
├── firebase.ts                # Firebase OAuth
```

### After (Target)
```
web/src/lib/
├── apollo-client.ts           # Single client → /api/graphql
├── supabase/                  # Supabase client (from Phase 1)
│   ├── server.ts
│   ├── client.ts
│   └── middleware.ts
├── firebase.ts                # Firebase OAuth (calls /api/auth/firebase)
```

## Related Code Files

### Modify
- `web/src/lib/apollo-client.ts` - Point to `/api/graphql`, use Supabase session token
- `web/src/lib/apollo.ts` - Update or consolidate with apollo-client.ts
- `web/src/lib/authApi.ts` - Replace custom JWT calls with Supabase Auth
- `web/src/lib/firebase.ts` - Update to call `/api/auth/firebase` bridge
- `web/src/lib/graphqlClient.ts` - Remove or redirect to unified client
- `web/src/app/designs/layout.tsx` - Update Apollo provider (single client)
- `web/src/graphql/queries/designs.ts` - Remove client-specific configuration
- `web/src/graphql/mutations/designs.ts` - Remove client-specific configuration
- All components importing `graphqlClient` → import unified `apollo-client`

### Delete
- `web/src/lib/graphqlClient.ts` (if separate design-doc client)
- `web/src/lib/logging-apollo-client.ts` (consolidate into single client)
- Any WebSocket connection code in frontend

## Implementation Steps

### Step 1: Consolidate Apollo Client (1.5h)

1. **Update `apollo-client.ts`**:
   ```typescript
   import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';
   import { createBrowserClient } from '@/lib/supabase/client';

   const httpLink = new HttpLink({
     uri: '/api/graphql',  // Same-origin, no CORS
     headers: async () => {
       const supabase = createBrowserClient();
       const { data: { session } } = await supabase.auth.getSession();
       return {
         authorization: session ? `Bearer ${session.access_token}` : '',
       };
     },
   });

   export const client = new ApolloClient({
     link: httpLink,
     cache: new InMemoryCache(),
   });
   ```

2. **Remove `graphqlClient.ts`** (design-doc-specific client)

3. **Update all imports** across components:
   - Find all files importing from `graphqlClient` → update to `apollo-client`
   - Remove any client-selection logic (no more "which backend?")

4. **Update Apollo Provider** in layout files:
   - Single `<ApolloProvider client={client}>` wrapping the app
   - Remove duplicate providers

### Step 2: Update Auth Flow (1.5h)

1. **Replace `authApi.ts`** with Supabase Auth:
   ```typescript
   // Login
   const { data, error } = await supabase.auth.signInWithPassword({ email, password });

   // Register
   const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });

   // Logout
   await supabase.auth.signOut();

   // Listen to auth changes
   supabase.auth.onAuthStateChange((event, session) => { /* update Redux store */ });
   ```

2. **Update Redux auth store** to use Supabase session:
   - Replace custom token storage with `supabase.auth.getSession()`
   - Auth state derived from Supabase session, not manual JWT storage

3. **Update Firebase OAuth flow**:
   - Firebase sign-in → get Firebase token → POST `/api/auth/firebase` → get Supabase session
   - Update `firebase.ts` to chain through the bridge endpoint

4. **Update protected route checks**:
   - Replace custom `isAuthenticated` checks with `supabase.auth.getUser()`
   - Middleware handles session refresh automatically

### Step 3: Update GraphQL Operations (0.5h)

1. **Queries/mutations files stay mostly the same** (schema preserved)
2. Remove any client-specific options (e.g., `context: { clientName: 'design' }`)
3. Verify all `useQuery` / `useMutation` hooks work with single client

### Step 4: Remove Dead Code (0.5h)

1. Delete `graphqlClient.ts`, `logging-apollo-client.ts`
2. Remove WebSocket client connection code
3. Remove old auth token interceptors
4. Remove dual-client provider wrappers
5. Clean up unused imports

## Todo List
- [ ] Update apollo-client.ts to point to /api/graphql with Supabase token
- [ ] Remove graphqlClient.ts (design-doc client)
- [ ] Update all component imports to use unified client
- [ ] Update Apollo Provider in layout (single provider)
- [ ] Replace authApi.ts with Supabase Auth calls
- [ ] Update Redux auth store for Supabase sessions
- [ ] Update Firebase OAuth flow to use bridge endpoint
- [ ] Update protected route checks
- [ ] Remove client-specific options from queries/mutations
- [ ] Delete dead code (old clients, WebSocket, token interceptors)
- [ ] Test login/register/logout flow
- [ ] Test all pages load data correctly
- [ ] Test Firebase OAuth flow end-to-end

## Success Criteria
- Single Apollo client serves all GraphQL operations
- No references to old backend URLs in codebase
- Auth flow works: register → verify → login → use app → logout
- Firebase OAuth users can sign in
- All existing pages render correctly with data
- No console errors related to GraphQL or auth

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing auth sessions | High | Deploy auth bridge first; support both JWT types temporarily |
| GraphQL query differences between backends | Medium | Schema validated in Phase 2; test each query |
| Apollo cache issues with single client | Low | Clear cache on client switch; test cache policies |

## Security Considerations
- Remove all hardcoded backend URLs from frontend
- Supabase tokens auto-refresh via middleware (no expired token errors)
- Remove any stored JWT tokens from localStorage (use Supabase cookie-based sessions)
- CSP headers updated for same-origin API calls only

## Next Steps
- Phase 07: Deploy to Vercel, clean up old services
