---
title: "REMOVE-REJECTED-UI-0908"
status: complete
priority: P1
created: 2026-09-08
---

# REMOVE-REJECTED-UI-0908

## Outcome
Remove REJECTED from every task status editor while retaining it in explicit historical filters. Keep explicit, confirmed subtree deletion and Redux removal by returned IDs.

## Constraints
- Preserve backend transactional recursive hard-delete semantics.
- No deployment or database change.
- Reuse existing delete mutation, confirmation helper, and Redux reducer.

## Acceptance
- [x] No editor/create/Excel/Kanban drop target offers REJECTED.
- [x] List/Gantt/Kanban historical status filters still offer REJECTED.
- [x] Explicit delete warns about permanent descendant deletion and cancel does not mutate.
- [x] Confirmed delete calls `delete_task` once; returned IDs remove the subtree.
- [x] Focused tests pass; report written; commit pushed.
