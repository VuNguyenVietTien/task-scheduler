# PROGRESS-CATALOG-DESIGN

**Status: DONE — read-only implementation contract.** 2026-09-07 Asia/Bangkok. No source, SQL, test, DB, browser, artifact, or release changes.

## Cause, existing catalog boundary, decision

`tasks.progress_type` is nullable PostgreSQL enum `task_progress_type` (`backend/migrations/20250319000000_create_initial_schema.sql`), duplicated by Rust/GraphQL `TaskProgressType`; it admits only seven values. `tasks.type` and `tasks.category` are nullable free text, but `web/src/types/task.ts`, forms and detail controls hard-code four/five values. Custom per-project selections therefore cannot persist.

Existing catalog-like stores are **not** the requested normal-classification authority:

| Existing store | Actual use | Why not reuse as requested catalog |
|---|---|---|
| `project_phases` + translations; `tasks.phase_id` | WBS scheduling taxonomy; seeded fixed five phase keys; current Rust projection groups this field. | Reusing it changes WBS semantics and would falsely map an old phase to progress. |
| `project_categories` + translations; `tasks.category_id` | Existing scheduling taxonomy only; resolver/UI CRUD is phase-focused. | It is a separate legacy `category_id` domain, not the active `tasks.category` detail field. |
| `tasks.progress_type`, `type`, `category` | Current detail/form compatibility fields. | Enum/free text have no project ID, locale, order, or safe custom-value validation. |

Do **not** infer `phase_id → progress` from names/defaults. Migration maps only non-null legacy `progress_type` values; all other existing tasks are explicitly unclassified. `phase_id` remains WBS-only; `category_id` remains its legacy taxonomy-only field. The new catalog is the single UI/API authority for normal progress/category/task-type classification; Settings does not expose or write the old taxonomy category. This avoids two active authorities while preserving all old columns/FKs/history.

Append only `backend/migrations/20260907000002_project_task_catalogs.sql`; do not alter applied SQL, especially `20260907000001…` / hash `72f892…`.

## Canonical catalog and compatibility

One project-scoped structure, not three systems:

- `project_task_catalog_items(catalog_item_id UUID PK, project_id FK, kind TEXT CHECK ('PROGRESS_TYPE','CATEGORY','TASK_TYPE'), display_order INT NOT NULL, legacy_value TEXT NULL, created_at, updated_at)`; `(project_id,kind,display_order)` is deferrable unique and `(project_id,kind,legacy_value)` is unique where `legacy_value IS NOT NULL`.
- `project_task_catalog_labels(catalog_item_id FK, locale TEXT NOT NULL, name TEXT NOT NULL, PK(catalog_item_id,locale))`; every item requires at least one trimmed non-empty label. Locale is caller-provided text, not an en/vi/ja whitelist.
- Add nullable `tasks.progress_catalog_item_id`, `category_catalog_item_id`, `task_type_catalog_item_id`. Each has a same-project composite FK plus a small kind-validation trigger/check. No task classification/assignment table: one existing `tasks` row remains storage.

Leave `tasks.progress_type`, `type`, `category`, `phase_id`, `category_id`, `project_phases`, `project_categories`, and all existing FKs untouched. Seed only per-project distinct non-null/nonblank legacy scalar values; backfill the three new IDs; leave raw scalar bytes and every `plans.plan_data` byte unchanged. Empty legacy projects retain an empty catalog; null stays unclassified; do not seed seven global progress defaults.

`legacy_value` is explicit compatibility metadata, not a label: seeded values retain it. New UI selection mirrors a seeded legacy value to the old column; a custom item writes catalog ID and **NULL** old scalar. That is legal for all three existing nullable DB/GraphQL fields and avoids lying to old consumers with a localized label. Rename never alters old raw bytes. An old scalar mutation maps to an already-mapped item when possible; otherwise preserves that scalar and clears the new ID—never silently creates master data. Existing GraphQL readers keep their current fields; new readers use IDs.

Freeze additive SDL names:

```graphql
enum ProjectCatalogKind { PROGRESS_TYPE CATEGORY TASK_TYPE }
type ProjectCatalogLabel { locale: String!, name: String! }
type ProjectCatalogItem { catalog_item_id: ID!, project_id: ID!, kind: ProjectCatalogKind!, display_order: Int!, labels: [ProjectCatalogLabel!]! }
project_catalog_items(project_id: ID!, kind: ProjectCatalogKind!): [ProjectCatalogItem!]!
create_project_catalog_items(input: CreateProjectCatalogItemsInput!): [ProjectCatalogItem!]!
update_project_catalog_item(input: UpdateProjectCatalogItemInput!): ProjectCatalogItem!
reorder_project_catalog_items(input: ReorderProjectCatalogItemsInput!): [ProjectCatalogItem!]!
```

`Task`, `CreateTaskInput`, and `UpdateTaskInput` gain `progress_catalog_item_id`, `category_catalog_item_id`, `task_type_catalog_item_id`; update fields are `MaybeUndefined` so omitted preserves and explicit null clears. All catalog reads use `project_authz::require_project_read`; writes use `require_project_write_tx`, derive/lock target project, reject foreign IDs and wrong kinds without leaking data. Add/rename/reorder only; no delete/archive was requested, so stable IDs outlive renames and snapshots.

## Settings/detail contract

Add `?tab=settings` in the project sidebar and `ProjectDetailView`, distinct from Members. One `ProjectCatalogSettingsPanel` renders three kinds. Existing read access may view; existing owner/manager/leader write gate enables add/rename/reorder; server enforces it.

Batch paste has editable locale (defaults UI locale) plus textarea. Split comma/LF/CRLF; NFC-normalize and trim; discard blanks; exact normalized duplicates in that submission collapse in first-seen order. Existing same-label records are never silently merged; stable ID remains option value. Server repeats nonempty/size/list validation and writes the batch atomically at appended order. Label editor accepts arbitrary locale rows; label fallback is exact locale → language prefix → first label → ID.

All three detail/new-task selectors use catalog UUIDs; Not set sends explicit null. Empty Progress shows Not set and a manager settings link, never `study`. Update both full `TaskDetailPage` and mounted Timeline `TaskDetail`; `tabs/DetailsTab.tsx` is currently unmounted and not a writer.

## Master Schedule contract

`backend/src/scheduling/projection.rs` / `project_schedule_projection` is `CURRENT_TASK_FIELDS`, grouping `phase_id`, effort and current dates. Preserve it for WBS compatibility, but Timeline Master must no longer use `useScheduleProjection().masterRows`.

Master consumes Timeline’s selected-plan tasks and its existing `taskAllocations` / `displayedBarsOverride` only:

1. Dedupe selected snapshot `.tasks`; never account `meta.contextTasks`, headings, summary rows, or a parent-derived rollup. LIVE reads current `progress_catalog_item_id`.
2. New v2 snapshot canonical field is camelCase `progressCatalogItemId?: string | null`; missing means historical classification **unknown**, explicit null means known unclassified. Existing parser accepts snake `progress_catalog_item_id` only as legacy alias and rejects conflicting camel/snake values. Old plans get no title/current-value inference.
3. Render configured Progress items ordered `(display_order,catalog_item_id)`, including empty, then a visible Unclassified/Not-recorded row. Unknown, missing or foreign IDs land there with incomplete-history warning.
4. Sum only finite positive `hoursPerDay[date]` per phase/date. Positive cells form bars; gaps blank; first/last positive dates form phase dates. Missing legacy daily vectors show unknown/incomplete, never zero/distributed hours.
5. MASTER_SCHEDULE renders phase rows/bars only: no task rows, task callbacks or DnD. WBS_DETAIL keeps current all-depth hierarchy, priority and collapse. Matrix receives the same selected allocations, preserving resource totals/conservation.

## Exact ownership / paths

| Group | Owned paths | Boundary |
|---|---|---|
| **A Backend** | new migration; `backend/src/migration_runner.rs`; new `backend/src/graphql/resolvers/project_catalogs/mod.rs`; `backend/src/graphql/resolvers/mod.rs`; `backend/src/graphql/schema.rs`; `backend/schema.graphql`; `backend/src/graphql/types/task.rs`; mounted `backend/src/graphql/resolvers/tasks/{query/{task,tasks,task_subtasks}.rs,mutation/{create,update,clone,update_effort,update_status,reorder}.rs}` | Schema, migration/preservation, SDL, auth/kind validation, legacy bridge, all mounted Task serialization. Freeze before B/C. |
| **B Settings/detail UI** | `web/src/components/ui/navigation/sidebar-project-tree-item.tsx`; `web/src/components/projects/ProjectDetailView.tsx`; new `web/src/components/projects/ProjectCatalogSettingsPanel.tsx`; new `web/src/{graphql/queries/catalogs.ts,graphql/mutations/catalogs.ts,hooks/useProjectCatalogs.ts,types/project-catalog.ts}`; `web/src/{types/task.ts,redux/features/tasksSlice.ts,hooks/useTasks.ts,graphql/queries/tasks.ts,graphql/mutations/tasks.ts,components/tasks/{TaskDetail.tsx,TaskDetailPage.tsx,NewTaskForm.tsx}}` | Depends only on A SDL. Own paste/labels/selectors/state. Do not edit Members, `SchedulingConfigPanel`, `PhaseSettingsPanel`, Master, or WBS. |
| **C Master** | `web/src/components/timeline/{Timeline.tsx,PhaseScheduleRow.tsx}`; `web/src/lib/scheduling/build-master-rows.ts`; `web/src/{utils/planLifecycle.ts,hooks/usePlanLifecycle.ts,types/schedule-projection.ts}` | Depends on frozen A IDs and B catalog read types; owns snapshot field/parser alias rule and selected-plan-only phase aggregation. Must not alter catalog mutations, Task detail, WBS adapter, or Rust current-field projection. |

`tasksSlice.ts` and task query shape are shared List/Gantt integration paths: B adds only recursive new-ID normalization; coordinate final import. Do not touch Dashboard `page.tsx` or decide root forest versus `task_tree_rows`; that pending fix is separate.

## Required verification

- Real restored-DB upgrade: scalar/phase/category FKs, IDs, plan JSON/history unchanged; seeded/null/empty cases; rollback and cross-project/kind failures.
- Mounted GraphQL: authorization/no leakage, atomic batch, rename/reorder, custom and legacy bridge/clear/reload.
- UI: Settings navigation; all three catalogs; Unicode comma/newline paste; multilingual fallback; detail/modal/new-task persistence/hard reload.
- Master: live/draft/saved, canonical/alias/missing snapshot cases, parent+child direct hours once, gaps, empty phases, unclassified warning, no task rows, WBS/matrix regressions.
- Re-freeze manifests and rerun release artifact delta. Prepared backend image `1f63e251` is older scope, not final release.

## Unresolved questions

None; user confirmed scope and semantics.
