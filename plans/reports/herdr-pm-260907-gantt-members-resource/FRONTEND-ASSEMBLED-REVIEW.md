# FRONTEND-ASSEMBLED-REVIEW

**Status: DONE_WITH_CONCERNS. Scoped assembled verdict: REJECT** — dashboard descendant counts remain wrong; nine retained parent tests require contract maintenance. Assignment, clone recovery, Members, WBS boundary and saved-plan state pass the scoped checks below. Not release approval.

## Authority, time, immutable source

Independent `openai-codex/gpt-6-astra`, max, pane `w1:p2H`; Windows/Asia Bangkok. Dispatch **17:41:40**, durable checkpoint **17:48**, final **18:05**, 2026-09-07, within 25 minutes. Read primary AGENTS, startup docs in mandated order, active plan/acceptance/decisions and requested final reports. Root README/local rules absent; global development rules read. Activated ak-code-review, ak-test; scoped debugging for failures. No nested agents.

PM authorized testing only after frontendfreeze **`8dcbb2800fb5238200fa0ada01e772f5e7fb043c`**, backend parent **`1f63e251daee568f50e313baab9adc84de80b6cd`**. Independently verified List21 + Gantt27 + Count4, Gantt-last shared winners: **49/49 unique raw hashes match**. Before **17:46:18**, after **18:03:06**: **666/666 tracked source/config/test hashes identical**. HEAD advanced only by integrator's docs commit **`049a6c5ddf31de2c373ae69c384bb2e0a14089d7`**; `git show --stat` confirms only `docs/deployment.md`, `docs/system-architecture.md`. Status before/after only inherited `?? NUL`. `git diff --check` exit0.

## Blocking findings

### F1 — dashboard all-depth count disposition rejected; PM accepted finding

Actual wiring, not filename inference:

- `web/src/app/dashboard/page.tsx:16-17` → `hooks/use-dashboard-tasks.ts:22-33` → `graphql/queries/dashboard.ts:5-16`.
- `app/providers.tsx` mounts `client` from `lib/apollo-client.ts`; that client targets `${NEXT_PUBLIC_BACKEND_URL || https://pm-api.khampha.dpdns.org}/graphql`, with Bearer auth and omitted cookies. Local Yoga `/api/graphql`/Supabase taskService is **not this runtime path**.
- `backend/src/main.rs:110-134` creates AppSchema and mounts POST `/graphql`; `graphql/handlers.rs:119` executes it. `graphql/schema.rs:28` includes TaskQuery re-exported by `resolvers/mod.rs`; `resolvers/tasks/mod.rs:22-30` forwards to `query/tasks.rs`.
- That resolver anchors its recursive CTE at `parent_task_id IS NULL` (`:42`) and returns only forest roots with attached `child_tasks` (`:147`). Dashboard selects **no children**. Member assignee filtering applies at root selection, not independently to descendant rows.

Retained `tests/dashboard-population.test.tsx`: actual backend SDL + actual dashboard document executed by GraphQL; actual dashboard hook consumes the result. Fixture root TODO → child DOING → grandchild TODO: **expected active3/doing1; actual active1/doing0**. Schema execution and exact root-only response assertions pass before the failed count assertion. Controlled return-shape fixture plus mounted-source trace, **not live Rust/DB execution**. Flattening this response cannot recover fields never selected.

**Existing-endpoint correction seam, no backend write necessary:** authenticated `GET_PROJECTS` in `web/src/graphql/queries/projects.ts` → `TASK_TREE_ROWS` per returned project (`queries/tasks.ts`). Mounted `project.rs:209-258` lists owner OR membership with non-null access role; `tasks/query/tasks.rs:158+` requires authenticated caller and `require_project_read`, whose same owner/access-member predicate is `resolvers/mod.rs:53-64,161+`. Flat rows include all active depths and assignee identity. Union distinct task IDs, then filter member rows by their **own** `assignee.user_id`; preserve PM role classification, active-status exclusion, due-date/bug/priority filters. Surface partial/error/project-list failures; never report missing projects as zero. Resource-only placeholders must not gain access. Bound request concurrency; reset stale user results.

This covers **owner/member-visible projects**, not a silently invented global-admin scope. If PM requires all projects outside that authorized population, an explicitly authorized backend aggregate is needed. Source owners: dashboard hook/query; existing projects/tasks documents. Preserve public `Query.tasks` forest contract. PM assigned isolated DASHBOARD-READMODEL-FIX; release source stayed frozen.

### F2 — nine retained parent tests are red in the assembled tree

`web/src/components/tasks/__tests__/project-task-view-recovery.test.tsx` supplies `{data:{tasks}}`; final `tasksSlice.ts:55-84` requires flat `{data:{task_tree_rows}}`. All nine fail at initial load: **“Task tree response is missing”**. This is test-contract maintenance, not proof production clone fails, and **not ignored/closed by Temp passes**. Final owner must update response keys and flatten nested count fixtures while retaining all assertions.

Temp adaptation proves all **9/9** assertions pass with correct flat transport. First key-only adaptation left two nested fixtures incorrectly shaped: **7/9**, then corrected flat fixtures **9/9**. Original repository tests unchanged.

## Actual-boundary acceptance

| Boundary | Independent result |
|---|---|
| WBS nested heading | Exact retained reviewer counterexample **1/1 PASS** with imports relocated only; permanent actual-adapter regression **3/3 PASS**. Collapse A removes A child, preserves Section B/B root; nested ancestry/empty phases/bar-label alignment retained. |
| Assignment | New actual ProjectDetailView + actual List/Excel + actual assignment hook + final thunk/reducer: root/child/grandchild each set unlinked, clear, unrelated title update omitting assignment fields, query acknowledgment, Redux refetch, full remount and visible normal cells **3/3 PASS**. Canonical resource/user pairs, descriptions and hierarchy preserved. |
| Assignment errors | Actual grandchild Excel partial GraphQL error, absent result, incomplete result: dirty edit retained, prior pair retained, no success event **3/3 PASS**. Original hook/cell error assertions also retained. |
| Clone | Temp transport-adapted actual-parent tests preserve one 3-of-6 × quantity3 atomic request; committed/unknown guards across flat/Redux refresh failures, close/reopen, Members-tab unmount, in-flight state, explicit retry and unrelated project. No duplicate mutation. Original selection/ancestor/quantity suites pass. |
| Real Gantt lifecycle | Actual parent + final Timeline + **real usePlanLifecycle/useReorderTasks** + final all-depth thunk: select B while earlier reorder pending; reject background refresh and reorder/its refresh; selected B/history/4h+2h positive-day segments remain afterward **1 PASS**. Initial live unlinked10h allocation is **4/4/2**, matrix Monday **A4/C4/R0/B4**. Empty live project opens real saved B **1 PASS**. No Gantt sentinel substitutes for these two checks. |
| Members | Existing actual Members recovery suite **8/8 PASS**: one form, name-only create, loading/empty/error/retry, confirmed create/link/access plus failed refresh truth, no mutation repetition on refresh retry. List mapping failures covered by original assignment suite. |
| Counts | Adapted actual-parent nested totals/status/root-pagination assertions pass; actual daily-report hook/helper **2/2 PASS**. Overview source uses same distinct all-depth helper for count/status aggregates. No effort-aggregation change found in four count paths. Dashboard fails F1. |

**Pending toolbar caveat:** `Timeline.tsx:1363-1365` renders a skeleton during Redux task refresh. Timeline's lifecycle state survives, but toolbar DOM disappears/recreates. My initial stronger DOM-identity assertion failed; exact test retained as `actual-project-boundaries-strict-dom-assertion.tsx.evidence`. Final lifecycle check verifies selected B after completion, not false continuous-toolbar visibility. No claimed lifecycle reset defect.

## Commands, failures, build/type baseline

Evidence root **`C:/Users/TienVNV/AppData/Local/Temp/frontend-assembled-review-260907-1741/`**. Explicit Node runner loads existing `web/jest.config.js`; sets default reporter, no coverage/watch/cache, in-memory `@/*`, Temp roots and existing module paths. No config/dependency changes. Exact expanded file lists/configs in every `*-command.json`; logs and numeric exits retained. Invocation: `node <evidence>/execute-checks.cjs <group> <test paths>`; Gantt group reads producer's exact 15-target command.

| Group/evidence | Result |
|---|---|
| `narrow` | 5 suites **13 PASS/10 FAIL**: section3, Members8, Report2 pass; original parent9 and dashboard1 fail. |
| `retained-adapted`, `retained-adapted-2` | First **8 PASS/2 FAIL** including retained section1; final parent **9/9 PASS**. |
| `gantt` | Original133 + permanent3: **135/136**, 15 suites, exit1. First increment1 task-bar wait failed. |
| `increment-isolated` | Unchanged increment1 suite **12/12 PASS**, exit0; initial failure retained, not declared fixed. Integrator separately reports136/136. |
| `list-original` | Original five plus real assignment suite **53/53**, 6 suites, exit0; original alias behavior retained. |
| `actual-boundaries-lifecycle` | New combined checks **8/8**, exit0. Earlier harness failures retained: hoisted client initialization, missing thunk metadata/default reducer export, hidden-grid selector, omitted pure scheduling export/member_kind; no product edits or discarded raw failures. |

Integrator raw build independently read: `integrate-final-build.log`, **exit0**, compile/static generation complete; explicitly **skips types and lint**. No redundant build run. Full unfiltered TypeScript logs independently compared: `integrate-final-tsc-baseline-704d5221.log` **exit2/304 source diagnostics**; current **exit2/300 =296 source+4 generated**. **Zero added source signatures**, eight removed; four `.next/types` GraphQL route/timesheet diagnostics remain. Non-clean, not filtered into PASS. Owned UTF8 copies and `type-comparison.json` retained.

## Scope supersession, cleanup, remaining gates

Latest PM/user requirement **supersedes Master individual-task-row preservation**: future Master is progress-type phase-only; WBS hierarchy remains required. Old Master assertions are historical regression evidence, not approval of new behavior. No new catalog/category/type/multilingual settings audit or implementation. Known follow-up owners only: `Timeline.tsx`, `lib/scheduling/build-master-rows.ts`; fixed progress options `tasks/TaskDetailPage.tsx`, `tasks/tabs/DetailsTab.tsx`, `tasks/NewTaskForm.tsx`. Catalog scope remains architect/PM-owned.

Primary manifests: **`FRONTEND-ASSEMBLED-REVIEW.source-manifest.json`**, **`FRONTEND-ASSEMBLED-REVIEW.evidence-manifest.json`** (77 retained artifacts). Owned Temp tests/runners/raw logs preserved; only owned Jest cache removed. No source insertion, product/config/PM-ledger edits, dependencies, DB/browser mutation, server, commit/push/deploy. No owned Node processes remain. Integrator junction and `.next` untouched; cleanup now PM/future owner.

Remaining gates: isolated dashboard + permanent parent-fixture fix, new immutable frontend/review, later Master/catalog acceptance, backend optimized locked artifact/hash gate, deployment backups/readiness and released Chrome/persistence. **No backend or live browser gate claimed closed.**

Unresolved question: dashboard PM scope beyond owner/access-member-visible projects, if intended, requires explicit policy; new catalog scope separately pending.
