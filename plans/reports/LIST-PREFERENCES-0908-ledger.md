# List preferences delivery

Status: COMPLETED implementation and local delivery; Vercel production pending rate-limit reset

## Accepted outcome
- List filters and column visibility persist only in browser localStorage, scoped to project/user.
- Default excludes completed/archived root tasks; completed descendants remain nested under visible incomplete parents. Explicit status selection can reveal hidden roots. Historical rejected remains excluded by default.
- Columns settings cover user-facing task fields except description. Immutable metadata is read-only; editable fields retain authoritative API-to-Redux updates.
- Normal and Excel views preserve hierarchy, null clearing, unsaved drafts, fixed widths and visible-column keyboard/copy/paste behavior.

## Delivery
- Baseline: dev/main d48d888.
- Implementer: recognized Herdr Pi gm-clone-destination, w1:p3F, openai-codex/gpt-5.6-sol high; reused prior authorized specialist.
- Worktree: ../list-preferences-0908, branch codex/list-preferences-0908.
- Ownership: List UI, List-specific helpers and focused tests. No backend/schema changes expected.
- Evidence: worker report plans/reports/LIST-PREFERENCES-0908.md; focused unit tests and scoped diff inspection.
- Next: accept evidence, integrate latest dev, push main, confirm Vercel Ready.

## Decisions
- Interpret default-status sentence using the concrete parent/child examples: completed/archive roots unchecked, active roots visible.
- Existing project orchestration allows this manager outside Herdr; explicitly invoked current personal skill supplies Pi ChatGPT routing over obsolete GLM examples.
- Startup prompt returned stalled, then read/get proved working with state_change_seq 398; one server wait retained, no duplicate prompt.

## Delivery evidence
- Create task/subtask title-only validation and optional canonical Start date: 22 focused tests, feature 2fa6a49 integrated as fbd1957; Vercel Production Ready confirmed in Chrome.
- List preference/column/Start date slice: feature 1aefd6c integrated as 3790856; 50 focused tests plus final targeted 13-test suite passed. Normal Progress/Actual dates/Tags editors still incomplete; explicitly assigned next slice.
- dev/main pushed at 3790856. GitHub commit status: Vercel deployment rate limited, retry in 24 hours. No deployment success claimed for this commit.
- Inline-subtask next slice: gm-clone-destination w1:p3F, isolated inline-subtask-0908 worktree. Add multiple drafts beneath arbitrary parent/child rows, title only required, canonical assignments/dates/catalogs, partial failure retry, authoritative Redux insertion; finish missing Normal editors.
- Ubuntu frontend read-only route scout: gm-task-hard-delete w1:p3G; report UBUNTU-FRONTEND-0908.md. Existing backend/database must be preserved.
- User chose waiting for Vercel and subsequently requested local frontend connected to Ubuntu; no new Ubuntu frontend/domain provisioned.
- Inline subtasks and missing Normal editors: b30c16a integrated f3b404b, 41 focused tests passed; report INLINE-SUBTASK-0908.md.
- Strict per-assignee Gantt ordering: b6b2b7d integrated 891e6f5, 31 focused tests passed; same-day leftover hours allowed without exceeding daily capacity; report GANTT-PRIORITY-SEQUENCE-0908.md.
- Both reused workers' reports secured; panes w1:p3F and w1:p3G closed after completion. Existing historical session artifacts retained, not deleted.
- Local/Vercel config worker gm-local-release w1:p3S, Pi openai-codex/gpt-5.6-sol high, --no-session; report MAIN-ONLY-LOCAL-0908.md pending.
- MAIN-ONLY-LOCAL-0908.md received: config817105a verified against live Vercel project roots and official branch matching docs. Local http://localhost:3000/login HTTP200, backend ready; dev-0908/web listener45716, launcher38200 intentionally retained for user testing.
- No remaining product implementation scope from this run. Production later than fbd1957 awaits Vercel rate limit reset; user chose to wait, then authorized local frontend as test surface.
