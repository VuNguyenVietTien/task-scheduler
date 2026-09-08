# CLONE-DESTINATIONS-0908

## Early callback contract

Proposed backward-compatible dialog input:

```ts
interface CloneTaskSelectionInput {
  source_task_id: string;
  selected_descendant_ids: string[];
  quantity: number;
  destination_parent_task_id?: string;   // existing single-target input
  destination_parent_task_ids?: string[]; // new ordered multi-target input
  clone_without_parent?: boolean;         // existing root promotion
}
```

- Parent selected: existing payload, no destination fields.
- Parent omitted + checked destinations: `destination_parent_task_ids` in displayed task order. Quantity applies independently to each destination.
- Parent omitted + root option: `clone_without_parent: true`; no destination IDs.
- Exported helper: `expandCloneSelectionInputs(input: CloneTaskSelectionInput): CloneTaskSelectionInput[]`. It expands one dialog input into ordered existing backend inputs, one per destination, stripping `destination_parent_task_ids`. List callback must expand before GraphQL calls.
- Result ownership remains with List: execute inputs sequentially, retain successful destination keys/root IDs, retry only unfinished inputs, then perform its existing authoritative refresh. Dialog keeps current `Promise<void>` callback and existing `serverError`/recovery props; cancellation emits nothing.

## Outcome

- Parent task now has an explicit checkbox; selected descendants remain independently selectable when parent omitted.
- Parent-omitted mode offers multiple same-project destination checkboxes or root promotion.
- Destination IDs submit in displayed task order; quantity is explicitly per destination and preview totals include every destination.
- Existing parent-tree payload and root-promotion payload remain unchanged.
- `expandCloneSelectionInputs` produces one ordered legacy backend payload per destination for List-owned sequential execution/recovery.
- Cancellation still emits no clone input.

## Verification

- PASS: Node 24 type-strip smoke check for ordered two-destination expansion and root promotion.
- PASS: `git diff --check`.
- ADDED, INTEGRATED RUN NEEDED: focused Jest suites `cloneTask.test.ts` and `TaskCloneDialog.test.tsx` cover payload order/count, root promotion with no destinations, selected-descendant omission, multi-target UI, parent preservation, and cancellation.
- BLOCKED: isolated worktree has no dependencies; approved dev `NODE_PATH` dependency location is denied by the session privacy hook. No install attempted.

## Commits

- `5e7f30b` — `feat(tasks): support multiple clone destinations`

## Integration note

List callback must call `expandCloneSelectionInputs` and never send `destination_parent_task_ids` directly to GraphQL. Its sequential partial-failure checkpoint and destination-tail priority normalization remain List-worker-owned.

## Unresolved Questions

- None.

Status: DONE_WITH_CONCERNS
