# LIST-APPEND-0908 checkpoint

## Status

DONE

## Read-only production diagnosis

Project `b24aac96-4f0e-4689-8469-7222945b5df8`, parent `c3058120-7afa-4b43-94c1-085db3dd3ad3` (`MST-02-04　材料単価経歴情報`). Query used the container's existing `POSTGRES_USER`/`POSTGRES_DB` internally; no credentials printed.

Confirmed newest three active direct children under that parent, all KhoiPG, 8h, TODO, progress type `基本設計変更対応`:

| Created (Asia/Bangkok) | Task ID | Title | Current priority_order | Proposed |
|---|---|---|---:|---:|
| 2026-09-08 19:07:13.325739 | `297720c5-1064-49cd-8e57-3dd276ff3997` | クラス図・基本設計変更対応 | 0 | 38 |
| 2026-09-08 19:07:13.545723 | `eb6871ec-efdf-4f9d-89dd-f6bc3e91b48e` | シーケンス図・基本設計変更対応 | 0 | 39 |
| 2026-09-08 19:07:13.837237 | `4b6c94f8-b5a2-4225-ac5a-02b392595889` | クラス仕様・基本設計変更対応 | 0 | 40 |

Timestamp rank confirms these are newest #3, #2, #1 direct children respectively; no later active child exists under this parent. Existing direct-child priority range ends at 37. Proposed 38–40 preserves every existing sibling value/order.

PM approved the exact repair. Preflight returned `target rows=3 | sibling max=37 | collisions at 38–40=0`. Scoped full-row JSONL backup: `/home/azuraith/task-scheduler/backup/list-append-0908-three-tasks-20260908T1932.jsonl`, mode `0600`, 3 rows, 3,190 bytes, SHA-256 `92a4477c5fc03b8ce0200ff7118708e9c513bc80e2e6522e7e9a08d23870a8e2`.

A guarded transaction updated only `priority_order` for the three approved project+parent+task IDs, required all old values to remain 0, sibling max to remain 37, no 38–40 collision, and exactly 3 affected rows. Post-commit verification returned 38/39/40 for the three IDs.

## Root cause

1. Inline create reuses `buildCreateTaskInput`, whose default `priority_order` is `0`; backend persists that explicit value. `task_tree_rows` orders siblings by `priority_order`, then creation time, so new children sort above existing priorities 32–37.
2. Successful creates update Redux and the component's nested tree, but Excel renders the already-populated flat `TASK_TREE_ROWS` Apollo result instead. The canonical created task is therefore invisible in Excel until reload/refetch.
3. Draft rows currently render directly after the selected row, before that row's existing descendant block.

## Implemented append contract

- `nextSiblingPriorityOrder(rows, parentId)` returns `max(active loaded direct-sibling priority_order) + 1`, or 0 when no sibling exists. Batch callers reserve consecutive values in input order.
- `upsertTaskTreeRow(rows, canonicalTask)` merges duplicate IDs or inserts a new canonical task immediately after its parent's complete descendant block. This preserves all unrelated row values/order and is reusable by clone callback integration.
- Successful inline creates apply the canonical response to Redux, local nested state, and Apollo `TASK_TREE_ROWS` immediately.
- Normal and Excel drafts render after the selected parent's existing descendant block.

Focused result: 3 suites, 47 tests passed; `git diff --check` passed.

## Unresolved questions

None.
