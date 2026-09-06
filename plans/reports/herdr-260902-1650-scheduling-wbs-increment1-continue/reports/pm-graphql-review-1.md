# PM GraphQL Review 1 — Independent Review of Increment 1 Task 1.3

**Reviewer:** pm-graphql-review-1 (pi session, independent) · **Date:** 2026-09-02
**Under review:** `reports/pm-graphql-impl-1.md` (worker pm-graphql-impl-1)
**Plan:** `docs/superpowers/plans/2026-09-01-project-scheduling-wbs.md` Task 1.3 · **Design:** `docs/superpowers/specs/2026-09-01-project-scheduling-wbs-design.md`
**Method:** ak:code-review evidence-based protocol (Stage 1 spec compliance → Stage 2 quality → independent verification gate). READ-ONLY: no edits, no git mutations, no .env/credential access, no live DB.

---

## Item 1 — GREEN re-run (independent): **PASS**

All commands re-run fresh by the reviewer (not trusting worker output).

| Command | Result | Evidence excerpt |
|---|---|---|
| `cd backend && cargo test --test contract -- --nocapture` | **ok** | `test result: ok. 23 passed; 0 failed; 0 ignored` — includes all 13 `increment1_graphql::*` tests (`sdl_project_schedule_projection_query`, `projection_counts_each_real_task_once_regardless_of_depth`, `sdl_has_no_schedule_engine_dependency`, …) + 10 pre-existing; exit 0 |
| `cargo test --test taxonomy_hierarchy` | **ok** | `test result: ok. 5 passed; 0 failed; 1 ignored` |
| `cargo test --test resource_members` | **ok** | `test result: ok. 8 passed; 0 failed` |
| `cargo test --test import_issue_1115_dry_run` | **ok** | `test result: ok. 20 passed; 0 failed` |
| `cargo check --all-targets` | **ok** | `Finished \`dev\` profile … in 0.30s` — 0 errors, pre-existing warnings only (`unused import: schema::AppSchema` etc.), exit 0 |
| `cd ../web && npx jest src/graphql/__tests__/w3-contract.test.ts src/graphql/__tests__/w3-sdl-fixture.test.ts --config jest.config.js --reporters default --runInBand` | **ok** | `Test Suites: 2 passed, 2 total / Tests: 43 passed, 43 total`, exit 0 |

Worker's §3 GREEN claims **reproduced exactly** (same pass counts, same flags). RED evidence (§2) is documented and plausible (E0433 unresolvable module before mount); not re-runnable without reverting the tree — accepted as documented.

## Item 2 — Ownership audit: **PASS** (with inherent dirty-tree limitation)

`git status --porcelain` over the claimed file set:

```
 M backend/schema.graphql
 M backend/src/graphql/resolvers/mod.rs
 M backend/src/graphql/schema.rs
 M backend/src/lib.rs
?? backend/src/graphql/resolvers/schedule_projection/
?? backend/src/scheduling/
?? backend/tests/contract/
?? web/src/graphql/__tests__/w3-contract.test.ts
?? web/src/graphql/__tests__/w3-sdl-fixture.test.ts
```

- Claimed NEW files exist: `src/scheduling/projection.rs` (sole file in `src/scheduling/`), `schedule_projection/{mod.rs (349L), imports.rs (14L)}`, `tests/contract/increment1_graphql.rs` (409L). ✔
- Claimed MODIFIED tracked files all dirty. ✔
- **lib.rs — ONLY gate removals: consistent.** `grep -n "cfg(test)\|#\[path" backend/src/lib.rs` → **zero hits** (both gates fully removed). Diff vs HEAD contains exactly: `pub mod domain;` / `pub mod imports;` / `pub mod migration_runner;` additions + the `Config` re-export reformat. Cross-verified against prior-task reports: `pm-taxonomy-impl-1.md:27` ("`pub mod domain;` + `#[cfg(test)] #[path]` gate"), `pm-resource-import-impl-1.md:31` ("`pub mod imports;` + resource_members compile gate") and `:83` (explicit instruction: "mount … then REMOVE the `#[cfg(test)] #[path]` gate"), `pm-foundation-review-1.md:20` (gate evidence). Nothing in the lib.rs diff is attributable to this task beyond the gate removals; no stray edits. ✔
- `resolvers/mod.rs` diff = exactly the 3 claimed `pub mod taxonomies; pub mod resource_members; pub mod schedule_projection;` + pre-existing user reorder of mod/pub-use blocks. ✔
- `schema.rs` diff = fold of `TaxonomyQuery/Mutation`, `ResourceMemberQuery/Mutation`, `ScheduleProjectionQuery`, `ImportDryRunQuery` into merged roots + their imports (other hunks are import reordering consistent with user's pre-existing diffs per worker §1; see limitation below).
- Documented deviation verified: `backend/tests/contract/main.rs:230` → `mod increment1_graphql;` — single line, matches the repo's `tests/*/main.rs` auto-discovery convention (worker cited `tests/platform/main.rs → migration_evidence`). ✔
- **Limitation (inherent, not worker's fault):** `tests/contract/`, `src/scheduling/`, and both web test files are **untracked** — there is no git baseline for the pre-task dirty tree, so "existing tests untouched" and "pre-existing user diffs preserved" cannot be byte-verified by a reviewer; they are corroborated only by worker attestation + prior reports + passing counts (43 web tests = 19+5 existing-side + 10 new-side as claimed). No unowned tracked-file change **detected**; detection power is bounded by the absent baseline.

## Item 3 — Contract surface (backend/schema.graphql): **PASS**

| Required | Evidence (backend/schema.graphql) |
|---|---|
| `project_schedule_projection` + `CURRENT_TASK_FIELDS` | `:591 project_schedule_projection(project_id: ID!): ProjectScheduleProjection!`; `:644-648 enum ScheduleProjectionSource { CURRENT_TASK_FIELDS }` (sole value; no `CAPACITY_SCHEDULER`) |
| `SchedulePhaseGroup` explicit unphased semantics | `:636-642` — `phase_id: ID` (nullable), `phase_key: String!`, `is_unphased: Boolean!`, `task_ids`, `totals` |
| `union ScheduleWbsRow` | `:688 union ScheduleWbsRow = ScheduleTaskEntry \| ScheduleSourceHeading` |
| Heading has NO task_id/dates/effort/progress | `:655-662 type ScheduleSourceHeading { heading_id, source_system, external_id, title, depth }` — nothing else; locked by test `sdl_source_heading_is_distinct_with_no_task_identity` (tests/contract/increment1_graphql.rs:141-175) which asserts `!heading.contains("task_id:")`, no `progress:`/`effort_hours:` |
| `set_task_taxonomy` | `:348 set_task_taxonomy(task_id: ID!, phase_id: ID, category_id: ID): Boolean!` |
| Taxonomy CRUD incl. archive guard | `:330 ensure_default_phases`, `:334 create_project_phase`, `:338 update_project_phase_translations`, `:343 archive_project_phase(project_id, phase_id, strategy: ArchiveStrategyInput!)`; `:14` doc "Exactly one of `reassign_to` / `unphased` must be set" + `:16 unphased: Boolean` (XOR guard input) |
| Resource member ops | `:577 project_phases`, `:581 resource_members`, `:585 resource_member`, `:353 create_resource_member`, `:358 link_resource_member_user`, `:363 classify_resource_member` |
| `import_dry_run` + `snapshot_sha256` | `:596 import_dry_run(manifest: JSON!): ImportDryRunReport!`; `:177 snapshot_sha256: String!` (name pin `#[graphql(name = "snapshot_sha256")]` verified at resolvers/schedule_projection/mod.rs:262) |
| NO capacity/allocation/meeting/schedule-engine anywhere in operative SDL | Manual grep: only hits are `:361` and `:588-589` — both inside `"""` doc blocks. Locked by `sdl_has_no_schedule_engine_dependency` (increment1_graphql.rs:177-204) which strips doc blocks then scans `allocation/segment/meeting/capacity/CAPACITY_SCHEDULER` → passed. ✔ |

`ScheduleTotals.effort_hours: String!` with 2-dp display doc (`:683-685`). ✔

## Item 4 — Quality review: **PASS** with findings (0×P1, 2×P2, 3×P3)

### Verified-good (evidence)

- **No N+1:** `project_schedule_projection` issues exactly 3 fixed queries (tasks / active phases / wbs_groups), each bound by `project_id`, then calls the pure projector (`resolvers/schedule_projection/mod.rs:184-248, 258-271, 283-300`). No per-task/per-phase queries. Deleted-task exclusion: `WHERE project_id = $1 AND NOT COALESCE(is_deleted, false)` (mod.rs:188-190) — matches spec §5.3 "real non-deleted tasks only".
- **Pure projector math (spec §5.3):** rollup is one flat pass over the task slice (`projection.rs:139-186`) — each real task contributes exactly once regardless of depth (locked by `projection_counts_each_real_task_once_regardless_of_depth`: 3-level chain → count 3, effort "60.00"). Weighted progress rule exactly as specified in the brief: contributors = `if let Some(p) = t.progress` (projection.rs:157); weight = `t.effort.filter(|e| *e > 0.0).unwrap_or(1.0)` (projection.rs:159); `round2` → 2dp (projection.rs:135-137); fixture math (10×100 + 20×50)/30 = 66.67 asserted. start/end = min start / max due among tasks with dates (projection.rs:166-177). Unphased: NULL or unknown/inactive phase → unphased bucket, never dropped (projection.rs:201-212; locked by test with an unknown phase_id). Unphased group always appended LAST even when empty (projection.rs:225-232; locked).
- **`display_effort`:** `Decimal::from_f64_retain(v)` → `format!("{:.2}")`, None/NaN/negative → `Decimal::ZERO` (projection.rs:122-129). Test locks `7.5→"7.50"`, `0.1+0.2→"0.30"`, `None→"0.00"` (increment1_graphql.rs:290-319). Correct string-decimal conversion.
- **Error mapping & async-graphql conventions:** plain `async_graphql::Error::new(format!(...))` with contextual prefixes (`invalid project_id`, `failed to load tasks`, `invalid manifest`, `dry-run validation failed`) — identical style to sibling Task 1.1/1.2 modules (`taxonomies/mod.rs:28-32,193,247,271,304`; `resource_members/mod.rs:33-37,78,91,212`). `#[Object(rename_fields = "snake_case", rename_args = "snake_case")]` + `#[graphql(rename_fields = "snake_case")]` on all types — consistent with repo SDL conventions (snake_case ops locked by pre-existing contract tests). Input validation: UUID parse for `project_id` (mod.rs:180-182); manifest validated through serde + `dry_run` error mapping (mod.rs:332-340).
- **`#[path]` shim risk — no divergence possible:** `src/scheduling/` contains ONLY `projection.rs` (no `mod.rs`), so the projector is compiled exactly once — via `schedule_projection/mod.rs:20-21` (`#[path = "../../../scheduling/projection.rs"]`). The imports shim (`schedule_projection/imports.rs:8-13`) compiles `src/imports/{manifest,issue_1115}.rs` a second time, but both are single-sourced files (editing `src/imports/**` changes both copies; no independent copy exists) and provably pure (no DB/clock/side effects; `dry_run` write-free, per Task 1.2 report + 20 dedicated tests re-run green). Only residual cost: duplicate-compile time and the theoretical future hazard of someone adding a static/global to those files (would be duplicated per compilation path) — acceptable; Increment-2 owner should drop the shim per worker §7.1.
- **SDL regeneration reproducible:** `regenerates_schema_dot_graphql` (tests/contract/main.rs:32-36) writes the SDL from the built schema; reviewer ran it twice → identical SHA-256 both times (`88298ad6…d08e`). Web SDL-validity test reads the LIVE `backend/schema.graphql` directly (`w3-sdl-fixture.test.ts:118`), so no stale fixture copy can drift.
- Heading/task traversal never panics on corrupt graphs: heading `visited` set breaks heading cycles (projection.rs:283-286); orphan/self-parent tasks surface as roots (parent invalid/not-in-set → root; projection.rs:264-276; domain contract locked by `assemble_forest_returns_orphan_and_self_parent_rows_as_roots`). Task-cycle members are structurally unreachable (single-parent model ⇒ no entry edge into a cycle), so no unbounded recursion.

### Findings (severity-ranked)

- **P2-1 — Lenient column reads swallow decode errors for `effort`/`progress` → silent zero hazard at Increment 2.** `resolvers/schedule_projection/mod.rs:205-208`: `row.try_get::<Option<f64>, _>("effort").ok().flatten()` and same for `progress` — every other column uses strict `.map_err(db_field(...))`. On a column-type drift the read degrades silently to `None` → all efforts render `"0.00"` with no error. This becomes live at Increment 2's planned `NUMERIC(10,2)` migration (spec: "Scheduling quantities become exact decimal hours"; sqlx does not decode `NUMERIC` → `f64`), where a missed resolver update would silently zero every effort instead of failing loudly. Fix: strict `try_get` + `db_field` mapping (or an explicit typed decode with error) before Increment 2 lands.
- **P2-2 — Pure task-cycle rows are dropped from `wbs_rows` while still counted in totals; worker's "cycles surface once" claim is not locked by any test.** In a 2-cycle (a.parent=b, b.parent=a) both members have valid in-set parents, so neither becomes a root/heading-attached (projection.rs:264-276) and neither is reachable in traversal → `wbs_rows` omits them, yet `rollup` over ALL tasks (projection.rs:330) counts them ⇒ `wbs_rows` task count < `totals.task_count` on corrupt data (internal-consistency hazard for Task 1.4 rendering). Orphan/self-parent surface as roots; cycle members should arguably also surface as roots. Also: the heading-cycle `visited` path (projection.rs:283-286) and this task-cycle behavior have NO test coverage in `increment1_graphql.rs` — worker report §4 "heading/task cycles surface once, never panic" overstates ("surface once" is false for task cycles; only "never panic" holds). Fix: treat cycle-entry tasks as roots (same policy as orphan/self-parent) + add cycle tests for both heading and task graphs.
- **P3-1 — Totals rounding vs entry rounding can differ by a cent.** `rollup` rounds each task's effort `.round_dp(2)` BEFORE summing (projection.rs:149-153), while `display_effort` rounds only at render. Pathological legacy floats (e.g., many 0.005 tasks) can make `totals.effort_hours` ≠ sum of displayed entry strings by 1 cent. Legacy-float-only; disappears with Increment 2 decimals. Nice-to-fix: sum then round once.
- **P3-2 — Spec wording vs implemented progress weight for non-positive-effort tasks.** Design §5.3 (line 116): "progress = effort-weighted current task progress for positive-effort tasks" could be read as excluding zero/None-effort tasks; implementation (and the brief's stated rule, and worker §5) gives them weight 1.0 (they still contribute). Reconcile the design wording during Increment 2 to prevent a future reviewer/worker implementing the exclusive reading.
- **P3-3 — `report_json` degrades silently.** `ImportDryRunReport::build` (mod.rs:286): `serde_json::to_value(&report).ok()` → `None` on (practically impossible) serialize failure. Acceptable for a diagnostic passthrough; a `tracing`/log on failure would be nicer.

Accepted limitations (documented by worker, no action): resolver DB-path execution deferred to Task 1.5 e2e (same layering as 1.1/1.2 handoffs); no extra auth on resource-member ops beyond existing module conventions (§6.8); jest dual-config workaround flags (§6.3); known pre-existing `auth::auth_common::tests::test_token_flow` baseline failure not chased.

## Item 5 — Spec compliance (Task 1.3 acceptance + handoff): **PASS**

- Plan acceptance "GraphQL contract works without capacity/allocation/meeting/version tables": full Increment 1 surface composes and the contract suite is green with zero schedule-engine dependency — operative SDL scanned clean (Item 3), `cargo check --all-targets` green, all four backend suites green, web 43/43. "Do not touch existing plan resolver implementations": `resolvers/plans` untouched (not in any diff); plan-scope check of `git status` shows no plan-resolver files dirty beyond pre-existing state.
- Rollup semantics match design §5.3 (exact phase display order + explicit Unphased last; effort once per task; min/max dates; effort-weighted progress; non-deleted count). Headings as distinct non-task rows match §5.2 (":106 Source headings have no task ID, … effort, progress, …"). Decimal-as-string matches §"Decimal values cross GraphQL as strings".
- Handoff to Task 1.4 present and adequate: report §4 = exact SDL operation/field/enum names (verified against schema.graphql line-by-line above); §5 = realistic current-field projection fixture (JSON) + weighted-progress rule documentation (66.67 example verified by pure test). Task 1.4 has everything needed to build `useScheduleProjection` / `build-wbs-rows`.

---

## Final verdict: **ACCEPT**

All 5 verification items PASS. The implementation is within Task 1.3 exclusive ownership (one documented, convention-matching deviation: `tests/contract/main.rs:230`), the contract surface matches the plan/design exactly, the projector math is spec-correct with meaningful pure-test locks, and the full GREEN matrix reproduces independently. No P1 blockers; neither P2 is a contract violation or a Task 1.3 scope defect — both are forward-looking robustness items to schedule.

**Follow-ups (non-blocking, for Increment 2 / Task 1.5 owners):**
1. (P2-1) Make `effort`/`progress` column reads strict in `schedule_projection/mod.rs:205-208` before the NUMERIC(10,2) migration — mandatory pairing with Increment 2's effort migration.
2. (P2-2) Surface task-cycle members as roots + add heading-cycle and task-cycle tests in `increment1_graphql.rs`; correct the "cycles surface once" claim in future reports.
3. (P3-1) Sum-then-round once in `rollup` when touching effort for Increment 2.
4. (P3-2) Reconcile design §5.3 progress-weight wording (weight-1.0 for non-positive-effort contributors).
5. (Worker §7.1) Increment 2 should register `src/scheduling` as a real crate module and drop the `#[path]` shim; (§7.2) consolidate the dual jest configs under web-config ownership.

**Unresolved questions:** none blocking. Reviewer-side limitation repeated for the record: the pre-task dirty tree has no git baseline (untracked files), so "existing content untouched" claims are corroborated (prior-task reports + counts) rather than byte-proven.
