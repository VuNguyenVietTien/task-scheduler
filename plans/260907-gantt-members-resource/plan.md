---
title: Unified project members and Gantt resource planning
status: in-progress
priority: P1
effort: large
branch: codex/wip-handoff-20260906
tags: [gantt, members, scheduling, deployment]
created: 2026-09-07
---

# Outcome and scope
One canonical member management section supporting display-name-only members and later email linking; List assignment supports those members and persists. Gantt has one parent/child task hierarchy with plan Start/End, synchronized collapse and timeline, preserving priority drag ordering, filtering, live and saved plans. Under Gantt show all project members and daily assigned effort aligned with displayed plan dates, including unlinked and zero-allocation members; allow PM to assess 8h/day and actual configured capacity, holidays and over-allocation without double-counting parent rollups.

## Authorization and constraints
User now authorizes end-to-end implementation, Vercel frontend and Ubuntu backend deployment and live verification. This supersedes ACK no-deploy restriction. Back up before DB changes; preserve existing identities, assignments, capacities, calendar/groups/commitments, permissions and saved plans. No unrelated changes. Existing AGENTS.md/CLAUDE.md edits and NUL belong to prior work and must be preserved. PM may control default Herdr session from Codex per user's explicit cross-session request; do not fabricate HERDR_ENV. Existing PM pane is user-assigned coordinator contact, not an owned cleanup target. Pi openai-codex only; maximum three specialists, single writer unless isolated disjoint worktrees.

## Execution checklist
- [x] Source/schema and deployment scout; prove owners, contracts and rollback path.
- [x] Architecture/implementation plan including identity migration preservation and resource accounting.
- [ ] Implement members, assignment, hierarchy, ordering, dates, daily resource matrix.
- [ ] Independent tests and stronger-model review; address findings.
- [ ] Backup and deploy Ubuntu backend and Vercel frontend, health and migration checks.
- [ ] Chrome verification against released app and scoped data persistence checks.

See [project ledger](project-ledger.md). Evidence: ../../plans/reports/herdr-pm-260907-gantt-members-resource/.

## Accepted implementation sequence
Physical consolidation into project_members is mandatory (decision-ledger.md). DESIGN is accepted. Gantt and Members/List implementations use isolated worktrees with disjoint ownership. Gantt keeps the compatible resource query/API shape and implements one hierarchy, allocation-driven bars, selected-plan lifecycle and daily matrix. Members owns canonical migration/API and Members/List/Excel surfaces. Clone implementation follows Members to avoid task-file overlap. Independent tests and stronger review gate integration and both deployments. The restored Ubuntu rehearsal database is the migration test target; production is unchanged until release gates pass.


## Added delivery scope
- [ ] Excel shows all parent/child rows, preserving hierarchy and member assignment.
- [ ] Selective tree clone with checkbox selection and copy quantity; 3 selected children × 3 copies yields 3 parents and 9 children.
CLONE depends on MEMBERS and precedes final integration/testing/review/release.

## Accepted project settings extension
- [ ] Dedicated Project setting tab: per-project Progress type, Category and Task type catalogs with stable IDs, localized labels, add/rename/order and comma/newline paste into individually editable entries.
- [ ] Task detail/create selectors use those catalogs; existing task values and unrelated WBS taxonomy remain preserved.
- [ ] Master Schedule shows only progress phase rows from selected-plan positive daily allocations; WBS task hierarchy/priority and resource matrix remain intact. Historical plans do not infer missing classification from current task names.
- [ ] Dashboard/Report/List totals include every task depth; root pagination is explicitly distinguished.
Design and wire authority: PROGRESS-CATALOG-DESIGN.md and CATALOG-API-CONTRACT.md in the reports directory. New catalog migration follows canonical member migration; both deployments and Chrome acceptance remain open.

2026-09-07 18:51 USER RELEASE STEERING: User explicitly allows production deployment once necessary per-module tests pass, before full integration review finishes, so user and PM can test concurrently on Vercel/Ubuntu. Production currently has no users. User permits identifiable test fixtures in production data and does not require a separate test environment. SUPERSEDES prior requirement that all independent/integration review must finish before deployment. Keep necessary module checks, exact immutable integrated artifact/build, backup before schema changes, readiness/smoke and retained rollback. Integration/independent review continues in parallel after release; any observed release-blocking defect still fixed first. Do not reset/restore production merely for tests or discard writes; use bounded identified fixture records. Existing isolated tests can finish/reuse prepared evidence, no requirement to create another environment.
