# DATE-CLEAR-0908

## Status

READY_FOR_INTEGRATION

## Root cause / owner

`UpdateTaskInput` decoded all four dates as `Option<DateTime<Utc>>`, and `COALESCE` then treated GraphQL `null` exactly like omission. The backend therefore restored the old date even though List/Gantt sent a clear.

Source commit: `95012fb` (`fix(tasks): preserve explicit date clears`).

## Fix

- Backend dates use `MaybeUndefined<DateTime<Utc>>`.
- Shared decoder produces `(changed, value)`: omitted = `(false, None)`; explicit null = `(true, None)`; date = `(true, Some(date))`.
- SQL `CASE WHEN changed THEN value ELSE existing END` preserves sparse omission while clearing explicit null.
- Returned `Task` still carries the authoritative nullable database values.
- Existing Redux normalizer/tree merge preserves explicit null and ignores undefined, retaining hierarchy/children.
- Normal List and Excel now pass date clears as `null`, not empty-string placeholders.
- Gantt's shared `TaskDetail` modal shows a visible `Clear` button beside every date editor; Clear stages null, existing Save persists it without opening the picker.
- No migration, API field rename, unrelated priority, or hierarchy change.

## Focused frontend verification

```text
PASS TaskListView.assignment.test.tsx
PASS gantt-assignee-modal.test.tsx
PASS use-tasks-date-clear.test.ts
PASS tasks-realtime.test.ts
Test Suites: 4 passed, 4 total
Tests: 7 passed, 20 skipped, 27 total
```

Coverage: Normal Start/actual date clear, Excel Start clear, Gantt modal Clear + Save, serialized explicit null, omitted field absent, authoritative response null retained in Redux tree.

A prior unfiltered run of those files had 26 passing tests and one unrelated existing multi-draft clone assertion fail; the bounded date selection above is green.

## Backend verification / deploy need

Backend compile and focused unit pending integrated Ubuntu source because local Windows has no Cargo. Run only:

```bash
cargo test --release --locked graphql::resolvers::tasks::mutation::update::tests::date_patch_distinguishes_clear_from_omission --lib
```

Backend deployment is required after PM integrates and authorizes the exact SHA. No migration or production task mutation is required.

## Unresolved questions

- Awaiting PM integrated SHA for focused Ubuntu unit and backend release.
