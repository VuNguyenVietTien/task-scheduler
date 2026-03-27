# GraphQL Yoga + Supabase Integration Research

## 1. GraphQL Yoga on Vercel (Next.js App Router)

**Setup Pattern:**
```typescript
// app/api/graphql/route.ts
import { createYoga, createSchema } from 'graphql-yoga'

interface NextContext {
  params: Promise<Record<string, string>>
}

const { handleRequest } = createYoga<NextContext>({
  schema: createSchema({
    typeDefs: `type Query { hello: String }`,
    resolvers: { Query: { hello: () => 'world' } }
  }),
  graphqlEndpoint: '/api/graphql',
  fetchAPI: { Response }
})

export { handleRequest as GET, handleRequest as POST, handleRequest as OPTIONS }
```

**Cold Start Performance:**
- Vercel deploys to AWS Lambda with Edge caching. Bundle size is critical—larger bundles = slower init time.
- Typical cold starts 2-3s for unoptimized GraphQL. Solutions: tree-shake unused code, lazy-load schema builders, minimize dependencies.
- WebSockets unavailable in Next.js serverless; requires custom server if subscriptions needed.

**Schema Stitching:**
- Use `@graphql-tools/schema` + `makeExecutableSchema` or Pothos builder. Combine two schemas via schema composition rather than stitching—no built-in stitching in Yoga. Recommend building unified schema with modular resolvers.

---

## 2. Supabase JS Client (Server-Side)

**API Key Strategy:**
- **Anon Key**: Client-side only, respects RLS (Row Level Security).
- **Service Role Key**: Server-side only, bypasses RLS. Use for admin operations. Never expose client-side.

**Complex Queries:**
- **Joins**: `.select('id, name, posts(id, title)')` for nested relations.
- **JSONB**: `.select('*').filter('metadata->key', 'eq', 'value')` for JSONB columns.
- **RPC Calls**: `supabase.rpc('function_name', { param: value })` for stored procedures.

**Server-Side Pattern (Next.js 13+):**
```typescript
// lib/supabase-server.ts
import { createServerClient } from '@supabase/ssr'

const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Server-only
  { cookies: { ... } }
)
```

Service role key for API routes, edge functions, middleware—Supabase Auth still handles session validation.

---

## 3. Supabase Auth vs Custom JWT

**Supabase Auth Advantages:**
- Built-in RLS integration—auth rules apply across DB, REST, Edge Functions, Realtime.
- Auto token refresh via `@supabase/ssr` middleware in Next.js.
- 50K MAU free tier.
- Dev setup: weeks vs custom JWT: 3-6 months.

**Custom JWT Trade-offs:**
- Full control, but maintenance burden. March 2025 Next.js middleware CVE showed framework bugs bypass auth.
- JWT validation ~8-10ms; short-lived tokens (60s) with auto-refresh balance security.
- Recommended only for non-standard flows; use Supabase or Auth.js for standard auth.

**Middleware Integration:**
- Supabase: `@supabase/ssr` + middleware validates sessions automatically.
- Custom: Manual token verification, refresh logic needed.

---

## 4. Supabase Realtime (WebSocket Alternative)

**Capabilities:**
- **Postgres Changes**: Listen to INSERT/UPDATE/DELETE on tables. Enable via Publications settings.
- **Broadcast**: Low-latency client-to-client messages (chat, cursor tracking, notifications).
- **Presence**: Track online users, active participants across sessions.

**vs WebSocket:**
- Supabase Realtime ≈ WebSocket performance (global distributed).
- Built-in reconnection, auto-recovery.
- Scales horizontally—no custom server needed.
- Perfect for task updates: subscribe to `tasks` table changes, track real-time status.

**Setup:**
```typescript
const channel = supabase
  .channel('schema-db-changes')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'tasks' },
    (payload) => console.log(payload)
  )
  .subscribe()
```

Replaces custom WebSocket layers for most real-time needs.

---

## Unresolved Questions

- Schema composition strategy for merging auth + document schemas in Yoga?
- RLS policies for document visibility (public vs team vs private)?
- Cold start optimization specifics for graphql-tools + Supabase client?
- Migration path from current custom JWT to Supabase Auth—breaking changes?

## Sources

- [GraphQL Yoga Next.js Integration](https://the-guild.dev/graphql/yoga-server/docs/integrations/integration-with-nextjs)
- [Supabase JS Client Docs](https://supabase.com/docs/reference/javascript/introduction)
- [Supabase API Keys & Security](https://supabase.com/docs/guides/api/api-keys)
- [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Next.js GraphQL Serverless - Vercel Cold Starts](https://github.com/vercel/vercel/discussions/7961)
- [Supabase Auth Helpers Next.js](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- [Next.js Authentication 2025 Guide](https://clerk.com/articles/complete-authentication-guide-for-nextjs-app-router-2025)
