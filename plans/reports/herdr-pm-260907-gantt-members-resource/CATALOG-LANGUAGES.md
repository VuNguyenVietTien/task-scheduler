# CATALOG-LANGUAGES

**Status: DONE — 2026-09-07 Asia/Bangkok.** Language-only implementation complete in `C:/Users/TienVNV/Documents/prjmngr/worktrees/lang-0907` from base `f921253538180e7e968b3491f75b830cfd28b6b9`. No commit, push, deployment, backend/schema/GraphQL/dependency/config, List, Excel, browser, or database change.

## Delivered

- Replaced arbitrary locale/Add language editing with three always-visible fields: **English (en), Japanese (ja), Vietnamese (vi)**.
- Existing extra-locale labels remain in complete replacement payloads unchanged, preventing data loss. Catalog item UUID remains the update key; rename/order/language changes never alter task selection identity.
- New items use three per-language paste columns and an aligned three-field preview. Comma, tab, LF, and CRLF input is NFC-normalized and trimmed. Empty whole language columns and per-row missing translations are supported when each item retains at least one nonblank label.
- Mismatched non-empty column counts, all-blank preview rows, and duplicate same-language values are rejected before mutation; text stays editable in preview.
- Kept mutation success/refetch-failure truth and failed-save edit retention.
- Kept the existing `i18n-config.ts` / profile Settings picker as sole language authority. No picker/provider/context added. Shared `ProjectCatalogSelect` already used by modal `TaskDetail`, full `TaskDetailPage`, and `NewTaskForm`; no form rewrite needed.
- Deterministic display fallback remains exact locale → language prefix → locale/name-sorted first label → stable item ID, now documented in Project settings.

## Frozen files

Manifest: `CATALOG-LANGUAGES.source-manifest.json`, SHA-256 `9ad2b0cea8c287b956675d3b7d13f1ac930dc061d22bf1ac53165d198d8e9d3e`.

| Path | SHA-256 |
|---|---|
| `web/src/components/projects/ProjectCatalogSettingsPanel.tsx` | `90bd105c8b795f806bfaa7937e38ef23859391ac9991b70c6b61c348683865cb` |
| `web/src/types/project-catalog.ts` | `73b56c697062a0260710d25a654f201ad81ec22bb2ab788d4935a72d1d80cee5` |
| `web/src/utils/project-catalog.ts` | `5b635224a0f458097a49f5a1bec1062263c1c919991d18b42ec98b90574b6109` |
| `web/src/components/projects/__tests__/project-catalog-settings.test.tsx` | `3855934a4710858b34c14e42f9299004b3974b885934588fe2cdac7a0536a0e8` |
| `web/src/components/projects/__tests__/project-catalog-language.test.tsx` | `b9f3bcf7d20a14b9d9d362496efb95bb83184cc193ccbcc228a31a107e305087` |
| `web/src/utils/__tests__/project-catalog.test.ts` | `832adafc4089ee901f7de4bd06a2b85cf82c994f863607895b3300a22afdcb30` |

## Validation

Hash-matched dependencies reused from `gm-20260907`; no install.

```text
jest --config jest.config.js --reporters=default --runInBand \
  src/utils/__tests__/project-catalog.test.ts \
  src/components/projects/__tests__/project-catalog-settings.test.tsx \
  src/components/projects/__tests__/project-catalog-language.test.tsx \
  src/components/tasks/__tests__/project-catalog-task-fields.test.ts

4 suites PASS; 19/19 tests PASS; 0 snapshots; 7.368s.
```

Coverage includes fixed three fields; create/update complete labels with extra-locale preservation; stable update ID; aligned comma/tab/LF/CRLF paste; NFC and blank handling; mismatch/duplicate/all-empty rejection; missing translations; failed save retention; mutation-success/refetch-failure truth; set/null task input mapping; recursive task ID normalization; and real `i18n-config.ts` `changeLanguage` en→ja→vi rerender with unchanged selected UUID. Omitted-field preservation code was unchanged.

`git diff --check`: PASS. Focused suite intentionally run once after final implementation per fast-release instruction. Broad Jest, full TSC, and build not rerun; integration owner owns the single combined build/release gate.

## Remaining limits

- No live browser or persisted backend mutation performed here; release/integration owner verifies deployed hard reload and production UI.
- List/Excel catalog labels remain separate `gm-excel-editing` ownership and were not edited.
- Repository TypeScript baseline is known non-clean from assembled evidence; this focused run does not reclassify it.

## Unresolved questions

None.
