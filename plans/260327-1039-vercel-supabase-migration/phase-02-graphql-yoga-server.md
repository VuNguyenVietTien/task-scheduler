# Phase 02: GraphQL Yoga Server

## Context Links
- Parent: [plan.md](./plan.md)
- Depends on: [Phase 01](./phase-01-foundation-supabase-setup.md)
- Research: [GraphQL + Supabase](./research/researcher-01-graphql-supabase.md)

## Overview
- **Date**: 2026-03-27
- **Priority**: P1 (blocks Phases 3-5)
- **Status**: complete
- **Effort**: 6h
- **Description**: Set up GraphQL Yoga in a single API route, define unified TypeScript schema structure, create resolver patterns, context setup with auth + Supabase.

## Key Insights
- GraphQL Yoga works natively with Next.js App Router route handlers
- Build unified schema with `@graphql-tools/schema` (modular type defs + resolvers)
- No schema stitching needed; compose types and resolvers by domain module
- Context injects authenticated Supabase client per request
- Cold start optimization: lazy-load resolvers, minimize imports

## Requirements

### Functional
- Single `/api/graphql` endpoint serves all queries/mutations
- Schema merges all types from both backends (task-scheduler + design-doc)
- Context provides authenticated user + Supabase client to every resolver
- GraphiQL playground available in development
- Proper error handling with GraphQL error extensions

### Non-Functional
- Cold start < 3s (optimize bundle)
- Response time < 500ms for typical queries
- Schema validates at build time

## Architecture

```
web/src/
├── app/api/graphql/
│   └── route.ts                    # GraphQL Yoga handler (GET/POST/OPTIONS)
├── lib/graphql/
│   ├── schema.ts                   # Merged executable schema
│   ├── context.ts                  # Context factory (auth + supabase)
│   ├── types/
│   │   ├── task-scheduler.ts       # Type defs: projects, tasks, users, etc.
│   │   └── design-doc.ts           # Type defs: systems, modules, documents, etc.
│   ├── resolvers/
│   │   ├── index.ts                # Merged resolver map
│   │   ├── project.ts              # Project queries/mutations
│   │   ├── task.ts                 # Task queries/mutations
│   │   ├── user.ts                 # User queries/mutations
│   │   ├── member.ts               # Member queries/mutations
│   │   ├── notification.ts         # Notification queries/mutations
│   │   ├── plan.ts                 # Plan queries/mutations
│   │   ├── comment.ts              # Comment mutations
│   │   ├── attachment.ts           # Attachment mutations
│   │   ├── system.ts               # Design system queries
│   │   ├── module.ts               # Module queries/mutations
│   │   ├── document.ts             # Document queries/mutations
│   │   ├── screen.ts               # Screen queries/mutations
│   │   ├── component.ts            # Component queries/mutations
│   │   ├── flow.ts                 # Flow queries/mutations
│   │   └── tag.ts                  # Tag queries/mutations
│   └── utils/
│       ├── error-handler.ts        # GraphQL error formatting
│       └── pagination.ts           # Shared pagination helpers
```

## Related Code Files

### Create
- `web/src/app/api/graphql/route.ts`
- `web/src/lib/graphql/schema.ts`
- `web/src/lib/graphql/context.ts`
- `web/src/lib/graphql/types/task-scheduler.ts`
- `web/src/lib/graphql/types/design-doc.ts`
- `web/src/lib/graphql/resolvers/index.ts`
- `web/src/lib/graphql/resolvers/` (all resolver files)
- `web/src/lib/graphql/utils/error-handler.ts`
- `web/src/lib/graphql/utils/pagination.ts`

### Modify
- `web/package.json` - Add `graphql-yoga`, `graphql`, `@graphql-tools/schema`

## Implementation Steps

1. **Install dependencies**
   ```bash
   npm install graphql-yoga graphql @graphql-tools/schema
   ```

2. **Create context factory** (`lib/graphql/context.ts`)
   ```typescript
   // Extract auth token from request headers
   // Create user-scoped Supabase client
   // Return { user, supabase, supabaseAdmin }
   export interface GraphQLContext {
     user: User | null;
     supabase: SupabaseClient;      // User-scoped (RLS)
     supabaseAdmin: SupabaseClient;  // Service role (bypass RLS)
   }
   ```

3. **Define type definitions** (SDL strings)
   - `types/task-scheduler.ts`: Project, Task, User, Member, Notification, Plan, Comment, Attachment types + Query/Mutation extensions
   - `types/design-doc.ts`: System, Module, Document, Screen, Component, Flow, Tag, ExternalLink types + Query/Mutation extensions
   - Use `extend type Query` / `extend type Mutation` pattern for modular composition

4. **Create resolver stubs** (one file per domain)
   - Each file exports `{ Query: {...}, Mutation: {...}, TypeResolvers: {...} }`
   - Actual DB logic implemented in Phases 3-4
   - Phase 2 creates skeleton with `TODO` markers

5. **Merge schema** (`lib/graphql/schema.ts`)
   ```typescript
   import { makeExecutableSchema } from '@graphql-tools/schema';
   import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';
   // Combine all type defs and resolvers into single schema
   ```

6. **Create route handler** (`app/api/graphql/route.ts`)
   ```typescript
   const yoga = createYoga({
     schema,
     graphqlEndpoint: '/api/graphql',
     context: createContext,
     fetchAPI: { Response },
   });
   export { yoga as GET, yoga as POST, yoga as OPTIONS };
   ```

7. **Error handling** (`utils/error-handler.ts`)
   - Map domain errors to GraphQL errors with proper extensions
   - Log server errors, sanitize client-facing messages

8. **Pagination helper** (`utils/pagination.ts`)
   - Shared `offset/limit` pattern matching current backend behavior
   - Optional cursor-based pagination for future use

## Todo List
- [ ] Install graphql-yoga + graphql-tools dependencies
- [ ] Create GraphQL context factory with auth + Supabase
- [ ] Define task-scheduler type definitions
- [ ] Define design-doc type definitions
- [ ] Create resolver stub files (all domains)
- [ ] Create merged schema builder
- [ ] Create API route handler
- [ ] Create error handling utilities
- [ ] Create pagination helpers
- [ ] Verify GraphiQL playground works in dev
- [ ] Test basic query execution

## Success Criteria
- `/api/graphql` responds to POST requests
- GraphiQL accessible in development mode
- Schema includes all types from both backends
- Context correctly provides authenticated user + Supabase client
- Resolver stubs return placeholder data

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Cold start too slow with full schema | High | Lazy-load resolver modules; tree-shake |
| Schema conflicts between backends | Medium | Namespace prefixes if needed (e.g., `DesignDocument` vs `Document`) |
| Bundle size exceeds Vercel limits | Medium | Monitor with `@next/bundle-analyzer` |

## Security Considerations
- Validate auth token in context factory before resolvers execute
- Never expose service role key in schema or error messages
- Rate limit GraphQL endpoint (complexity analysis or depth limiting)
- Disable introspection in production

## Next Steps
- Phase 03: Implement task-scheduler resolvers (fill in stubs)
- Phase 04: Implement design-doc resolvers (fill in stubs)
