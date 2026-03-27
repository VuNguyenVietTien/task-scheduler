---
title: "Vercel + Supabase Migration"
description: "Full rewrite of Rust microservices into Next.js with Supabase, deployed on Vercel"
status: in_progress
priority: P1
effort: "40h"
branch: feat/v2.29
tags: [migration, vercel, supabase, graphql, nextjs]
created: 2026-03-27
---

# Vercel + Supabase Migration Plan

## Summary
Rewrite both Rust backends (task-scheduler + design-doc-service) into a new unified Next.js project (`web/`) with GraphQL Yoga and Supabase JS client. Existing `frontend/` stays untouched until `web/` is fully complete. Single Vercel deployment replaces Docker multi-service architecture.

## Architecture
- **GraphQL**: GraphQL Yoga in `/api/graphql/route.ts` (unified schema)
- **Database**: Supabase JS client (server-side with service role key)
- **Auth**: Supabase Auth + Firebase OAuth bridge
- **Real-time**: Supabase Realtime (replaces WebSocket)
- **Storage**: Supabase Storage (replaces local file system)
- **Push**: Firebase Admin SDK from serverless functions

## Phases

| # | Phase | Effort | Status | File |
|---|-------|--------|--------|------|
| 1 | Foundation & Supabase Setup | 4h | complete | [phase-01](./phase-01-foundation-supabase-setup.md) |
| 2 | GraphQL Yoga Server | 6h | complete | [phase-02](./phase-02-graphql-yoga-server.md) |
| 3 | Task Scheduler Migration | 10h | complete | [phase-03](./phase-03-task-scheduler-migration.md) |
| 4 | Design Doc Service Migration | 8h | complete | [phase-04](./phase-04-design-doc-migration.md) |
| 5 | Real-time & WebSocket Migration | 4h | complete | [phase-05](./phase-05-realtime-migration.md) |
| 6 | Frontend Refactoring | 4h | complete | [phase-06](./phase-06-frontend-refactoring.md) |
| 7 | Vercel Deployment & Cleanup | 4h | complete | [phase-07](./phase-07-vercel-deployment-cleanup.md) |

## Key Dependencies
- Phase 1 blocks all others (Supabase client + auth foundation)
- Phase 2 blocks Phases 3-4 (GraphQL server must exist first)
- Phases 3-4 can run in parallel after Phase 2
- Phase 5 depends on Phases 3-4 (need resolvers before real-time)
- Phase 6 depends on Phases 2-5 (frontend adapts to new backend)
- Phase 7 is final cleanup

## Key Risks
- **10s function timeout** (Hobby plan) — all operations must complete within 10s
- 4.5MB payload limit (mitigate: paginate large queries, stream files)
- Supabase JS query limitations vs raw SQL (mitigate: use RPC for complex queries)
- Auth migration breaking existing sessions (mitigate: create-on-first-login)

## Research Reports
- [GraphQL + Supabase](./research/researcher-01-graphql-supabase.md)
- [Vercel Migration](./research/researcher-02-vercel-migration.md)
- [Backend Scope](./scout/scout-01-backend-scope.md)

## Validation Log

### Session 1 — 2026-03-27
**Trigger:** Initial plan creation validation
**Questions asked:** 7

#### Questions & Answers

1. **[Auth]** The plan assumes migrating to Supabase Auth (replacing custom JWT). How should existing user migration be handled?
   - Options: Create on first login | Batch migrate all users | Keep custom JWT
   - **Answer:** Create on first login
   - **Rationale:** Zero-downtime gradual migration. On first login, verify against old auth, auto-create Supabase user.

2. **[Infrastructure]** Vercel Pro plan ($20/mo) is required for 60s function timeout. Are you on Vercel Pro?
   - Options: Yes, Pro plan | Hobby plan only | Decide later
   - **Answer:** Hobby plan only
   - **Rationale:** Critical constraint — all API routes must complete within 10s. Requires aggressive optimization.

3. **[Architecture]** Comments, attachments, media are currently REST. Stay REST or move to GraphQL?
   - Options: Move to GraphQL | Keep as REST | Hybrid
   - **Answer:** Move to GraphQL
   - **Rationale:** Unify everything under /api/graphql. Simpler frontend, single endpoint. File uploads via presigned URLs.

4. **[Database]** Complex queries need PostgreSQL RPC functions. Comfortable maintaining SQL in Supabase?
   - Options: Yes, use RPC | Avoid RPCs, simplify | Use Prisma
   - **Answer:** Yes, use RPC functions
   - **Rationale:** Best performance for impact analysis, deep joins. Maintain via Supabase SQL editor/migrations.

5. **[Performance]** With 10s timeout, FCM push and file uploads may timeout. How to handle?
   - Options: Optimize everything for 10s | Vercel cron for heavy tasks | Accept some timeouts
   - **Answer:** Optimize everything for 10s
   - **Rationale:** Fire-and-forget FCM, client-side direct upload to Supabase Storage (bypass API route).

6. **[Scope]** Include WebSocket→Supabase Realtime migration or defer?
   - Options: Include in migration | Defer post-launch | Tasks only
   - **Answer:** Include in migration
   - **Rationale:** Supabase Realtime is straightforward. Better UX from day one.

7. **[Structure]** Keep existing frontend/ or create new unified project?
   - Options: web/ | app/ | nextjs/
   - **Answer:** New `web/` directory
   - **Rationale:** Keep `frontend/` untouched as working codebase. Copy into `web/`, refactor there. Switch over when complete.

#### Confirmed Decisions
- **Auth**: Supabase Auth with create-on-first-login migration
- **Vercel**: Hobby plan (10s timeout) — optimize aggressively
- **API**: All endpoints unified under GraphQL (no REST)
- **Complex queries**: PostgreSQL RPC functions via supabase.rpc()
- **Performance**: Fire-and-forget FCM, client-direct Supabase Storage uploads
- **Realtime**: Include Supabase Realtime in migration
- **Project structure**: New `web/` folder, copy frontend code, refactor there

#### Action Items
- [ ] Update all phase files: change `frontend/` paths to `web/`
- [ ] Add Phase 0 or update Phase 1: copy `frontend/` → `web/` step
- [ ] Update Phase 3: fire-and-forget FCM, client-direct uploads
- [ ] Update all phases: remove Pro plan assumption, add 10s optimization notes
- [ ] Update Phase 3: move comments/attachments/media from REST to GraphQL

#### Impact on Phases
- **All phases**: Change all `frontend/src/` paths to `web/src/`
- **Phase 1**: Add step to copy `frontend/` → `web/` and set up as standalone project
- **Phase 3**: FCM fire-and-forget; file uploads via client-direct to Supabase Storage; move comments/attachments/media into GraphQL schema
- **Phase 7**: Update to reflect `web/` replaces `frontend/` only after full validation
