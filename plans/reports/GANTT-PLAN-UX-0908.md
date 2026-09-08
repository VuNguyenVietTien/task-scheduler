# Gantt Plan UX — Final Report

## Delivery

### Original implementation

Commit: `da69936d5738212ba73cda2690b1e4bc1a1b183c` (`fix(gantt): preserve saved plan scheduling authority`)

- Defaulted once per project to the newest returned saved plan while preserving explicit No plan.
- Added localized No plan, corrupt-newest fallback, and Delete plan UX.
- Accepted legacy snapshots missing `hoursPerDay` as allocation-unknown without inventing hours; malformed supplied vectors remain errors.
- Excluded DONE, CLOSE, REJECTED, and ARCHIVED tasks from scheduling allocations, resource demand, and Master inputs.
- Removed phantom current-day Unclassified rows while preserving legitimate date-only legacy saved spans and unknown phase metadata.
- Simplified daily member cells to Assigned/Working and capacity colors.

Newest-first is guaranteed by `backend/src/graphql/resolvers/plan_lifecycle.rs:347-356`:

```sql
ORDER BY created_at DESC, revision DESC
```

### Follow-up

Commit: `7b33bca57065e6a30f484e446a0c6695dbad2081` (`fix(gantt): render dated zero-effort milestones`)

- Rendered eligible zero-effort tasks as date-only WBS milestones only when they have an explicit valid start date and a direct or linked resolved assignee.
- Preserved zero resource hours and used the actual start date for the Master phase span.
- Left unassigned, undated, invalid-date, and excluded-status zero-effort tasks without bars.
- Preserved date-only behavior through draft/saved snapshot bars.
- Localized Assigned/Working labels in English, Japanese, and Vietnamese.

## Test evidence

### Original implementation

- 39 focused tests passed across plan lifecycle hook/parser, allocation eligibility, and Master-row construction.
- Selected Timeline wiring run: 22 passed, 9 skipped, 1 known baseline failure.
- After PM integrated the original commit into `dev-0908`, `member-daily-effort-matrix.test.tsx`: 1/1 passed using that worktree's installed dependencies.
- `git diff --check` and EN/JA/VI locale JSON parsing passed.

### Follow-up in isolated worktree using `dev-0908/web` dependencies

Six focused assertions passed:

1. Zero-effort allocation gate: direct canonical and linked assignees retained; unassigned, undated, invalid-date, and REJECTED cases omitted.
2. Master builder: explicit date-only span retained with empty `hours_per_day` and no invented `total_hours`.
3. Timeline: zero-effort task rendered on `2026-09-10` in WBS and included `2026-09-10` as the Master span.
4. English member-cell labels.
5. Japanese member-cell labels.
6. Vietnamese member-cell labels.

The follow-up was not claimed as tested in `dev-0908` before PM integration.

## Known baseline failure

`Authority regression wiring R1-R11 › R5 live auto-sort preserves hidden slots and rendered CLOSE-last equals API order`

Exact assertion at `web/src/components/timeline/__tests__/gantt-lifecycle-wiring.test.tsx:192`:

```text
expect(mockReorderMutation).toHaveBeenCalled()
Expected number of calls: >= 1
Received number of calls: 0
```

This pre-existing auto-sort-path failure is outside this worker slice. Per PM direction, it was not rerun during final follow-up verification.

## Integration

- PM integrated/accepted both implementation commits.
- Worker did not merge into `dev`.
- No backend, production data, browser, or server changes performed.

## Unresolved questions

None.
