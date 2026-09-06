# Report — pm-gantt-pure-impl-1 (Increment 1 Task 1.4, pure frontend portion)

**Worker:** Scheduling WBS pure-implementation worker
**Scope:** Pure, dependency-free frontend portion of Task 1.4 (docs/superpowers/specs/2026-09-01-project-scheduling-wbs-design.md §5.1–5.3; plans/2026-09-01-project-scheduling-wbs.md Task 1.4)
**Mode:** EDIT, strict ownership. No commit/push/deploy. No production integration.

## Changed files (all new, all owned; verified via `git status --porcelain`)

| File | Purpose |
|---|---|
| `web/src/types/taxonomy.ts` | `ScheduleDisplayMode` (`WBS_DETAIL \| MASTER_SCHEDULE`), `PhaseDescriptor`, `WbsSourceHeading` |
| `web/src/types/schedule-projection.ts` | Spec-aligned `ProjectScheduleProjection`, `TaskScheduleItem`, `WbsRow` (discriminated `TASK \| SOURCE_HEADING`), `PhaseRollupSummary`, `ProjectionSource` |
| `web/src/lib/scheduling/build-wbs-rows.ts` | Pure WBS row builder: arbitrary-depth hierarchy, non-task source headings, orphan/cycle-safe, zero mutation |
| `web/src/lib/scheduling/build-master-rows.ts` | Pure master row builder: exactly-once grouping by own `phase_id`, configured order + explicit Unphased, rollups |
| `web/src/components/timeline/ScheduleModeControl.tsx` | Presentation-only mode toggle, `aria-pressed`, grouped, disabled support |
| `web/src/components/timeline/PhaseScheduleRow.tsx` | Presentation-only phase summary row; `data-nondraggable`, no bar/drag/dependency callbacks |
| `web/src/components/timeline/WbsSourceHeadingRow.tsx` | Display-only source heading row; depth indent, `role="heading"`, no task semantics |
| `web/src/lib/scheduling/__tests__/build-wbs-rows.test.ts` | 5 tests |
| `web/src/lib/scheduling/__tests__/build-master-rows.test.ts` | 9 tests |
| `web/src/components/timeline/__tests__/schedule-mode-control.test.tsx` | 4 tests |

Untouched as required: Timeline.tsx, TaskBar.tsx, TaskListView.tsx, GraphQL, hooks, locales, backend, package/lockfiles, existing tests.

## TDD evidence

**RED** (before implementation existed):
```
npx jest --config jest.config.js --reporters default -- <3 owned test files> --runInBand
Test Suites: 3 failed, 3 total   Tests: 0 total
→ all "Cannot find module '../build-wbs-rows'" / "'../build-master-rows'" / "'../ScheduleModeControl'"
```
Note: repo `jest.config.js` registers a `jest-junit` reporter not installed in this env, and two jest configs exist (`.js` + `.mjs`). Ran with explicit `--config jest.config.js --reporters default` to bypass without editing any config file (outside ownership).

**GREEN** (after minimal implementation):
```
Test Suites: 3 passed, 3 total
Tests:       19 passed, 19 total
Time:        ~1.4s
```

**Static check:**
```
npx tsc --noEmit
→ 0 errors in owned files (grep over output for owned paths: no matches)
→ ~305 pre-existing errors elsewhere in repo (baseline, outside ownership; not introduced by this diff)
```
Fixed during verification: one `TS2802` (Set iteration) in `build-wbs-rows.ts` via `forEach`.

## Behavior implemented (per spec §5.2/§5.3/§5.4)

- **WBS builder** — arbitrary-depth parent/subtask hierarchy preserved in stable input order; missing-parent tasks surface as roots (never dropped); cyclic parent chains safe (no infinite loop); source headings included as `SOURCE_HEADING` rows carrying zero task semantics (no task_id, effort, progress, assignee, bar callback, dependency fields — asserted in tests).
- **Master builder** — each real task exactly once by its own `phase_id`; groups ordered by `display_order` with configured empty phases included, plus always-present explicit Unphased (`phase_id: null`, `is_unphased: true`); effort = direct sum once per task regardless of nesting; start/end = min/max across scheduled tasks only; unscheduled-only groups yield **no fabricated dates**; progress = effort-weighted mean over positive-effort tasks (undefined when none); `allocated_hours`/`remaining_hours` summed only when supplied; `deleted` tasks excluded everywhere.
- **Purity** — builders take `readonly` inputs, mutate nothing (snapshot-asserted), no I/O, no framework imports; swap-in ready for GraphQL producers (Increment 2/3).
- **Components** — mode switch is presentation-only (callback receives `'MASTER_SCHEDULE' | 'WBS_DETAIL'`; component performs no writes and mutates nothing); phase/heading rows are non-draggable (`data-nondraggable`, no pointer handlers, never passed to task callbacks); accessibility: `role="group"` + label, `aria-pressed`, `role="row"` + `aria-label`, `role="heading"` + `aria-level`, focus-visible rings; Tailwind conventions match existing timeline components.

## API assumptions (replaceable by later GraphQL data)

1. Input tasks conform to `TaskScheduleItem` (spec §5.1 `TaskScheduleItem` shape) — **not** the existing app `Task` type, so no coupling to `web/src/types/task.ts` (which currently has no `phase_id`).
2. Dates are ISO strings (`start`/`end` compared lexicographically — valid for ISO-8601).
3. Unphased = tasks with missing/empty `phase_id`; Unphased group named literal `'Unphased'` until i18n integration lands (locale keys are out of my ownership).
4. Configured phases with zero tasks still appear (spec: "configured display order plus explicit Unphased"); empty-phase rendering is trivially skippable by consumers.
5. `WbsRow.row_id` is namespaced (`task:`/`heading:`/`phase:`) as a stable React key contract.

## Limitations

- No Timeline/TaskListView integration, no drag/drop (out of this slice), no locales keys, no GraphQL producers (`taxonomies.ts`, `scheduleProjection.ts`), no hooks — all belong to the integration worker.
- Source headings are emitted before task rows in given order; interleaving by WBS position would need an ordering field on `WbsSourceHeading` (spec does not pin one; easy additive change).
- Date comparison assumes ISO-8601 strings; timezone normalization deferred to integration.
- `jest-junit` missing in env forced CLI reporter override for evidence runs; CI may differ.

## Corrective pass (manager review fixes)

Manager found two acceptance failures; both fixed under same ownership with RED→GREEN evidence.

**Failure 1 — tasks with unknown/unconfigured `phase_id` were silently dropped.** Live tasks whose `phase_id` was absent from the configured phases (archived/invalid) were bucketed but never emitted. Regression test added: unknown phase → explicit Unphased, and union of all `task_ids` across `phase_groups` + `unphased_group` equals all live task IDs exactly once. Fix: bucket only phase_ids present in the configured set; all others fall back to Unphased.

**Failure 2 — progress formula excluded missing-progress effort from the denominator.** Now `sum(effort × progress) / sum(effort)` over every positive-effort task; missing progress contributes 0 to the numerator while its effort stays in the denominator. Regression test: 8h@50% + 2h@100% + 4h missing → 600/14 ≈ 42.857 (was wrongly 60). `progress_percent` stays undefined only when total positive effort is zero.

**Also applied:** negative/invalid `effort_hours` clamped to 0 in all rollups (total, numerator, denominator); dead `resolveDepth`/`depthCache` block removed from `build-wbs-rows.ts` (behavior unchanged — hierarchy via `wouldCycle` + `childrenOf` + DFS).

**Corrective RED** (new tests only, before fixes):
```
npx jest --config jest.config.js --reporters default -- src/lib/scheduling/__tests__/build-master-rows.test.ts --runInBand
Tests: 4 failed, 9 passed (unknown-phase, 600/14 ×2, negative-effort −3 ≠ 2)
```

**Corrective GREEN** (after minimal fixes):
```
npx jest --config jest.config.js --reporters default -- src/lib/scheduling/__tests__ src/components/timeline/__tests__/schedule-mode-control.test.tsx --runInBand
Test Suites: 3 passed, 3 total
Tests:       22 passed, 22 total
npx tsc --noEmit → 0 errors in owned files
```

## Self-verdict

**PASS (after corrective pass).** All manager-identified acceptance failures resolved with failing-test-first evidence; unknown-phase tasks now surface exactly once in Unphased; progress denominator includes missing-progress positive effort; negative effort clamped; dead code removed; 22/22 focused Jest green; `tsc --noEmit` clean for owned files. Owned diff only, no Timeline/GraphQL/locales/backend/package edits, no commit/push/deploy, all existing user work preserved. Acceptance met: owned diff only (verified), RED→GREEN evidence recorded, focused Jest 19/19, `tsc --noEmit` clean for owned files, purity + non-draggable presentation guarantees covered by tests, no production integration, no commit/push/deploy, all existing user work preserved (zero modifications outside owned paths).

## Unresolved questions

1. Should empty configured phases render in Master Schedule, or be hidden until they contain tasks?
2. Preferred source-heading interleaving position (needs an ordering/pin field on `WbsSourceHeading` if not "before all tasks").
3. Unphased label i18n key owner — integration worker or locales task?
4. (Resolved in corrective pass) unknown phase_id → explicit Unphased; effort-weighted progress denominator includes positive effort with missing progress; negative effort treated as 0.
