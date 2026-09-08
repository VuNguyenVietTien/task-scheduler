# CLONE-CALLBACK-0908

## Status

DONE

## Integration

- Dialog/helper source: `58299a7` (cherry-pick of clone worker `5e7f30b`).
- Dialog/helper report: `828e7c4` (cherry-pick of clone worker `e54b92d`).
- List callback: `251883c`.
- Integrated only in isolated `codex/list-append-0908`; no dev merge/cherry-pick performed here.

## Callback behavior

- Expands ordered multi-destination input with `expandCloneSelectionInputs` and sends only backward-compatible single-destination payloads.
- Executes destinations sequentially.
- Checkpoints confirmed clone root IDs and target orders. Partial retry skips completed destinations and resumes unfinished clone/order work without duplicates.
- Refetches canonical task rows, assigns cloned roots consecutive destination-tail priorities through existing task update API, updates Redux/local tree, then refreshes tree + Redux authority.
- Covers destination parents, root promotion, and ordinary same-parent clone.
- Unknown network outcomes retain fail-closed recovery; no blind retry.

## Focused verification

Direct existing dev dependency runner against isolated source/config:

```text
PASS TaskCloneDialog.test.tsx
PASS TaskListView.clone-recovery.test.tsx
PASS cloneTask.test.ts
Test Suites: 3 passed, 3 total
Tests: 30 passed, 30 total
Snapshots: 0 total
```

Combined append + clone run also passed: 6 suites, 77 tests. `git diff --check` passed.

## Unresolved questions

None.
