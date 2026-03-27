# Phase 01: Foundation & Supabase Setup

## Context Links
- Parent: [plan.md](./plan.md)
- Research: [GraphQL + Supabase](./research/researcher-01-graphql-supabase.md), [Vercel Migration](./research/researcher-02-vercel-migration.md)
- Dependencies: None (first phase)

## Overview
- **Date**: 2026-03-27
- **Priority**: P1 (blocks all other phases)
- **Status**: complete
- **Effort**: 4h
- **Description**: Set up Supabase client library, configure auth, create middleware, set environment variables, define RLS policies.

## Key Insights
- Use `@supabase/ssr` for server-side client creation with cookie-based sessions
- Service role key for API routes (bypasses RLS), anon key for client-side
- Module-level singleton pattern avoids connection pool exhaustion in serverless
- Supabase Auth handles JWT refresh automatically via middleware

## Requirements

### Functional
- Supabase server client callable from any API route/resolver
- Supabase browser client for frontend real-time subscriptions
- Auth middleware validates sessions on all `/api/*` routes
- Firebase OAuth tokens exchangeable for Supabase sessions
- RLS policies enforce project-level access control

### Non-Functional
- Client initialization < 50ms (singleton pattern)
- Auth validation < 10ms per request
- Zero secret exposure to client bundle

## Architecture

```
web/src/
├── lib/
│   └── supabase/
│       ├── server.ts          # createServerClient (API routes, RSC)
│       ├── client.ts          # createBrowserClient (client components)
│       ├── middleware.ts       # Session refresh logic
│       └── types.ts           # Database type definitions (generated)
├── middleware.ts               # Next.js middleware (auth check)
```

## Related Code Files

### Create
- `web/src/lib/supabase/server.ts` - Server-side Supabase client factory
- `web/src/lib/supabase/client.ts` - Browser Supabase client singleton
- `web/src/lib/supabase/middleware.ts` - Auth session refresh helper
- `web/src/lib/supabase/types.ts` - Generated DB types (from `supabase gen types`)
- `web/src/middleware.ts` - Root middleware (auth + CORS)

### Modify
- `web/package.json` - Add `@supabase/supabase-js`, `@supabase/ssr`
- `web/.env.local` - Add Supabase env vars

### Delete
- None in this phase

## Implementation Steps

<!-- Updated: Validation Session 1 - New web/ project structure -->

1. **Create `web/` project by copying `frontend/`**
   ```bash
   cp -r frontend/ web/
   cd web && rm -rf node_modules .next
   ```
   - Existing `frontend/` stays untouched as working codebase
   - All subsequent work happens in `web/`

2. **Install dependencies**
   ```bash
   cd web && npm install @supabase/supabase-js @supabase/ssr
   ```

3. **Generate Supabase DB types**
   ```bash
   npx supabase gen types typescript --project-id <project-id> > src/lib/supabase/types.ts
   ```

4. **Create server client** (`lib/supabase/server.ts`)
   - Use `createServerClient` from `@supabase/ssr`
   - Accept `cookies()` from `next/headers` for session handling
   - Use `SUPABASE_SERVICE_ROLE_KEY` for admin operations
   - Use `NEXT_PUBLIC_SUPABASE_ANON_KEY` for user-scoped operations

5. **Create browser client** (`lib/supabase/client.ts`)
   - Use `createBrowserClient` from `@supabase/ssr`
   - Singleton pattern (module-level variable)
   - Only uses anon key (public)

6. **Create middleware helper** (`lib/supabase/middleware.ts`)
   - Refresh expired sessions via `supabase.auth.getUser()`
   - Set updated cookies on response
   - Return user object or null

7. **Create Next.js middleware** (`middleware.ts`)
   - Match `/api/:path*` routes
   - Call middleware helper to refresh session
   - Allow unauthenticated access to `/api/auth/*`
   - Return 401 for unauthenticated requests to protected routes

8. **Configure environment variables**
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   ```

9. **Set up RLS policies** (SQL migration)
   - `projects`: Members can read; owners can write
   - `tasks`: Project members can CRUD
   - `notifications`: Users can read/update own
   - `documents/screens/components`: System-level access (design-doc)
   - Service role key bypasses RLS for server-side operations

10. **Firebase-to-Supabase auth bridge**
   - Create `/api/auth/firebase/route.ts`
   - Verify Firebase token with `firebase-admin`
   - Create/update Supabase user via `supabase.auth.admin.createUser()` or sign in
   - Return Supabase session tokens

## Todo List
- [ ] Copy `frontend/` → `web/` (clean node_modules, .next)
- [ ] Install `@supabase/supabase-js` and `@supabase/ssr`
- [ ] Generate TypeScript types from Supabase schema
- [ ] Implement server client factory
- [ ] Implement browser client singleton
- [ ] Implement middleware session refresh
- [ ] Create Next.js root middleware
- [ ] Set up environment variables
- [ ] Write RLS policies SQL migration
- [ ] Implement Firebase-to-Supabase auth bridge
- [ ] Test auth flow end-to-end

## Success Criteria
- Server client successfully queries Supabase from API route
- Browser client connects and authenticates
- Middleware correctly refreshes expired sessions
- Firebase OAuth users get valid Supabase sessions
- RLS policies block unauthorized access
- No secrets leak to client bundle

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Firebase-Supabase auth sync issues | High | Maintain dual auth during transition; log mismatches |
| RLS policies too restrictive | Medium | Start permissive with service role, tighten incrementally |
| Cookie size limits for sessions | Low | Use JWT-based sessions, not cookie storage |

## Security Considerations
- Service role key stored only in server env vars (never `NEXT_PUBLIC_*`)
- RLS policies as defense-in-depth (server validates too)
- CORS configured in middleware for allowed origins
- Rate limiting on auth endpoints

## Next Steps
- Phase 02: Set up GraphQL Yoga server that uses these Supabase clients
