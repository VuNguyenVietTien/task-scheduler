# GANTT-INVALID-PLAN-0908

Status: DONE

## Production evidence

Read-only query through documented SSH alias `u-cf` found exactly two matching rows in project `b24aac96-4f0e-4689-8469-7222945b5df8`:

| Plan ID | Name | Revision | Active | Snapshot task rows |
|---|---|---:|---|---:|
| `b858a758-2a9b-485c-9d93-1b392c00e44a` | Chrome E2E Plan 2026-09-06 | 2 | true | 1 |
| `d9190582-a9ea-4fef-bdfd-40b877805f3a` | Chrome E2E Plan 2026-09-06 | 1 | false | 1 |

This distinguishes two saved-plan header rows with payloads from a zero-row list. It does not establish that no plans exist until post-delete evidence does.

Scoped backup: `/home/azuraith/backups/gantt-invalid-plan-b24aac96-20260908T122536Z.jsonl.gz`

- Mode: `0600`; size: 571 bytes
- Rows: 2
- SHA-256: `1b4f9e3898294e82cb433b8d0d07c00891d4e368f6d7743662d58b7582de6108`
- `gzip -t`: passed
- Outside git; no credential values printed or stored in this report.

Backend GraphQL query without user authentication returned `UNAUTHENTICATED`. Browser/profile token access was explicitly stopped. PM approved the direct transaction after reviewing the exact scope and secured backup.

Inbound-FK inspection found only `plans.parent_plan_id ON DELETE SET NULL` and non-cascading `reports.plan_id`. Target references: zero reports; one child plan, which was the other target row; zero child plans outside the exact target set. No task/project cascade existed.

The first transaction attempt failed on an invalid aggregate `FOR UPDATE`; PostgreSQL rolled it back when the session exited. The corrected transaction locked the exact rows and enforced both matched-count and `ROW_COUNT = 2` assertions before commit:

```sql
BEGIN;

SELECT plan_id, project_id, name, revision
FROM plans
WHERE project_id = 'b24aac96-4f0e-4689-8469-7222945b5df8'::uuid
  AND name = 'Chrome E2E Plan 2026-09-06'
  AND (plan_id, revision) IN (
    ('b858a758-2a9b-485c-9d93-1b392c00e44a'::uuid, 2),
    ('d9190582-a9ea-4fef-bdfd-40b877805f3a'::uuid, 1)
  )
FOR UPDATE;

DELETE FROM plans
WHERE project_id = 'b24aac96-4f0e-4689-8469-7222945b5df8'::uuid
  AND name = 'Chrome E2E Plan 2026-09-06'
  AND (plan_id, revision) IN (
    ('b858a758-2a9b-485c-9d93-1b392c00e44a'::uuid, 2),
    ('d9190582-a9ea-4fef-bdfd-40b877805f3a'::uuid, 1)
  );

-- Executed transaction used a PL/pgSQL assertion and raised unless
-- both the locked match count and DELETE ROW_COUNT were exactly 2.
COMMIT;
```

Result at `2026-09-08T12:30Z`: `deleted_exact_rows=2`; remaining plan count for the project = `0`; both target IDs remaining = `0`. Project row count stayed `1`; project task row count stayed `183`. No other plans/tasks/projects were deleted.

Safe read pattern for another scoped worker: `ssh u-cf` then `docker exec task_scheduler_postgres sh -lc 'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" ...'`; keep environment expansion inside the container and never print env values.

## Code repair

Root cause:

- `parsePlanSnapshot` correctly rejects supplied invalid daily-hour vectors, but `installPlan` threw before `loadedPlan` was set. Initial failure discarded the corrupt plan identity; manual failure could leave the prior selection installed. The toolbar therefore had no safe identity to delete.
- One-time default initialization ignored later `saved_plans` refreshes. Empty/network-refreshed lists could leave failed metadata and errors cached.
- Delete intent clears transient fallback state. A failed delete needed to restore the failed-plan state so retry remains available.

Repair in `e05ed82`:

- Keep only the invalid plan's safe header metadata while mode remains `live`; clear snapshot/bars so current scheduling renders.
- Show a localized EN/JA/VI recovery notice, select the failed plan by ID, and expose the existing confirmation/delete action. Raw parser details are not rendered.
- Allow delete only for a valid saved selection or the retained failed selection. Successful delete refetches and installs the newest remaining valid/failing header without reparsing the removed snapshot; failed delete preserves retry access.
- Reconcile selection against refreshed `saved_plans`; empty lists or externally removed selections clear identity, fallback, bars, and stale errors. Explicit No plan still clears state.
- Snapshot validation, scheduling, zero-effort milestones, authorization, backend, and APIs unchanged.

Focused unit evidence using dependencies from `dev-0908/web`:

- `plan-lifecycle-authority.test.ts`: **17/17 passed**. Covers corrupt initial/manual selection, delete failure retry, successful fallback, No plan clear, and external removal/empty refresh.
- `gantt-lifecycle-wiring.test.tsx --testNamePattern="invalid-plan fallback"`: **1/1 passed**; 32 intentionally skipped by filter. Covers retained selector identity, localized notice, hidden parser error, and existing delete confirmation.
- Red run proved the new assertions failed before repair. Its only unrelated failure was the already documented R5 auto-sort baseline; no broad rerun requested.
- `git diff --check`: passed. EN/JA/VI JSON parse: 3/3 passed.

## Commits

- `e05ed82` — `fix(gantt): allow recovery from invalid saved plans`
- Report committed separately after recording implementation evidence.

## Unresolved questions

None.
