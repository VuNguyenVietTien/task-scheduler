# Phase Implementation Report

## Executed Phase
- Phase: Phase 4 — Design Doc Service Migration
- Plan: plans/260327-1039-vercel-supabase-migration/
- Status: completed

## Files Modified

### Services Created (new)
- `src/services/system-service.ts` — 50 lines
- `src/services/module-service.ts` — 51 lines
- `src/services/document-service.ts` — 66 lines
- `src/services/screen-service.ts` — 66 lines
- `src/services/component-service.ts` — 44 lines
- `src/services/flow-service.ts` — 44 lines
- `src/services/tag-service.ts` — 37 lines
- `src/services/external-link-service.ts` — 37 lines
- `src/services/audit-service.ts` — 32 lines

### Resolvers Updated (existing stubs replaced)
- `src/lib/graphql/resolvers/system.ts` — wired systemService + nested module/tag resolvers
- `src/lib/graphql/resolvers/module.ts` — wired moduleService + nested document/tag resolvers
- `src/lib/graphql/resolvers/document.ts` — wired documentService + nested screens/tags/flows/versions/links resolvers
- `src/lib/graphql/resolvers/screen.ts` — wired screenService + nested component/tag resolvers + paste_design
- `src/lib/graphql/resolvers/component.ts` — wired componentService + inline field_mappings resolver
- `src/lib/graphql/resolvers/flow.ts` — wired flowService
- `src/lib/graphql/resolvers/tag.ts` — wired tagService
- `src/lib/graphql/resolvers/external-link.ts` — wired externalLinkService

## Tasks Completed
- [x] Create system-service.ts
- [x] Create module-service.ts
- [x] Create document-service.ts (with audit trail on create/update)
- [x] Create screen-service.ts (with pasteDesign)
- [x] Create component-service.ts (with field_mappings join)
- [x] Create flow-service.ts
- [x] Create tag-service.ts
- [x] Create external-link-service.ts
- [x] Create audit-service.ts (fire-and-forget)
- [x] Update all 8 resolver files — replace TODO stubs with service calls
- [x] All mutations call requireAuth(ctx.user)
- [x] All queries use ctx.supabaseAdmin
- [x] document_versions nested resolver queries audits table
- [x] Component.field_mappings uses inline direct query

## Tests Status
- Type check: pass (zero errors in Phase 4 files)
- Pre-existing errors: 1 in `src/lib/services/notification-service.ts` (not Phase 4 scope), plus various pre-existing errors in auth/comment/dashboard files — all unrelated to this phase

## Issues Encountered
- `insert(input as never).select().single()` returns `data: never` — fixed in `document-service.ts` via explicit `as { data: DocumentRow | null; error: unknown }` cast on `.single()` call
- `component-service.ts` uses `select('*, field_mappings(*)')` join — this works if FK relation exists in schema; resolver also has fallback direct query in `Component.field_mappings`

## Next Steps
- Phase 5: Real-time & WebSocket Migration can proceed
- Verify `systems` table has `project_id` column (types.ts shows it missing from Row definition — may need schema update or types regeneration)

## Unresolved Questions
1. `Database['public']['Tables']['systems']['Row']` does not include `project_id` in `src/lib/supabase/types.ts` — `getSystems` filters by `project_id` but it will typecheck only because we use `SupabaseClient<Database>` generic. If the actual Supabase table has the column, this will work at runtime. If not, query will silently return all rows. Recommend running `npx supabase gen types typescript` to regenerate from actual schema.
2. `component-service.getComponents` does `select('*, field_mappings(*)')` — if PostgREST FK join isn't configured, this returns components without the nested array. The `Component.field_mappings` resolver in `component.ts` also queries the table directly as fallback, so data will be available either way.
