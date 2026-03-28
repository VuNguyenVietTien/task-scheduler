---
title: "Migrate design-doc-service DB to Supabase"
description: "Point design-doc-service Rust backend at shared Supabase PostgreSQL, fix schema conflicts"
status: pending
priority: P1
effort: 2h
branch: feat/vercel-supabase-migration
tags: [database, migration, supabase, design-doc-service]
created: 2026-03-28
---

# Migrate design-doc-service from Local PostgreSQL to Supabase

## Summary

The web project already has a unified Supabase migration (`web/supabase/migrations/00001_initial_schema.sql`) that includes ALL design-doc-service tables. The tables already exist in the Supabase database. This migration is primarily a **connection string swap** plus **fixing two schema conflicts**.

## Current State

- **design-doc-service** connects via `DESIGN_DOC_DATABASE_URL=postgres://user:pass@localhost:5432/design_doc_db`
- **web project** uses Supabase JS client with `NEXT_PUBLIC_SUPABASE_URL` + keys (no raw `DATABASE_URL`)
- Supabase connection string format: `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres` (transaction pooler) or port `5432` for session mode
- SQLx in Rust needs the **session mode** (port 5432) or **direct connection** (port 5432) because it uses prepared statements

## Schema: Tables in Supabase (Already Created)

All design-doc tables exist in `00001_initial_schema.sql`:

| Table | Status in Supabase | Conflict? |
|---|---|---|
| `systems` | Exists (project_id TEXT, created_by TEXT) | None |
| `modules` | Exists | None |
| `design_documents` | Exists (created_by TEXT) | None |
| `screens` | Exists (includes content_type column) | None |
| `components` | Exists | None |
| `field_mappings` | Exists | None |
| `flows` | Exists | None |
| `flow_steps` | Exists | None |
| **`design_tags`** | Exists | **CONFLICT: renamed from `tags` to `design_tags`** |
| `entity_tags` | Exists (FK refs `design_tags`) | None |
| `external_links` | Exists | None |
| `document_audit` | Exists (**changed_by TEXT**) | **CONFLICT: Rust model has `changed_by: i64`** |

## Critical Conflicts to Fix

### 1. Table Name: `tags` -> `design_tags`

Supabase schema renamed `tags` to `design_tags` to avoid collision with the project-level `tags` table. The design-doc-service Rust code queries `FROM tags` in 4 places.

**Files to change:**
- `src/db/queries/tag.rs` -- 4 SQL statements reference `tags`, must change to `design_tags`

### 2. Column Type: `document_audit.changed_by` is TEXT in Supabase, i64 in Rust

Supabase schema has `changed_by TEXT`. The original local migration had `changed_by BIGINT`, and Rust model maps it as `i64`.

**Files to change:**
- `src/db/models/audit.rs` -- change `changed_by: i64` to `changed_by: String`
- `src/graphql/resolvers/document.rs` -- change `changed_by: i64` to `changed_by: String` in GraphQL type

### 3. Auto-migration conflict with `sqlx::migrate!`

`main.rs` line 33 runs `sqlx::migrate!("./migrations")` on startup. These local migrations will fail against Supabase because:
- Tables already exist
- The `tags` table (from migration 5) conflicts with the project-level `tags` table
- `_sqlx_migrations` table won't have records for these migrations

**Options:**
- A) Remove `sqlx::migrate!()` call entirely -- tables already managed by Supabase migrations
- B) Add `IF NOT EXISTS` to all migration SQL -- safe but unnecessary duplication
- **Recommended: Option A** -- Supabase owns the schema

---

## Step-by-Step Migration Actions

### Phase 1: Fix Schema Conflicts in Rust Code

**1.1 Rename `tags` to `design_tags` in queries**

File: `src/db/queries/tag.rs`
- Line 6: `FROM tags` -> `FROM design_tags`
- Line 12: `INTO tags` -> `INTO design_tags`
- Line 20: `FROM tags` -> `FROM design_tags`
- Line 33: `FROM tags t` -> `FROM design_tags t`

**1.2 Fix `changed_by` type in audit model**

File: `src/db/models/audit.rs`
- Line 14: `pub changed_by: i64` -> `pub changed_by: String`

File: `src/graphql/resolvers/document.rs`
- Line 22: `pub changed_by: i64` -> `pub changed_by: String` (in `DocumentVersionType`)
- Line 35: verify the mapping `changed_by: a.changed_by` still works (it will, both are now String)

**1.3 Remove auto-migration from main.rs**

File: `src/main.rs`
- Remove lines 32-36 (the `sqlx::migrate!("./migrations").run(&pool)` block)
- Keep the log line or replace with a connection-verified log

### Phase 2: Update Connection Config

**2.1 Update `.env` with Supabase connection string**

File: `design-doc-service/.env`
```
DESIGN_DOC_DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

**Important:** Use port `5432` (session mode) not `6543` (transaction mode). SQLx uses prepared statements which require session-mode pooling.

Alternatively, use the direct connection string from Supabase dashboard:
```
DESIGN_DOC_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

**2.2 Update `.env.example`**

File: `design-doc-service/.env.example`
```
DESIGN_DOC_DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
```

### Phase 3: Verify & Test

- [ ] `cargo build` passes (SQLx compile-time checks)
- [ ] Connect to Supabase and verify tables exist
- [ ] Test CRUD on systems, documents, screens, components
- [ ] Test tag operations (design_tags table)
- [ ] Test audit trail (changed_by as TEXT)
- [ ] Verify existing web project still works (no schema changes needed on Supabase side)

---

## Files to Change (Summary)

| File | Change |
|---|---|
| `src/db/queries/tag.rs` | `tags` -> `design_tags` (4 occurrences) |
| `src/db/models/audit.rs` | `changed_by: i64` -> `changed_by: String` |
| `src/graphql/resolvers/document.rs` | `changed_by: i64` -> `changed_by: String` |
| `src/main.rs` | Remove `sqlx::migrate!()` block |
| `.env` | Update `DESIGN_DOC_DATABASE_URL` to Supabase |
| `.env.example` | Update example connection string |

## RLS Considerations

Supabase has Row Level Security (RLS) enabled by default on new tables. The design-doc-service connects as `postgres` role (via connection string), which **bypasses RLS**. No RLS policies needed for this service.

If RLS is enabled on the design-doc tables and you want it to apply, you would need to:
1. Create a service role or use the `anon`/`authenticated` roles
2. Set `role` in the connection or use Supabase service_role key

**Recommendation:** Keep using postgres role (bypasses RLS). The Rust service handles auth via JWT internally.

## Unresolved Questions

1. **Supabase connection credentials**: Need the actual project ref, password, and region from the Supabase dashboard or `web/.env.local`. The `.env.local` was privacy-blocked.
2. **Data migration**: If the local DB has existing data that needs to be preserved, a `pg_dump`/`pg_restore` or manual INSERT migration is needed. This plan assumes fresh start or data already migrated.
3. **SQLx offline mode**: If using `sqlx::compile_time_checked` queries, you may need to regenerate `.sqlx` cache against the Supabase DB. Run `cargo sqlx prepare` after connecting.
