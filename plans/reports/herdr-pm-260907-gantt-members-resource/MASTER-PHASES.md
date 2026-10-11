# MASTER-PHASES

**Status: DONE_WITH_CONCERNS** — owned Master phase implementation/test scope complete. No commit/push/deploy/browser/DB/server mutation.

Worktree `C:/Users/TienVNV/Documents/prjmngr/worktrees/master-phases-20260907`; base `049a6c5ddf31de2c373ae69c384bb2e0a14089d7`.

## Implemented

- `MASTER_SCHEDULE` now renders **only phase rows**, built from selected-plan direct daily allocations. It no longer consumes `useScheduleProjection().masterRows`, task labels/bars, DnD, or task callbacks. `WBS_DETAIL` still uses its existing all-depth source headings, hierarchy, collapse, and priority behavior.
- Pure `buildMasterPhaseRows` orders `PROGRESS_TYPE` catalog entries by `(display_order, catalog_item_id)`, retains configured empty rows, dedupes task IDs, and sums only finite positive direct hours by phase/date. Phase segments show hours only; gaps stay blank; bounds derive only from first/last positive day. Parent and child direct allocations each contribute once; a phase may exceed 8h/day.
- Explicit null stays known Unclassified. Missing/foreign catalog IDs and legacy missing daily vectors produce `Unclassified / not recorded` and/or a visible history-incomplete marker; no title/phase/current-value inference or zero-hour distribution. A valid empty catalog creates no fake defaults and exposes a settings link. Catalog loading/error deliberately withholds Master aggregation, preventing stale/cross-project classification.
- Snapshot `progressCatalogItemId?: string | null` added. New/recalculated drafts capture live canonical ID. Parser accepts canonical or snake alias, validates UUID/null, rejects conflicts including string/null, and preserves missing versus explicit null. Saved Master reads stored snapshot ID only.

## Tests/evidence

- Focused: **4 suites / 71 tests PASS**.
- All affected Timeline suites: **6 / 49 PASS**.
- Lifecycle/resource affected suites: **4 / 40 PASS**.
- Actual phase-mode coverage now switches to Master with the catalog query, asserts ordered catalog phase rows, no task bars, phase-hour segments, then WBS task-tree restoration. Pure coverage includes 8+2/multi-task/dedupe/gap, empty catalog row, unclassified/foreign/missing/legacy, rename/order stability, parser aliases, and draft→parse persistence.
- Earlier affected run exposed two **superseded Master task-tree assertions** (`section-boundary`, `independent-wiring`). Root cause: phase-only Master correctly has no task rows while their unmocked catalog reads remain loading. Only those Master assertions changed; WBS counterparts retained. Rerun passes; no skip/flaky waiver.
- `npm run build`: **PASS**, exit 0 (`MASTER-PHASES-build.log`).
- Full unfiltered `tsc --noEmit --incremental false`: exit 2, existing repo baseline remains non-clean (`MASTER-PHASES-tsc.log`). No diagnostic names an owned product source path; one pre-existing narrow TaskBar test-mock type expression remains in modified `increment1-modes`.
- `git diff --check`: exit 0. Test commands/results: `MASTER-PHASES-test.log`.

## Boundaries and manifests

Owned paths/hashes: `MASTER-PHASES.owned-manifest.txt`.

Read-only UI dependencies hash-verified both before copy and at finish: `MASTER-PHASES.dependency-manifest.txt`. They are excluded from owned patch and UI final wins:
`useProjectCatalogs`, `project-catalog` type/util/query, and `types/task`.

`mempalace wake-up` was unavailable (`command not found`); no remediation. Temporary `node_modules` junction (verified identical package/lock) and generated `.next` were removed; no owned processes remain.

## Remaining gates

1. PM/integrator import and immutable freeze; catalog UI final/normalizer must remain hash-matched.
2. Independent Astra review/new artifact, combined frontend test/build/type baseline, then backend/release/browser gates remain outside this ownership.
3. Existing global TypeScript diagnostics need baseline-owner disposition; this report does not claim clean TSC.

## Unresolved questions

None.
