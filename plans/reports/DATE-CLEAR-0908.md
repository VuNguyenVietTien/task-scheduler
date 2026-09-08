# DATE-CLEAR-0908

## Status

BACKEND_DEPLOYED; FRONTEND_INTEGRATED FOR LOCALHOST

## Root cause / fix

`UpdateTaskInput` decoded dates as `Option<DateTime<Utc>>`; SQL `COALESCE` therefore treated GraphQL `null` like omission and restored the old date.

- Source commit: `95012fb` (`fix(tasks): preserve explicit date clears`).
- Integrated/deployed commit: `c6fd89b78af27b2f707862de53758d388431b337`.
- Four date inputs now use `MaybeUndefined<DateTime<Utc>>` and SQL `CASE WHEN changed THEN value ELSE existing END`.
- Omitted remains untouched; explicit null clears; a supplied date replaces.
- Normal List and Excel send date clears as null.
- Gantt shared task modal exposes visible `Clear` beside each date editor; Clear stages null and existing Save persists it.
- Authoritative response null survives the existing Redux normalizer/tree merge; undefined fields remain omitted and hierarchy remains intact.
- No migration, API field rename, or production task mutation.

## Focused verification

Frontend:

```text
PASS TaskListView.assignment.test.tsx
PASS gantt-assignee-modal.test.tsx
PASS use-tasks-date-clear.test.ts
PASS tasks-realtime.test.ts
Test Suites: 4 passed, 4 total
Tests: 7 passed, 20 skipped, 27 total
```

Ubuntu backend committed archive:

```text
cargo test --release --locked graphql::resolvers::tasks::mutation::update::tests::date_patch_distinguishes_clear_from_omission --lib
1 passed; 0 failed; 72 filtered out
```

## Unrelated assertion isolation

Exact assertion/test: `TaskListView canonical assignment source wiring › creates multiple nested drafts, retains only partial failures, and retries without duplicating successes`; the unfiltered four-file run timed out waiting for `queryByLabelText('Subtask title for parent')` to disappear and reported two matching drafts. Evidence it is not caused by the date diff:

- The pre-date combined run passed 79/79.
- The same exact assertion, isolated on the current date-clear code, passed 1/1 in 2.729s (15 skipped).
- Date diff does not touch draft creation/retry paths.

This supports an order/timing interaction in that unfiltered run; no claim that it is an established baseline failure.

## Release evidence

- Release: `20260908T1328-c6fd89b7`.
- Image: `task-scheduler-backend:20260908T1328-c6fd89b7`.
- Image ID: `sha256:6287387784b87fe35692f5dcf6b16ed1ad06a4ca2dd956849cf701ed2b14b471`.
- Archive: `/home/azuraith/task-scheduler/releases/20260908T1328-c6fd89b7/source.tar.gz`.
- Archive SHA-256: `fbfdd5f79546b4b0d03ea98f9e8f4eeb120571f1fc30c78b385c3fc0adea530a`.
- Backup: `/home/azuraith/task-scheduler/releases/20260908T1328-c6fd89b7/backup/db-before-20260908T1328-c6fd89b7.sql.gz`.
- Backup: 33,046 bytes; mode `0600`; gzip verified; SHA-256 `400cb6d6d9b6e4180ee95dcd4348eb0ee99335173ec80c41f1ea679101f21922`.
- Runtime env/CORS, user, host network, restart/log policy, config, and uploads match retained prior container.
- Rollback: `task-scheduler-backend-prev-20260908T1328-c6fd89b7` (stopped; prior clone-title image).
- Local readiness: `{"status":"ready","database":"up","migrations":"current"}`.
- Public readiness: `{"status":"ready","database":"up","migrations":"current"}`.

Rollback:

```bash
docker stop task-scheduler-backend && docker rm task-scheduler-backend
docker rename task-scheduler-backend-prev-20260908T1328-c6fd89b7 task-scheduler-backend
docker start task-scheduler-backend
curl --fail --silent --show-error http://127.0.0.1:8081/health/ready
curl --fail --silent --show-error https://pm-api.khampha.dpdns.org/health/ready
```

## Unresolved questions

None.
