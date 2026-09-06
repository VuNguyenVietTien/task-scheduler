# PM Schedule Scout Report 1 — Scheduling Semantics & Architecture Options (WBS/Gantt, source issue 1115)

- Date: 2026-09-01 · Scope: read-only · Author: pm-schedule-scout-1
- Sources: issue-1115 facts (given), repo files cited inline. Deadline constraint honored; report complete.

---

## 1. Source Issue 1115 — Given Facts (Redmine export)

- "Detailed Design" root has **179 descendants: 23 phase nodes + 156 task nodes**.
- Current Redmine depth is exactly **phase → task** (2 levels under root; no task→subtask nesting).
- Recurring task-name patterns per phase: `Preparation/Create`, `Try-S Review 1`, `Address Review Comments 1`, `Try-S Review 2`, `Toshiba Review` → implies **review cycles with recurrence-like repetition** and **external-reviewer (Toshiba) fixed meetings**.
- Root **estimated total = 387h** (rollup of descendants).

Implication: the scheduling domain must support (a) WBS rollups, (b) repeated review cycles (template/sequence), (c) fixed external meetings, (d) per-member daily capacity with leave/overtime, (e) 8h default day.

## 2. Current-State Evidence (repo)

| Concern | Evidence | Gap vs. required semantics |
|---|---|---|
| WBS parent-child | `tasks.parent_task_id` self-FK (`backend/migrations/20250319000000_create_initial_schema.sql`); exposed in `backend/src/graphql/types/task.rs:26` and `web/src/graphql/queries/tasks.ts` | Adjacency only; no depth constraint, no ordering within parent, no path enumeration, no rollup |
| Effort | `tasks.effort DOUBLE PRECISION` (unitless float); `update_effort.rs` writes scalar directly | No unit (h vs d), no per-day allocation, no capacity binding |
| Dates | `tasks.start_date/due_date TIMESTAMPTZ`, `actual_start/end_date` | Wall-clock instants only; no working-day/hours semantics |
| Dependencies | **None.** No `task_dependencies`/FS relation anywhere (`grep depends_on/predecessor` → only migration-runner wording) | FS prerequisites entirely absent |
| Gantt | `plans` table stores Gantt as **JSONB snapshot** `plan_data` w/ one `is_active` plan per project (`backend/migrations/20230705000001_create_plans_table.sql`, Vietnamese comments: "Lưu trữ các kế hoạch sắp xếp task trên Gantt chart") | Schedule is hand-authored frozen JSON, not computed/invariant-checked |
| Gantt UI | `web/src/components/tasks/GanttChart.tsx` is **0 bytes**; `web/src/components/gantt/` does not exist | No rendered Gantt today |
| Capacity/leave/overtime | `users.work_capacity INTEGER` (schema only); no calendar/leave/holiday/recurrence tables; only a `/calendar` nav link (`web/src/components/layout/Sidebar.tsx:14`) | No resource calendar domain at all |
| Members | `project_members` UNIQUE(project_id,user_id); roles `Manager/Leader/Member/Guest` w/ Admin→Manager, Viewer→Guest mapping (`web/src/types/project.ts`) | No placeholder/provisional member concept; no group/company entities |
| Stack direction | `docs/system-architecture.md`: migrating Node+Rust microservices → unified Next.js/GraphQL Yoga/Supabase; `backend/` (Rust) still has task resolvers | Where the scheduler lives matters for migration |

## 3. Scheduling Semantics — Precise Invariants

Time basis: **working calendar days**; day capacity = **8h default** (`CAPACITY_DEFAULT=8`), overridable per user (`users.work_capacity` → hours/day) and per date (leave ≤ capacity, overtime ≥ capacity).

**WBS (INV-W)**
- **W1** Every non-root node has exactly one parent (`parent_task_id NOT NULL` for non-roots); graph is a forest (no cycles; reachable-root uniqueness).
- **W2** Depth ≤ 2 under a project root: root → phase → task (matches issue-1115; enforce in write path, allow deeper later via config flag).
- **W3** Phase nodes are containers: they carry **rollup** effort/dates only (computed), never directly allocated; only leaf (task) nodes are schedulable. Detect leaf = no children.
- **W4** Sibling order is explicit (`position` int, dense per parent) — needed for stable tie-breakers (§6).
- **W5** Rollup: `phase.effort = Σ leaf.effort`; `phase.start = min(leaf.start)`; `phase.end = max(leaf.end)`; root likewise. Progress rollup = Σ(leaf.effort×leaf.progress)/Σ(leaf.effort). Deleting/re-parenting must recompute ancestors atomically.
- **W6** Rename-derived structure (e.g., "Try-S Review 2") is data, not semantics: recurrence cycles are first-class entities (see R) and name similarity is never used by the engine.

**Dependencies (INV-D)**
- **D1** Edges are typed `finish_to_start` only in v1 (`dep(predecessor, successor)`), DAG-enforced (no cycles, incl. transitive check on insert).
- **D2** FS semantics: `successor.earliest_start ≥ predecessor.scheduled_end` on the **working-day** axis (successor starts next working day after predecessor finishes, same calendar).
- **D3** Dependencies may reference only leaf tasks (phase-level constraints expand to "all leaves").
- **D4** Dates edits that violate D2 are either auto-repaired by reschedule or rejected with violation list (mode flag; §8 explains mode).

**Effort allocation vs capacity (INV-E)**
- **E1** Each task has `effort_hours > 0` (numeric(8,2)); default derived from estimate or 8h×days if only duration given.
- **E2** Allocation model: per (member, date) cell, `allocated = Σ task_allocations(m,d)` must satisfy `allocated ≤ base_capacity(m,d) + overtime(m,d)` where `base_capacity = user.work_capacity ?? 8`, reduced by leave hours that date.
- **E3** Default allocation splits task effort evenly across consecutive working days from start, one task at a time per member (no parallel split unless `allow_parallel`); leftover partial day carries remainder.
- **E4** A task's scheduled duration = number of working days its allocation spans; `end = last allocation date`.
- **E5** Leave/overtime are per (user, date) records (`leave_hours`, `overtime_hours`); leave cannot exceed base capacity (invariant on write).

**Gantt segments (INV-G)**
- **G1** A task's bar = union of contiguous allocation runs; **non-contiguous runs render as multiple segments** (gap = zero-allocation days, e.g., weekend, leave, or preemption).
- **G2** Segment list is derived from `task_allocations`, never hand-edited; `plans.plan_data` JSONB becomes a **projection/cache**, not source of truth.

**Recurrence & fixed meetings (INV-R)**
- **R1** Recurring patterns expand to dated instances (`recurrence_rule` + `recurrence_instances`); instances are ordinary schedulable leaves with provenance link.
- **R2** Fixed-time meetings (e.g., Toshiba Review) have `fixed_start/fixed_end`, **priority class FIXED**: they pin capacity first; allocations never move them and never overlap them.
- **R3** Expansion is deterministic and idempotent (same rule+range ⇒ same instance set, stable keys for upsert); rule edits re-expand only future instances by default.
- **R4** Review cycles ("Try-S Review 1" → "Address Review Comments 1" → "Try-S Review 2") are modeled as an ordered **template sequence** instantiated per phase, not by name parsing.

**Priority & unscheduled work (INV-P)**
- **P1** Priority order: (priority_class, priority, priority_order, deterministic tie-break §6). FIXED > scheduled tasks > `unscheduled` backlog.
- **P2** Tasks marked `unscheduled` (or unallocatable) appear in a backlog lane with reasons, not on the Gantt time axis.
- **P3** Lower-priority work is pushed (later start) rather than dropped; pushing may cross project `end_date` → infeasibility signal (§8).

**Rollups (INV-U)**
- **U1** Phase rollup per W5; **master rollup** = project root across all phases (Σ 387h check: engine must reproduce the issue-1115 total exactly from leaves).
- **U2** Rollups are always computed (view/materialized), never stored on editable task rows.

**Identity & orgs (INV-M)**
- **M1** Placeholder members: `project_members` rows with `user_id NULL`, `placeholder_key` (stable slug) + display name; assignments may target placeholder. **Linking** = backfill `user_id` where `placeholder_key` matches (explicit confirm), atomically re-pointing `task_allocations.assignee`.
- **M2** UNIQUE(project_id, COALESCE(user_id, placeholder_key)) — no duplicate identity per project.
- **M3** Groups/companies: `groups` (type: team|company) with `group_members`; capacity can be pooled at group level for phase planning, but allocations bind to concrete member (or placeholder).

**Multilingual taxonomy (INV-L)**
- **L1** Project category/phase-type names are keys into `taxonomy_terms(term_key, locale, label)`; engine matches by `term_key`, never by display string (so "Preparation" / "準備" are the same phase type).
- **L2** Import from Redmine maps names → term_key via exact + alias table; unmapped names are reported, not guessed.

## 4. Architecture / Algorithm Options

### Option A — Scheduler-in-backend, relational engine (recommended core)
Rust/GraphQL (and later Supabase/Next) exposes new tables: `wbs via tasks+position`, `task_dependencies`, `calendars`, `member_capacity_days`, `recurrence_rules/instances`, `task_allocations`. A deterministic **serial scheduling algorithm** runs server-side:
1. Topologically sort leaves (Kahn; ties by W4 order + §6).
2. Place FIXED meetings first; then per member, per task in order, walk working days applying capacity (E2–E4), emitting allocation rows.
3. Rollups via single aggregation query over leaves.
- Pros: invariants enforceable in DB (FKs/CHECK/exclusions), allocation rows directly feed non-contiguous Gantt, testable pure function, no client drift. Cons: new schema surface + backfill from `plans.plan_data`; slower iteration.
- Complexity: O(V + E + Σ allocation days) — trivial at 179-node scale.

### Option B — Client-side scheduler over JSONB plans (extend `plans.plan_data`)
Keep source of truth in `plan_data`; TypeScript engine in `web/` computes layout; server stores blob.
- Pros: fastest to demo (GanttChart.tsx is empty anyway); no migrations. Cons: violates W5/U2/E2 enforceability (no DB constraints), concurrent edits race on one JSONB row, backend API can't answer "why unscheduled", must duplicate logic in Rust during migration. **Rejected as source of truth**; acceptable only as throwaway prototype.

### Option C — Hybrid: relational truth + materialized schedule projection (recommended)
Option A's tables + engine, with results written to `schedule_projection(project_id, generated_at, plan_data jsonb)` superseding `plans` for reads; Gantt/rollup endpoints read projection; writes go through engine transaction.
- Pros: A's integrity **plus** cheap reads, snapshot/diff (audit of schedule changes), keeps existing `plans`-shaped consumers working during migration; recompute is explicit & versioned. Cons: one more moving part (staleness must be flagged).
- Fits stated stack transition (`docs/system-architecture.md`) since projection jsonb can be produced by either Rust engine now and a TS engine later against the same tables.

## 5. Deterministic Tie-Breakers (total order for scheduling)

Order key (ascending), guaranteed unique per project:
1. priority_class (FIXED=0 < SCHEDULED=1 < UNSCHEDULED=2)
2. task priority enum rank (urgent>high>medium>low maps to 1..4, higher first)
3. `priority_order` (manual rank, lower first)
4. dependency depth (longest path from roots, deeper/earlier first)
5. earliest `not_before` date, then parent `position` path (W4), then `task_id` (UUID byte order)
All sort steps are stable and total ⇒ **same input + same calendar ⇒ byte-identical schedule** (golden-file testable).

## 6. Infeasibility & Explainability Outputs

Engine returns a structured `ScheduleResult`:
- `assignments[]` (allocation rows), `unscheduled[{task_id, reason_code, detail}]`, `violations[]` (DAG cycle, capacity negative, leave>capacity, rollup mismatch), `summary{total_hours, by_phase, makespan, over_capacity_dates[]}`.
- Reason codes: `NO_CAPACITY` (all members at capacity in window), `MISSING_ASSIGNEE`/`PLACEHOLDER_UNLINKED`, `DEP_BLOCKED` (with chain: pred ids), `FIXED_CONFLICT`, `INSIDE_LEAVE` (only-overtime could fit → requires user consent), `AFTER_PROJECT_END`.
- Every moved/auto-scheduled task carries `explanation` (ordered causes: "after TRY-S-2 → after REVIEW-1 → member on leave 09-14"). API surface: `schedule(projectId, mode: VALIDATE|APPLY|EXPLAIN)`.

## 7. Phased Implementation Recommendation

- **P0 (foundation, no UI):** migrations for `position`, `task_dependencies`, `member_capacity_days(leave/overtime)`, `recurrence_*`, `task_allocations`, placeholders (M1), `taxonomy_terms`; engine core (§4.C) as pure module + unit tests; import job Redmine→leaves reproducing 387h rollup.
- **P1 (scheduling v1):** FS deps + 8h/capacity allocation + tie-breakers; `EXPLAIN` output; phase/master rollup endpoints; replace `GanttChart.tsx` empty shell with segment renderer reading projection (G1).
- **P2 (richness):** recurrence expansion (R1–R4), fixed meetings, unscheduled backlog lane (P2), placeholder linking UI, groups/companies pooling, multilingual taxonomy admin.
- **P3 (migration):** port engine to unified `web/` backend against same tables; keep `schedule_projection` contract so frontend unchanged.

## 8. Test Scenarios (deterministic)

1. **Rollup fidelity:** import fixture replicating issue-1115 (23 phases/156 tasks/387h) ⇒ root effort = 387.00 exactly; phase sums = leaves.
2. **8h default split:** 20h task from Mon ⇒ allocations Mon–Wed 8/8/4, duration 3 working days, no weekend rows.
3. **Leave interplay:** member on leave Wed (8h) ⇒ 20h task spans Mon–Thu (8/8/0/4) with gap segment; overtime 4h Wed ⇒ 8/8+4... respecting E2.
4. **Non-contiguous segments:** task preempted by higher-priority FIXED meeting ⇒ two Gantt segments with explanatory gap.
5. **FS chain:** A(16h) → B ⇒ B starts day 3; cycle A→B→A rejected with cycle path listed.
6. **Fixed meeting priority:** Toshiba Review pinned 09-10 10:00–12:00 ⇒ overlapping allocation rejected/moved, meeting unmoved.
7. **Tie determinism:** two equal tasks same member/day ⇒ order by §5; run twice ⇒ identical allocation byte-output (golden file).
8. **Infeasibility explain:** full-capacity member + 40h task ⇒ `unscheduled` with `NO_CAPACITY` and first-free date.
9. **Placeholder link:** assign to "placeholder:toshiba-pm", then link user ⇒ all allocations re-pointed atomically, duplicate-member invariant holds.
10. **Recurrence idempotence:** expand weekly review rule over 8 weeks twice ⇒ same instance keys, no duplicates.
11. **Rollup under edit:** move a leaf across phases ⇒ both phase rollups and master recompute in one transaction (W5/U1).
12. **Localization:** same phase under `ja` locale matches by term_key, not label (L1).

## 9. Open Questions

1. Effort unit in Redmine source (h vs d) and whether 387h is estimate or spent — affects import rounding.
2. Should overtime require explicit consent per task/date (E5/P3) or be auto within a cap?
3. Is one active plan per project (current `plans` unique index) still desired, or schedule versions per baseline?
4. Placeholder member scope: per-project only, or cross-project directory entities (ties into groups/companies)?
5. Calendar definition source: per-user, per-project, or org-level holiday table?
