# GROUP-PROGRESS-ORDER-0908

## Status

DONE

## Authority

Project Settings progress order is persisted as `project_task_catalog_items.display_order`. `GET_PROJECT_CATALOG_ITEMS` returns `catalog_item_id` + `display_order`; List consumes that canonical ID/order directly. Labels/locales are display-only and never used as identity or sort authority.

## Implementation

Source commit `06706b2` (`feat(tasks): group children by progress order`).

- Root/global task order remains unchanged.
- Every parent's direct children group by configured Progress type `display_order`.
- Within one Progress group, stored `priority_order` remains stable; equal values retain source order.
- Null, missing, or unknown catalog IDs render last.
- Rule recurses at every hierarchy depth.
- Normal nested List and Excel flat rows use the same helper contract.
- New inline and cloned roots already receive destination/sibling tail priorities, so they render at the end of their own Progress group.
- Catalog reorder updates presentation through existing catalog query state.
- No task priority renumber, production data mutation, backend, schema, Gantt, or locale change.

## Focused verification

```text
PASS TaskListView.assignment.test.tsx
PASS task-progress-order.test.ts
Test Suites: 2 passed, 2 total
Tests: 18 passed, 18 total
Snapshots: 0 total
```

Coverage includes changed catalog order, unset progress last, nested child grouping, stable root order, higher-priority-order new child at its own group tail, and identical Normal/Excel order.

Combined append + clone + grouping run:

```text
Test Suites: 7 passed, 7 total
Tests: 79 passed, 79 total
```

`git diff --check` passed.

## Unresolved questions

None.
