# PM Frontier Scout 1 — Post-ACCEPT Migration/Deploy/E2E Frontier Audit

**Date:** 2026-09-01 | **Mode:** read-only. Only file written: this report. No source edits, installs, deploys, tests that mutate data, browser/server/credential access.
**Sources:** `ledger.md` (this run), all four `reports/*.md` of this run, `herdr-260831-frontend-migration-scout.md`, `herdr-260831-ubuntu-deploy-preflight.md`, `herdr-260831-backend-platform-hardening.md`, `herdr-260831-vercel-rust-cloudflare-architecture-review.md` (sections), live `git status`/branch, spot re-reads of `web/src`, `backend/schema.graphql`.

---

## 1. Reconstructed 4-row status table (from `ledger.md` events @ 2026-09-01T07:20:35+07:00)

| # | Lane (pane) | State at resume 07:20 | Outcome |
|---|---|---|---|
| 1 | `pm-backend-final` (w3:p3) — backend platform final rework | **doing** ("resumed worker still implementing final migration/readiness fixes") — the one previous doing | **ACCEPT** 07:28 (`reports/pm-backend-review-1.md`); B1–B5 closed, 12 offline + 5 live PG platform tests pass, migrations untouched |
| 2 | `pm-event-final` (w3:pM) — event bridge final rework | **blocked** (implementation done; review_pending) | **ACCEPT** 07:25 (`reports/pm-event-review-1.md`); F1+F3 closed with schema-faithful probes, 20/20 tests |
| 3 | `pm-frontend-w2-1` (w3:pX) — W2 Firebase bearer token source | **blocked** (waiting for review lane / "now unblocked" only at 07:22) | **PASS** fix (`reports/pm-frontend-w2-1.md`) + **ACCEPT** review 07:31 (`reports/pm-frontend-w2-review-1.md`); 8/8 tests, real helper+link chain |
| 4 | `pm-event-review-1` (w3:pW) — independent review lane | **blocked** (queued behind event review) | Ran all 3 reviews (event, backend, frontend W2), all ACCEPT; closed 07:31 |

All four lanes closed. Three independent review ACCEPTs are on record for backend platform, event bridge, and frontend W2.

## 2. Blockers now CLOSED vs still OPEN

**Closed (by this run's ACCEPTs):**
- Migration chain unusable on fresh empty DB → runner-level bootstrap in dependency order is merged and independently verified (`BootstrappedFresh{applied:7}`, idempotent re-run, stock `sqlx::migrate!` byte-compatible). DB-owner handoff (preflight §5.3a / hardening §4.1) **resolved at runner level** — only a raw stock-`MIGRATOR` bypass still fails, and no official path bypasses (`bin/migrate`, `RUN_MIGRATIONS=true` both go through the strategy).
- `/health/ready` strict contract (missing-interior / checksum-mismatch / ahead / partial-schema / stale / dirty → 503) — verified live.
- Event bridge lifecycle + stop/wake lock safety — verified.
- W2 Apollo bearer now from live Firebase SDK identity (all 3 transports share `getAuthToken`); stale cookie cache defect gone; dead `/api/auth/get-token` unreferenced by app code.
- Local-tree ACCEPT gate for deploy (preflight §3 "dirty tree chờ reviewer ACCEPT") — **satisfied** for backend platform, event bridge, and frontend transport/auth lanes.

**Still open (blockers, none code-side):**
1. **Manager decisions (preflight §7):** Path A vs B (A recommended, zero-risk parallel service); task-scheduler DB source (container :5434 vs native :5432); new public API hostname (3 existing cloudflared hostnames belong to the khampha app — must not be repurposed without approval).
2. **Human/server-gated steps:** sudo requires password (unit file + cloudflared edit); server `cargo` toolchain unverified (`bash -lc 'rustc --version'` before A2).
3. **Frontend W3 not started:** defects verified still present in working tree — `web/src/app/projects/new/page.tsx:75` reads `data.createProject.projectId` (SDL: `project_id`) and `web/src/components/tasks/NewTaskForm.tsx:315` sends `progressType.toUpperCase()` vs Rust lowercase enum; `membersSlice.ts:74,102` still fetch dead `/api/projects/{id}/members/bulk|roles` routes.
4. **W4 domain has no Rust target:** grep of `backend/schema.graphql` returns nothing for `reports(`, `createReport`, `systems(`, `designDocuments` — report + design roots still missing; design-doc-service routing decision (architecture review §10 Phase C.3) still open.
5. **No Playwright infra:** no playwright dep or e2e dir in `web/package.json` (grep-verified).
6. **Vercel env contract unverified:** which env key(s) the accepted client expects (`BACKEND_GRAPHQL_URL`) vs what exists (`web/.env.local:33 NEXT_PUBLIC_BACKEND_URL=http://localhost:8080`); Vercel project env state not observable from repo.

## 3. Exact dependency chain → deploy (Path A per preflight)

`Manager decisions (Path A, DB source, hostname)` → `A1 tar+scp source` → `A2 server build (bash -lc cargo; verify toolchain)` → `A3 create task_scheduler DB + .env.production (secrets from store)` → `migrate: RUN_MIGRATIONS=true / bin/migrate on fresh DB (bootstrap order, verified)` → `A4 systemd unit task-scheduler-backend.service (:8081, needs sudo)` → `A6 local smoke (health/live 200; health/ready 200 post-migrate; /graphql __typename; /api/v1/auth/refresh ≠404; CORS preflight ACAO exact)` → `A5 cloudflared ingress + DNS for new hostname (sudo + Cloudflare)` → `public smoke https://<api-domain>/health/live`. Rollback A7 anytime without touching khampha app. Frontend side: set Vercel env (`BACKEND_GRAPHQL_URL` → api domain, Firebase web config) → redeploy `web/`.

## 4. Exact dependency chain → full CRUD/display E2E

`Deploy chain (§3) complete` → `W3 screen re-point + defect fixes (projects/tasks/members/dashboard → Rust ops)` → `W4 unblock: decide design/report strategy (port roots into backend vs route design-doc-service)` → `add Playwright (no infra exists)` → run scout §F matrix, gate order: auth login (no Supabase OTP hop) → middleware negative (no fail-open) → project create→display (kills `projectId` defect) → task create/edit/comment (kills `progress_type` defect) → members bulk ops (`add_project_member_by_email`, remove dead REST) → kanban/gantt (P1) → report chain (W4-gated) → design chain incl. de-hardcode `projectId='1'` (W4-gated) → uploads → notifications → Supabase zero-runtime CI gate (final). Each row needs the §9 evidence set (op+status, canonical ID, persistence, hard reload, second role, negative, cleanup).

## 5. Is deploy/E2E truly unblocked NOW?

**Deploy: PARTIALLY — not autonomous-executable.** Code/review gates are green (all three ACCEPTs; fresh-DB migration strategy verified), but execution requires manager Path/DB/hostname decisions, sudo password, and server toolchain verification (evidence: preflight §1 target-mismatch CRITICAL, §7 open questions 1–5; ledger shows no decision recorded). Nothing in the accepted code removes those.
**E2E: NO — still blocked.** It depends on a deployed backend+frontend pair, W3 defect fixes (verified still present at `new/page.tsx:75`, `NewTaskForm.tsx:315`), W4 backend roots (absent from `backend/schema.graphql`, grep-verified), and Playwright infrastructure (absent, `web/package.json` has no playwright dep).

## 6. Highest-priority next executable task (non-overlapping ownership)

**Task: W3 lane — project/task/member/dashboard screen re-point + two defect fixes.**
- **Why now:** pure `web/` code, backend contract already exists in `backend/schema.graphql` (projects :415, tasks :423–425, members :205/:209/:213/:421, comments :182/:417), zero manager decisions, disjoint from all closed lanes (W1 auth, W2 transport — both ACCEPT) and from W4/W5 file sets (scout §E).
- **File scope (exact, per scout §E W3):** `web/src/app/projects/**`, `web/src/app/dashboard/**`, `web/src/components/projects/{ProjectList,ProjectDetailView,ProjectPage,ProjectForm,MembersView,create-project-modal}.tsx`, `web/src/components/project/**`, `web/src/components/tasks/**`, `web/src/components/timeline/**`, `web/src/redux/features/{tasksSlice,membersSlice,plansSlice,taskDetailSlice}.ts`, `web/src/graphql/queries/{tasks,project,projects,member,plans,dashboard}.ts`, `web/src/graphql/mutations/{tasks,projectMember,projectMembers,plans}.ts`, `web/src/graphql/mutations.ts`, `web/src/hooks/{useProject,useTasks,useTaskStatusUpdate,use-dashboard-tasks,useProjectTasks}.ts`. **Does not touch:** W1 auth files, W2 transport (`apollo-client.ts`, `get-auth-token.ts`), `web/src/app/api/**`, designs/reports files.
- **Concrete fixes:** (1) `new/page.tsx:75` consume `project_id`; (2) `NewTaskForm.tsx:315` drop `toUpperCase()` → lowercase enum per `backend/schema.graphql`; (3) `membersSlice.ts:74,102` replace dead REST fetches with `add_project_member_by_email` / `update_multiple_members` / `remove_multiple_project_members`; (4) align `invite_project_member` → Rust op name; (5) `reorder_tasks` `[Task!]` contract handling.
- **Acceptance:** jest unit on form mapper asserts lowercase `progress_type` sent; unit/contract tests for `project_id` consumption and member op names; `npx tsc --noEmit` 0 errors in changed files (inline-jest config workaround documented by W2 still applies); no edits outside listed scope; disclosure of any residual REST/`NEXT_PUBLIC_BACKEND_URL` usage in owned files.

## 7. Unresolved questions for manager

1. Path A vs B + DB source + new public hostname (preflight §7.1–3) — required before any deploy step.
2. Who runs deploy (sudo holder) and when; verify `bash -lc 'rustc --version'` on server first (preflight §7.5).
3. W4 strategy: port report/design roots into `backend/schema.graphql` vs route `design-doc-service` behind api domain — gates report/design E2E rows.
4. Confirm Vercel env contract (`BACKEND_GRAPHQL_URL` + Firebase keys) for the `web/` project before frontend deploy.
5. `/api/auth/get-token` legacy route deletion owner (W1 follow-up, disclosed in W2 review).
