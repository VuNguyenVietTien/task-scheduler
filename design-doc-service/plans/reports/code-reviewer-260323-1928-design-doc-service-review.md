# Code Review: design-doc-service + Frontend Design Viewer

**Date:** 2026-03-23
**Scope:** Backend Rust microservice (all resolvers, queries, auth, SVG service) + Frontend TSX components (designs/)
**LOC:** ~2,800 backend, ~700 frontend

## Overall Assessment

Solid foundation. Auth checks on top-level queries/mutations are consistent. SQL injection risk is mitigated by sqlx parameterized queries throughout. Frontend uses DOMPurify for SVG sanitization (good). Several high-confidence issues found below.

---

## Critical Issues

- **[CRITICAL] Backend SVG sanitization never called on write path**
  - `src/graphql/resolvers/screen.rs:138-161` -- `update_screen` accepts `svg_content` and stores it directly via `queries::update_screen()` without calling `validate_svg()` or `sanitize_svg()` from `svg_service.rs`. The SVG service exists but is dead code in production.
  - **Impact:** Malicious SVG with `<script>` or event handlers stored in DB, served to all viewers. Frontend DOMPurify mitigates on render, but any non-browser consumer (API export, AI export endpoint) gets raw malicious SVG.
  - **Fix:** Call `svg_service::validate_svg(&svg, config.max_svg_size)` and `svg_service::sanitize_svg(&svg)` before passing to `queries::update_screen()`.

- **[CRITICAL] Frontend MermaidFlowViewer XSS via error fallback**
  - `task-scheduler-frontend/src/components/designs/mermaid-flow-viewer.tsx:50` -- On mermaid parse failure, raw `mermaidDefinition` is interpolated into innerHTML via template literal: `` `<pre ...>${mermaidDefinition}</pre>` ``. User-controlled mermaid definition can contain `</pre><img src=x onerror=alert(1)>`.
  - **Impact:** Stored XSS. Any user who saves a malicious mermaid definition triggers script execution for all viewers.
  - **Fix:** Use `textContent` instead of `innerHTML` for the error fallback:
    ```ts
    const pre = document.createElement('pre');
    pre.className = 'text-red-500 text-xs p-2 whitespace-pre-wrap';
    pre.textContent = mermaidDefinition;
    containerRef.current.replaceChildren(pre);
    ```

## High Priority

- **[HIGH] `set_config` + connection pool race condition**
  - `src/graphql/resolvers/document.rs:189-193`, `screen.rs:121-125`, `system.rs:109-113`, `module.rs:111-115` -- `set_config('app.user_id', ...)` is called with `true` (local to transaction), but the subsequent query runs on a separate `.execute(&pool)` / `.fetch_one(&pool)` call. With a connection pool, there is no guarantee both statements run on the same connection.
  - **Impact:** Audit triggers may record wrong user_id or fail silently.
  - **Fix:** Use an explicit transaction (`pool.begin()`) to ensure `set_config` and the INSERT/UPDATE run on the same connection.

- **[HIGH] Frontend `pasteDesign` / `updateDesignFromPaste` mutations reference non-existent backend resolvers**
  - `task-scheduler-frontend/src/graphql/mutations/designs.ts:58-88` -- `PASTE_DESIGN` and `UPDATE_DESIGN_FROM_PASTE` mutations call `pasteDesign` and `updateDesignFromPaste` which do not exist in the backend schema. No resolver implements them.
  - **Impact:** Runtime GraphQL error when user pastes a design. Feature is broken.
  - **Fix:** Implement `paste_design` and `update_design_from_paste` mutations in backend, or refactor frontend to use existing `createScreen` + `updateScreen` mutations.

- **[HIGH] `entity_type` accepts arbitrary strings -- no validation**
  - `src/graphql/resolvers/tag.rs:58-62` (`AddEntityTagInput`), `external_link.rs:44-50` (`LinkExternalInput`), `tag.rs:90` (entity_tags query) -- `entity_type` is a free-form `String`. No validation that it is one of the expected values ("system", "module", "document", "screen", "component").
  - **Impact:** Garbage data in DB, broken tag/link lookups, potential confusion in impact analysis.
  - **Fix:** Add an enum or validation check. Example:
    ```rust
    const VALID_ENTITY_TYPES: &[&str] = &["system", "module", "document", "screen", "component"];
    if !VALID_ENTITY_TYPES.contains(&input.entity_type.as_str()) {
        return Err(AppError::Validation(format!("Invalid entity_type: {}", input.entity_type)).into_graphql_error());
    }
    ```

- **[HIGH] `ScreenType.components` ComplexObject returns empty vec (stub)**
  - `src/graphql/resolvers/screen.rs:31-37` -- Always returns `Ok(vec![])`. Frontend (`design-viewer-split-pane.tsx:58`) relies on `screen.components` to render the component table and SVG interaction.
  - **Impact:** Component list never populated when querying through document -> screens -> components path. Only direct `components(screenId)` query works.
  - **Fix:** Implement the resolver to call `component_q::list_components(&gql_ctx.pool, self.id)`.

## Medium Priority

- **[MEDIUM] `add_entity_tag` uses `fetch_one` after `ON CONFLICT DO NOTHING`**
  - `src/db/queries/tag.rs:47-54` -- When a duplicate entity_tag already exists, `ON CONFLICT DO NOTHING` returns zero rows, causing `fetch_one` to return `RowNotFound` error.
  - **Impact:** Adding a tag that already exists returns a database error instead of being idempotent.
  - **Fix:** Use `ON CONFLICT ... DO UPDATE SET tag_id = EXCLUDED.tag_id RETURNING *` or use `fetch_optional` and handle the None case.

- **[MEDIUM] `AppError::Database` leaks internal DB details to GraphQL clients**
  - `src/error.rs:6` -- `Database(#[from] sqlx::Error)` uses the sqlx error message directly in the GraphQL response (`self.to_string()`). This can expose table names, column names, constraint names.
  - **Fix:** Map `AppError::Database` to a generic message in `into_graphql_error()`:
    ```rust
    AppError::Database(ref e) => {
        tracing::error!("Database error: {}", e);
        "DATABASE_ERROR"
    }
    // And use a generic display message instead of e.to_string()
    ```

- **[MEDIUM] `document.status` accepts arbitrary strings**
  - `src/graphql/resolvers/document.rs:130` -- Comment says "draft -> review -> approved -> archived" but no validation enforced. Any string is accepted.
  - **Fix:** Validate against allowed statuses before calling update query.

- **[MEDIUM] GraphiQL playground exposed unconditionally**
  - `src/main.rs:65-69` -- GraphiQL is served on GET `/graphql` in all environments including production.
  - **Fix:** Gate behind a config flag or `cfg!(debug_assertions)`.

## Low Priority

- **[LOW] Frontend `components: any[]` type across multiple components** -- `design-frame-interactive-svg.tsx:7`, `component-description-table.tsx:6`, `design-viewer-split-pane.tsx:8` all use `any[]`. Type-safe interfaces would catch mismatched field names at compile time.

- **[LOW] Event listener cleanup missing in `design-frame-interactive-svg.tsx`** -- The `useEffect` at line 29-61 adds click/mouseenter/mouseleave listeners but the cleanup function does not remove them. React re-runs the effect on prop changes, accumulating duplicate listeners.

## Positive Observations

- All top-level Query and Mutation resolvers consistently call `require_auth()` or `user_id()` -- no missing auth on any resolver entry point
- SQL queries use parameterized binds exclusively via sqlx -- no string interpolation for SQL
- Frontend SVG sanitizer uses DOMPurify with a well-configured SVG profile
- Error handling pattern (`AppError.into_graphql_error()`) is consistent and ergonomic
- `CSS.escape()` used for SVG element ID selectors, preventing selector injection
- Mermaid initialized with `securityLevel: 'strict'`

## Unresolved Questions

1. Is the `PasteDesign` mutation planned for a future phase, or should the frontend be rewired to use `createScreen` + `updateScreen`?
2. Should `ComplexObject` field resolvers (e.g., `DocumentType.screens`, `SystemType.modules`) also enforce auth, or is parent-level auth sufficient for the access model?
3. What is the intended scope for `entity_type` values -- is there a plan to support custom entity types or should it be a strict enum?
