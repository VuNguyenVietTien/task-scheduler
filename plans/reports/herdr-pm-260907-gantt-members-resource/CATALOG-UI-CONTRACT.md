# CATALOG-UI-CONTRACT

Status: FROZEN UI handoff, 2026-09-07 Asia/Bangkok.

- Backend authority: `CATALOG-API-CONTRACT.md` SHA-256 `52b5ba307ca9994b6c24e631600e6ada1fb3ebf1096e7f94a22e6c245fe7e00f`.
- Read hook: `useProjectCatalogs(projectId: string | undefined, kind: ProjectCatalogKind)` returns `{ items: ProjectCatalogItem[], loading, error, refetch }`; undefined project skips read, and prior-project items are never exposed for a new project.
- Task UI camel fields: `progressCatalogItemId`, `categoryCatalogItemId`, `taskTypeCatalogItemId`, each optional `string | null` and normalized from `progress_catalog_item_id`, `category_catalog_item_id`, `task_type_catalog_item_id` at every task-tree depth.
- Task writes use backend input keys `progress_catalog_item_id`, `category_catalog_item_id`, `task_type_catalog_item_id`; explicit `null` clears, omitted preserves. Select option values are stable catalog UUIDs, never localized labels or legacy enum values.
- Shared item shape: `catalog_item_id`, `project_id`, `kind`, `display_order`, `labels: [{ locale, name }]`; label fallback is exact locale, language prefix, deterministic first returned label, then ID.

Contract changes require PM coordination.
