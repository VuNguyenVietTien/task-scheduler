# CATALOG-UI

**Status: DONE_WITH_CONCERNS — 2026-09-07 18:47 Asia/Bangkok.** Frontend implementation complete; independent Astra/backend/Master/release/Chrome gates remain.

## Contracts and frozen prerequisites

Implemented against primary `CATALOG-API-CONTRACT.md` SHA-256 `52b5ba307ca9994b6c24e631600e6ada1fb3ebf1096e7f94a22e6c245fe7e00f`. No wire format invented. Exact create/update/reorder inputs and public read-hook/type/label contract are in `CATALOG-UI-CONTRACT.md` and `CATALOG-UI.prerequisite-manifest.json` (SHA-256 `dcb3fb582b0a8f715fa227853a0c1edcea8ca555128c803fdd466bf1929aaad5`).

Master prerequisites frozen:

| Path | SHA-256 |
|---|---|
| `web/src/types/project-catalog.ts` | `4216d4232254359f5a46202840df5d66acb1a854a2ab08cf9a6792863b85c512` |
| `web/src/graphql/queries/catalogs.ts` | `8928c2c4fc119d3a47738ca522d8fa0adc1f50c4896beea1741beb7279e81614` |
| `web/src/hooks/useProjectCatalogs.ts` | `8d09a843d1c96ae4e69890521e63ed88e8f123c7b491c7b39a5aa97ab2a55cac` |
| `web/src/utils/project-catalog.ts` | `f06e2f2d384da31e42485d76abe19946cadf90f34d8ad9dc4b9be1889bac06d7` |
| `web/src/types/task.ts` | `5de4afd785dac13727434e4a6305fe010d127ee6b8fdfbad331fd251bf2d8522` |

Task camel fields are optional `string | null`: `progressCatalogItemId`, `categoryCatalogItemId`, `taskTypeCatalogItemId`.

## Delivered

- Added distinct project `?tab=settings` navigation and view; Members untouched. Settings remains usable when unrelated task fetch fails.
- Added one reusable project catalog UI rendering Progress type, Category and Task type. Existing readers see read-only values; existing manager/leader/admin write gate enables changes; backend remains authorization authority.
- Paste parser supports comma/LF/CRLF, NFC normalization, trim, blank removal and exact first-seen dedup. Preview entries are editable/removable; one mutation submits the complete batch atomically.
- Added arbitrary locale rows and complete-label rename; no language whitelist. Stable item IDs remain mutation keys. Existing duplicate-label items are not merged. No existing-item delete.
- Added accessible up/down controls; reorder sends complete ordered and expected ID vectors. Mutation success followed by authoritative refetch; refresh failure says “saved, refresh failed” rather than “save failed.”
- `useProjectCatalogs(undefined, kind)` skips. Returned items are filtered to requested project, preventing stale prior-project display. Loading/error/retry/empty/Not set are distinct. Label fallback: exact locale → language prefix → locale/name-sorted first → ID.
- Added catalog UUID fields to all relevant task read/update/create result documents. Existing all-depth `TASK_TREE_ROWS` transport and guards preserved.
- Redux normalizer maps backend snake fields recursively through all child depths while preserving explicit null versus undefined.
- Timeline modal `TaskDetail`, full `TaskDetailPage`, and `NewTaskForm` use project catalog selectors. UUID values are written only as `*_catalog_item_id`; Not set sends null. Legacy label can display as fallback but is never submitted as catalog identity. Removed hardcoded Study default/fixed classification options from NewTask/full detail.
- Task update now rejects partial GraphQL errors or missing results; removed false local-fallback success. Full-page failed save remains open and visible.
- `useTaskFieldMutations.ts` unchanged: actual catalog callers route through `useUpdateTask`, so no duplicate writer added.

Source manifest: `CATALOG-UI.source-manifest.json`, 19 files, SHA-256 `afff253fdda374f49197bf498f0cc9fdb274d08377d2878b5b78e56e6d7f018a`.

## Validation

- Package and lock hashes matched primary. No install/dependency change.
- Focused Jest: **3 suites, 12/12 PASS**, including real rendered settings paste/preview/atomic request, multilingual rename, full reorder vectors, read error/retry, read-only UI, project switch cleanup, reusable selector UUID set/null clear/legacy fallback, create/update wire mapping, partial-error rejection, parser/fallback and depth-three null/undefined normalization. Raw: `CATALOG-UI-focused-tests.log`.
- First Jest invocation failed before load due dual configs; second failed before load due unavailable configured `jest-junit`. Final command explicitly selected `jest.config.js` and default reporter; no config/dependency edit.
- Full unfiltered `tsc --noEmit --pretty false --incremental false`: exit 2, inherited non-clean baseline. Four diagnostics matching owned filenames are exact pre-existing signatures (two unexported `User`; two comment input field mismatches, line-shifted only). No diagnostic in new catalog files, NewTask, useTasks, tasksSlice, GraphQL documents, ProjectDetail or sidebar. Raw: `CATALOG-UI-tsc.log`. This is not a typecheck PASS.
- `git diff --check`: PASS.
- Prior assembled **197 + 2** passing scope evidence remains recorded in `INTEGRATE-FINAL.md`; not falsely reclassified as a rerun after this delta. Existing nine fixture failures remain separate owner scope and file untouched.
- Owned `node_modules` junction removed with target preserved. No owned process remains. No commit/push/install/server/browser/DB/deploy.

Evidence manifest: `CATALOG-UI.evidence-manifest.json`, SHA-256 `ec9f476b9afa8889ff0f7724edba65aa11fb9c28c1a3de005a28fdd86296c508`.

## Concerns / remaining gates

- Focused tests validate actual rendered catalog controls and transport/state behavior, not live backend persistence or full mounted detail pages. Backend worker/Astra/Chrome must verify authorization, hard reload persistence, cross-project/kind rejection and all three mounted task surfaces.
- Full repository TypeScript baseline remains non-clean; independent review must compare normalized signatures after integration.
- Any source delta after this report requires new hashes/manifests and focused rerun.

## Unresolved questions

None.
