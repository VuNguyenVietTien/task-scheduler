# LIST-APPEND-0908

## Status

DONE

## Root cause

- Inline subtask creation inherited `buildCreateTaskInput`'s `priority_order: 0`; backend persisted it unchanged. `task_tree_rows` orders siblings by priority then creation timestamp, placing new children above priorities 32–37.
- Redux and local nested state received successful canonical create results, but Excel preferred the populated flat Apollo `TASK_TREE_ROWS` snapshot. New tasks therefore appeared only after reload.
- Draft rows rendered immediately after the selected parent row, before its descendant block.

## Exact production repair

Project `b24aac96-4f0e-4689-8469-7222945b5df8`; parent `c3058120-7afa-4b43-94c1-085db3dd3ad3` (`MST-02-04　材料単価経歴情報`). Read-only timestamp ranking confirmed these remain the newest three active direct children, all KhoiPG, 8h, TODO, progress type `基本設計変更対応`:

| Task ID | Created (Asia/Bangkok) | Title | Old → new priority_order |
|---|---|---|---:|
| `297720c5-1064-49cd-8e57-3dd276ff3997` | 2026-09-08 19:07:13.325739 | クラス図・基本設計変更対応 | 0 → 38 |
| `eb6871ec-efdf-4f9d-89dd-f6bc3e91b48e` | 2026-09-08 19:07:13.545723 | シーケンス図・基本設計変更対応 | 0 → 39 |
| `4b6c94f8-b5a2-4225-ac5a-02b392595889` | 2026-09-08 19:07:13.837237 | クラス仕様・基本設計変更対応 | 0 → 40 |

Before mutation: exact targets at 0 = 3; unaffected sibling max = 37; unaffected sibling collisions at 38–40 = 0.

Scoped full-row backup outside git:

- Path: `/home/azuraith/task-scheduler/backup/list-append-0908-three-tasks-20260908T1932.jsonl`
- Mode: `0600`
- Rows/bytes: 3 / 3,190
- SHA-256: `92a4477c5fc03b8ce0200ff7118708e9c513bc80e2e6522e7e9a08d23870a8e2`

Guarded transaction constrained project + parent + three IDs + old value 0; rechecked sibling max/collision; asserted exactly 3 affected; changed only `priority_order`. Post-commit verification returned exact 38/39/40. No unrelated row renumbered.

## Code

Commit `def1bde` (`fix(tasks): append inline subtasks in realtime`):

- Batch inputs reserve consecutive `max(direct sibling priority_order) + 1` values per parent.
- Each successful canonical response upserts Redux, local nested state, and Apollo flat tree immediately.
- Flat insertion occurs after the parent's complete descendant block; duplicate IDs merge in place.
- Normal and Excel drafts render below existing descendants.
- Partial failure retention/retry, dirty guards, selection/editing/clipboard, and effort rollups retained.
- No backend, schema, Gantt, locale, clone dialog, or clone utility changes.

Reusable clone integration contract: import `nextSiblingPriorityOrder` and `upsertTaskTreeRow` from `web/src/components/tasks/inline-subtask.ts`; allocate destination-local consecutive tail priorities and merge each canonical response after that destination's complete descendant block. Existing rows remain untouched.

## Verification

Direct existing dev dependency runner, isolated source/config:

```text
PASS TaskExcelGrid.test.tsx
PASS TaskListView.assignment.test.tsx
PASS inline-subtask.test.ts
Test Suites: 3 passed, 3 total
Tests: 47 passed, 47 total
```

`git diff --check`: passed. Initial isolated `npm test` could not find Jest; no install performed. Direct approved dev runner then passed.

## Unresolved questions

None.
