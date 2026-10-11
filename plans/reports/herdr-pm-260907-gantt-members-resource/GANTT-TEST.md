# GANTT-TEST — independent acceptance verification

Status: **DONE_WITH_CONCERNS**
Verdict: **REJECT Gantt acceptance.** Preserved implementation has five reproducible contract failures. No product fix made.

## Scope and evidence limits

Read primary authority/startup docs, acceptance, DESIGN, GANTT and GANTT-FINISH first. Inspected only authorized Gantt seams/tests. Tests use pure functions, Redux fixtures, mocked lifecycle/config, MockedProvider. No server/browser/API persistence/DB/SSH/deploy evidence; those gates remain separate.

## Results

| Gate | Result |
|---|---|
| Producer-focused checkpoint | PASS: 5 suites, 35 tests, 0 snapshots, 29.855s |
| Independent focused suite after added regressions | **FAIL: 6 suites; 36 passed, 5 failed, 41 total; 19.241s** |
| Default Jest | **BLOCKED before tests**: configured `jest-junit` cannot resolve |
| Unfiltered TypeScript | **FAIL**: current raw 307 TS errors / 58 files; 4 are generated `.next/types`; source-only 303 |
| Baseline TypeScript at `704d5221` with same `node_modules` | **FAIL**: 304 source TS errors / 57 files |
| Lint | **FAIL**: broad existing errors plus inherited missing Testing Library rules; `Timeline.tsx:1859` `prefer-const` is present at baseline line 1804 |
| Build | PASS compile/static generation; explicitly **skips type validation and lint**, so not those gates |
| `git diff --check` | PASS |

## Test additions

- `web/src/components/timeline/__tests__/gantt-lifecycle-wiring.test.tsx`: 4 actual Timeline wiring regressions: selected saved source, explicit saved unassignment, single lifecycle controls, draft-local auto-sort. Result: 1 pass, 3 fail.
- `web/src/utils/__tests__/plan-lifecycle.test.ts`: 2 parser regressions: legacy camelCase adaptation and optional identity validation. Result: both fail.
- No product/config/dependency/backend/member/List/clone edits.

## Proven acceptance failures and repro

Command:

`cd web && npx jest --config jest.config.js --reporters=default --runInBand --silent src/components/timeline/__tests__/gantt-hierarchy.test.tsx src/components/timeline/__tests__/gantt-lifecycle-wiring.test.tsx src/utils/__tests__/gantt-rows.test.ts src/utils/__tests__/plan-lifecycle.test.ts src/utils/__tests__/member-daily-effort.test.ts src/utils/__tests__/task-allocations.test.ts`

1. **Saved dates do not fully own bar rendering.** Snapshot membership/title/order/hierarchy assertions pass, but saved Sep 7/8 segments disappear when current task dates moved to Oct. `Timeline.tsx:1177-1183` builds lifecycle `taskAllocations`, then render clipping at `Timeline.tsx:1813` reads prop `barsOverride` rather than `displayedBarsOverride`; it clips by current task dates. Repro: `uses saved membership, hierarchy, order, dates, and allocations instead of live fields` → no `task-day-segment`.
2. **Parallel lifecycle controls remain.** Timeline renders legacy plan selector/New/Save beside `PlanLifecycleBar`; test sees 2 plan selectors (and duplicated New path), violating one connected selector/pipeline. Repro: `exposes one plan selector/new/save lifecycle...` → expected 1, received 2.
3. **Draft auto-sort unavailable.** `Timeline.tsx:1386` rejects every non-live mode; clicking auto-sort in editable draft calls neither `reorderDraft` nor live API. Contract requires saved auto-sort to become draft-editable after Recalculate. Repro: `auto-sorts a draft locally...` → `reorderDraft` 0 calls.
4. **Legacy camelCase snapshots rejected.** `parsePlanSnapshot({tasks:[{taskId,startDate,endDate,...}]})` throws `plan_data has an unsupported snapshot shape`; only snake-case `task_id` activates legacy adapter. Repro added parser test.
5. **Optional snapshot identity metadata not validated.** v2 snapshot with numeric `assigneeResourceMemberId: 42` is accepted, contrary strict optional-ID validation. Repro added parser test.

Independent passing wiring check: explicitly null saved assignment did not charge current assignee in tested fixture and produced unresolved allocation diagnostic.

## What 35 producer tests do prove

- Parent/child labels and collapse in one mocked Timeline fixture; left/bar row hiding aligned.
- Explicit 8h+2h labels, no title fallback, weekend/zero/interruption gaps for direct/live `barsOverride` fixture.
- Pure sibling/root subtree/hidden-slot rejection and stable per-sibling priority ordering.
- Pure snapshot immutability/reorder/allocation, viewport-independent serializer, zero-capacity warning.
- Pure canonical zero/unlinked rows, direct parent+child conservation, phase exclusion, duplicate-task dedupe, unresolved assignments.

They do not prove persisted live reorder, keyboard/pointer DnD wiring, GraphQL failure rollback, hard reload, actual save/load/revision API, deployed UI, or DB state.

## Baseline attribution

- Default Jest baseline verified exactly: `git diff --exit-code 704d5221 -- web/jest.config.js web/package.json` → 0. Base `web/jest.config.js` configures `jest-junit`; base/current `package.json` does not contain it. Reporter override is documented and does not hide test failures.
- Baseline TypeScript used a disposable `git archive 704d5221 web` at `C:\gbase`, junctioned to this worktree's existing `web/node_modules`; no checkout/revert/install. It produced 304 errors in 57 source files. Current source produced 303 errors; exact source diagnostic set differs only by one **baseline-only** producer-test error: `src/components/timeline/__tests__/gantt-hierarchy.test.tsx(34,13) TS2339 Property 'title'...`. Therefore preserved Gantt product contracts and this tester's added tests introduce **no current source TS diagnostic**.
- Current raw additionally has four `.next/types` diagnostics generated by the successful build; baseline archive had no generated `.next`. Kept separately rather than falsely attributing generated state to source.

## Remaining acceptance / separate gates

- Actual DnD pointer + keyboard, filtered/context targets, one persistence call, conflict/network rollback, hard-reload order: unproven.
- Actual lifecycle GraphQL load/save/recalculate/revision immutability, stale sequencing/project switch: unproven.
- Matrix component states for leave precedence, 4h/10h/0h capacity, commitments, staleness, A+R/C and A/B, full-plan/offscreen conservation: mostly pure/code evidence only, not complete wiring evidence.
- Browser, persisted API/DB, release/rollback gates: intentionally not run per route.

## Commands/process cleanup

No server/process started. No install, package/config, backend, DB, deploy, commit, push, or nested agent. Disposable `C:\gbase` removed; junction removed. Build terminated normally. Targeted ESLint retry was stopped by `privacy-block.cjs` 5s timeout; full `npm run lint` completed and failed as recorded.

## Unresolved questions

- None. Remaining items are failed or unexecuted acceptance gates, not product decisions.

## Raw unfiltered TypeScript diagnostics — current preserved worktree

Command: `cd web && npx tsc --noEmit --pretty false`

```text
.next/types/app/api/graphql/route.ts(33,7): error TS2344: Type '{ __tag__: "GET"; __param_position__: "first"; __param_type__: { request: Request; } & Partial<ServerAdapterInitialContext>; }' does not satisfy the constraint 'ParamCheck<Request | NextRequest>'.
  Types of property '__param_type__' are incompatible.
    Type '{ request: Request; } & Partial<ServerAdapterInitialContext>' is not assignable to type 'Request | NextRequest'.
.next/types/app/api/graphql/route.ts(111,7): error TS2344: Type '{ __tag__: "OPTIONS"; __param_position__: "first"; __param_type__: { request: Request; } & Partial<ServerAdapterInitialContext>; }' does not satisfy the constraint 'ParamCheck<Request | NextRequest>'.
  Types of property '__param_type__' are incompatible.
    Type '{ request: Request; } & Partial<ServerAdapterInitialContext>' is not assignable to type 'Request | NextRequest'.
.next/types/app/api/graphql/route.ts(150,7): error TS2344: Type '{ __tag__: "POST"; __param_position__: "first"; __param_type__: { request: Request; } & Partial<ServerAdapterInitialContext>; }' does not satisfy the constraint 'ParamCheck<Request | NextRequest>'.
  Types of property '__param_type__' are incompatible.
    Type '{ request: Request; } & Partial<ServerAdapterInitialContext>' is not assignable to type 'Request | NextRequest'.
.next/types/app/projects/[id]/timesheet/page.ts(8,13): error TS2344: Type 'OmitWithTag<typeof import("C:/Users/TienVNV/Documents/prjmngr/worktrees/gm-20260907/web/src/app/projects/[id]/timesheet/page"), "default" | "metadata" | "config" | "generateStaticParams" | ... 9 more ... | "generateViewport", "">' does not satisfy the constraint '{ [x: string]: never; }'.
  Property 'validateHoursCell' is incompatible with index signature.
    Type '(raw: string) => { hours: number; } | { error: string; }' is not assignable to type 'never'.
src/app/api/auth/__tests__/session.test.ts(9,1): error TS2578: Unused '@ts-expect-error' directive.
src/app/api/auth/__tests__/session.test.ts(33,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/app/api/auth/_session.ts(55,22): error TS2802: Type 'Uint8Array<ArrayBufferLike>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
src/app/dashboard/page.tsx(17,65): error TS2339: Property 'role' does not exist on type 'User'.
src/app/dashboard/page.tsx(61,11): error TS2719: Type 'DashboardTask[]' is not assignable to type 'DashboardTask[]'. Two different types with this name exist, but they are unrelated.
  Type 'DashboardTask' is missing the following properties from type 'DashboardTask': type, assignee
src/app/dashboard/page.tsx(62,11): error TS2719: Type 'DashboardTask[]' is not assignable to type 'DashboardTask[]'. Two different types with this name exist, but they are unrelated.
  Type 'DashboardTask' is missing the following properties from type 'DashboardTask': type, assignee
src/app/dashboard/page.tsx(63,11): error TS2719: Type 'DashboardTask[]' is not assignable to type 'DashboardTask[]'. Two different types with this name exist, but they are unrelated.
  Type 'DashboardTask' is missing the following properties from type 'DashboardTask': type, assignee
src/app/dashboard/page.tsx(64,11): error TS2719: Type 'DashboardTask[]' is not assignable to type 'DashboardTask[]'. Two different types with this name exist, but they are unrelated.
  Type 'DashboardTask' is missing the following properties from type 'DashboardTask': type, assignee
src/app/dashboard/page.tsx(68,11): error TS2719: Type 'DashboardTask[]' is not assignable to type 'DashboardTask[]'. Two different types with this name exist, but they are unrelated.
  Type 'DashboardTask' is missing the following properties from type 'DashboardTask': type, assignee
src/app/dashboard/page.tsx(69,11): error TS2719: Type 'Record<string, DashboardTask[]>' is not assignable to type 'Record<string, DashboardTask[]>'. Two different types with this name exist, but they are unrelated.
  'string' index signatures are incompatible.
    Type 'DashboardTask[]' is not assignable to type 'DashboardTask[]'. Two different types with this name exist, but they are unrelated.
      Type 'DashboardTask' is missing the following properties from type 'DashboardTask': type, assignee
src/components/auth/LoginForm.tsx(14,11): error TS2339: Property 'signInWithEmail' does not exist on type 'AuthContextType'.
src/components/auth/LoginForm.tsx(14,28): error TS2339: Property 'signInWithGoogle' does not exist on type 'AuthContextType'.
src/components/auth/RegisterForm.tsx(13,11): error TS2339: Property 'signUpWithEmail' does not exist on type 'AuthContextType'.
src/components/comments/CommentForm.tsx(5,8): error TS2304: Cannot find name 'content'.
src/components/comments/CommentForm.tsx(7,3): error TS2304: Cannot find name 'setSubmitting'.
src/components/comments/CommentForm.tsx(11,28): error TS2304: Cannot find name 'content'.
src/components/comments/CommentForm.tsx(12,9): error TS2304: Cannot find name 'content'.
src/components/comments/CommentForm.tsx(13,64): error TS2304: Cannot find name 'content'.
src/components/comments/CommentForm.tsx(17,9): error TS2552: Cannot find name 'onSubmit'. Did you mean 'onsubmit'?
src/components/comments/CommentForm.tsx(18,13): error TS2552: Cannot find name 'onSubmit'. Did you mean 'onsubmit'?
src/components/comments/CommentForm.tsx(22,10): error TS2304: Cannot find name 'isEdit'.
src/components/comments/CommentForm.tsx(23,7): error TS2304: Cannot find name 'setContent'.
src/components/comments/CommentForm.tsx(28,5): error TS2304: Cannot find name 'setSubmitting'.
src/components/common/TaskForm.tsx(5,3): error TS2304: Cannot find name 'setSubmitting'.
src/components/common/TaskForm.tsx(9,30): error TS2304: Cannot find name 'taskFormSchema'.
src/components/common/TaskForm.tsx(9,55): error TS2304: Cannot find name 'formState'.
src/components/common/TaskForm.tsx(13,7): error TS2304: Cannot find name 'setFormErrors'.
src/components/common/TaskForm.tsx(18,32): error TS2304: Cannot find name 'formState'.
src/components/common/TaskForm.tsx(19,9): error TS2304: Cannot find name 'formState'.
src/components/common/TaskForm.tsx(19,34): error TS2304: Cannot find name 'formState'.
src/components/common/TaskForm.tsx(20,68): error TS2304: Cannot find name 'formState'.
src/components/common/TaskForm.tsx(25,10): error TS2304: Cannot find name 'formState'.
src/components/common/TaskForm.tsx(30,9): error TS2304: Cannot find name 'onSave'.
src/components/common/TaskForm.tsx(31,13): error TS2304: Cannot find name 'onSave'.
src/components/common/TaskForm.tsx(35,9): error TS2304: Cannot find name 'resetOnSubmit'.
src/components/common/TaskForm.tsx(36,7): error TS2304: Cannot find name 'setFormState'.
src/components/common/TaskForm.tsx(36,20): error TS2304: Cannot find name 'initialState'.
src/components/common/TaskForm.tsx(39,5): error TS2304: Cannot find name 'setSubmitting'.
src/components/common/TaskForm.tsx(42,5): error TS2304: Cannot find name 'setSubmitting'.
src/components/common/UserMenu.tsx(25,11): error TS2322: Type '{ src: string | null; alt: string; size: "sm"; }' is not assignable to type 'IntrinsicAttributes & UserAvatarProps'.
  Property 'src' does not exist on type 'IntrinsicAttributes & UserAvatarProps'.
src/components/common/UserSelect.tsx(82,23): error TS2322: Type '{ src: string | null | undefined; alt: string; size: "sm"; className: string; }' is not assignable to type 'IntrinsicAttributes & UserAvatarProps'.
  Property 'src' does not exist on type 'IntrinsicAttributes & UserAvatarProps'.
src/components/common/UserTag.tsx(31,9): error TS2322: Type '{ src: string | null | undefined; alt: string; size: "sm"; className: string; }' is not assignable to type 'IntrinsicAttributes & UserAvatarProps'.
  Property 'src' does not exist on type 'IntrinsicAttributes & UserAvatarProps'.
src/components/dashboard/__tests__/UserDashboard.test.tsx(25,13): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/dashboard/__tests__/UserDashboard.test.tsx(26,15): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/dashboard/__tests__/UserDashboard.test.tsx(46,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/dashboard/__tests__/UserDashboard.test.tsx(61,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/dashboard/__tests__/UserDashboard.test.tsx(62,9): error TS2322: Type '{ totalTasks: number; completedTasks: number; urgentTasks: number; upcomingDeadlines: number; averageCompletionTime: number; tasksByStatus: { [x: string]: number; [x: number]: number; }; }' is not assignable to type 'DashboardStats'.
  Types of property 'tasksByStatus' are incompatible.
    Type '{ [x: string]: number; [x: number]: number; }' is missing the following properties from type 'Record<TaskStatus, number>': TODO, DOING, DONE, CLOSE, and 5 more.
src/components/dashboard/__tests__/UserDashboard.test.tsx(77,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/dashboard/__tests__/UserDashboard.test.tsx(78,9): error TS2322: Type '{ totalTasks: number; completedTasks: number; urgentTasks: number; upcomingDeadlines: number; averageCompletionTime: number; tasksByStatus: { [x: string]: number; [x: number]: number; }; }' is not assignable to type 'DashboardStats'.
  Types of property 'tasksByStatus' are incompatible.
    Type '{ [x: string]: number; [x: number]: number; }' is missing the following properties from type 'Record<TaskStatus, number>': TODO, DOING, DONE, CLOSE, and 5 more.
src/components/dashboard/__tests__/UserDashboard.test.tsx(92,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/dashboard/__tests__/UserDashboard.test.tsx(93,9): error TS2322: Type '{ totalTasks: number; completedTasks: number; urgentTasks: number; upcomingDeadlines: number; averageCompletionTime: number; tasksByStatus: { [x: string]: number; [x: number]: number; }; }' is not assignable to type 'DashboardStats'.
  Types of property 'tasksByStatus' are incompatible.
    Type '{ [x: string]: number; [x: number]: number; }' is missing the following properties from type 'Record<TaskStatus, number>': TODO, DOING, DONE, CLOSE, and 5 more.
src/components/dashboard/__tests__/UserDashboard.test.tsx(106,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/dashboard/__tests__/UserDashboard.test.tsx(107,9): error TS2322: Type '{ totalTasks: number; completedTasks: number; urgentTasks: number; upcomingDeadlines: number; averageCompletionTime: number; tasksByStatus: { [x: string]: number; [x: number]: number; }; }' is not assignable to type 'DashboardStats'.
  Types of property 'tasksByStatus' are incompatible.
    Type '{ [x: string]: number; [x: number]: number; }' is missing the following properties from type 'Record<TaskStatus, number>': TODO, DOING, DONE, CLOSE, and 5 more.
src/components/dashboard/__tests__/UserDashboard.test.tsx(120,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/dashboard/__tests__/UserDashboard.test.tsx(121,9): error TS2322: Type '{ totalTasks: number; completedTasks: number; urgentTasks: number; upcomingDeadlines: number; averageCompletionTime: number; tasksByStatus: { [x: string]: number; [x: number]: number; }; }' is not assignable to type 'DashboardStats'.
  Types of property 'tasksByStatus' are incompatible.
    Type '{ [x: string]: number; [x: number]: number; }' is missing the following properties from type 'Record<TaskStatus, number>': TODO, DOING, DONE, CLOSE, and 5 more.
src/components/dashboard/__tests__/UserDashboard.test.tsx(134,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/dashboard/__tests__/UserDashboard.test.tsx(135,9): error TS2322: Type '{ totalTasks: number; completedTasks: number; urgentTasks: number; upcomingDeadlines: number; averageCompletionTime: number; tasksByStatus: { [x: string]: number; [x: number]: number; }; }' is not assignable to type 'DashboardStats'.
  Types of property 'tasksByStatus' are incompatible.
    Type '{ [x: string]: number; [x: number]: number; }' is missing the following properties from type 'Record<TaskStatus, number>': TODO, DOING, DONE, CLOSE, and 5 more.
src/components/dashboard/__tests__/UserDashboard.test.tsx(148,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/dashboard/__tests__/UserDashboard.test.tsx(149,9): error TS2322: Type '{ totalTasks: number; completedTasks: number; urgentTasks: number; upcomingDeadlines: number; averageCompletionTime: number; tasksByStatus: { [x: string]: number; [x: number]: number; }; }' is not assignable to type 'DashboardStats'.
  Types of property 'tasksByStatus' are incompatible.
    Type '{ [x: string]: number; [x: number]: number; }' is missing the following properties from type 'Record<TaskStatus, number>': TODO, DOING, DONE, CLOSE, and 5 more.
src/components/dashboard/__tests__/UserDashboard.test.tsx(161,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/dashboard/__tests__/UserDashboard.test.tsx(162,9): error TS2322: Type '{ totalTasks: number; completedTasks: number; urgentTasks: number; upcomingDeadlines: number; averageCompletionTime: number; tasksByStatus: { [x: string]: number; [x: number]: number; }; }' is not assignable to type 'DashboardStats'.
  Types of property 'tasksByStatus' are incompatible.
    Type '{ [x: string]: number; [x: number]: number; }' is missing the following properties from type 'Record<TaskStatus, number>': TODO, DOING, DONE, CLOSE, and 5 more.
src/components/dashboard/__tests__/UserDashboard.test.tsx(176,9): error TS2322: Type '{ totalTasks: number; completedTasks: number; urgentTasks: number; upcomingDeadlines: number; averageCompletionTime: number; tasksByStatus: { [x: string]: number; [x: number]: number; }; }' is not assignable to type 'DashboardStats'.
  Types of property 'tasksByStatus' are incompatible.
    Type '{ [x: string]: number; [x: number]: number; }' is missing the following properties from type 'Record<TaskStatus, number>': TODO, DOING, DONE, CLOSE, and 5 more.
src/components/project/TasksTab.tsx(51,46): error TS2551: Property 'taskId' does not exist on type 'Task'. Did you mean 'task_id'?
src/components/project/TasksTab.tsx(85,46): error TS2551: Property 'dueDate' does not exist on type 'Task'. Did you mean 'due_date'?
src/components/project/TasksTab.tsx(93,47): error TS2339: Property 'fullName' does not exist on type 'UserBasic'.
src/components/rich-text-editor/ImageHandler.ts(137,7): error TS2322: Type 'ParentNode | null' is not assignable to type 'Node'.
  Type 'null' is not assignable to type 'Node'.
src/components/rich-text-editor/TableHandler.ts(118,7): error TS2531: Object is possibly 'null'.
src/components/rich-text-editor/TableHandler.ts(185,18): error TS2339: Property 'title' does not exist on type 'Element'.
src/components/rich-text-editor/TableHandler.ts(191,28): error TS2345: Argument of type 'Event' is not assignable to parameter of type 'MouseEvent'.
  Type 'Event' is missing the following properties from type 'MouseEvent': altKey, button, buttons, clientX, and 23 more.
src/components/rich-text-editor/TableMenuHandler.ts(61,54): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/components/rich-text-editor/TableMenuHandler.ts(108,24): error TS2339: Property 'title' does not exist on type 'Element'.
src/components/rich-text-editor/TableMenuHandler.ts(128,30): error TS2339: Property 'title' does not exist on type 'Element'.
src/components/rich-text-editor/TableMenuHandler.ts(156,21): error TS18047: 'switchModeButton' is possibly 'null'.
src/components/rich-text-editor/TableMenuHandler.ts(157,21): error TS18047: 'switchModeButton' is possibly 'null'.
src/components/rich-text-editor/TableMenuHandler.ts(159,21): error TS18047: 'switchModeButton' is possibly 'null'.
src/components/rich-text-editor/TableMenuHandler.ts(160,21): error TS18047: 'switchModeButton' is possibly 'null'.
src/components/task/TaskFilters.tsx(63,26): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/task/TaskFilters.tsx(64,21): error TS2322: Type 'unknown' is not assignable to type 'Key | null | undefined'.
src/components/task/TaskFilters.tsx(64,34): error TS2322: Type 'unknown' is not assignable to type 'string | number | readonly string[] | undefined'.
src/components/task/TaskFilters.tsx(65,16): error TS18046: 'status' is of type 'unknown'.
src/components/task/TaskItem.tsx(38,30): error TS2551: Property 'LOW' does not exist on type '{ readonly high: "bg-red-100 text-red-800"; readonly medium: "bg-yellow-100 text-yellow-800"; readonly low: "bg-green-100 text-green-800"; }'. Did you mean 'low'?
src/components/task/TaskItem.tsx(51,27): error TS2769: No overload matches this call.
  Overload 1 of 4, '(value: string | number | Date): Date', gave the following error.
    Argument of type 'string | undefined' is not assignable to parameter of type 'string | number | Date'.
      Type 'undefined' is not assignable to type 'string | number | Date'.
  Overload 2 of 4, '(value: string | number): Date', gave the following error.
    Argument of type 'string | undefined' is not assignable to parameter of type 'string | number'.
      Type 'undefined' is not assignable to type 'string | number'.
src/components/task/TaskItem.tsx(55,15): error TS2322: Type 'UserBasic' is not assignable to type 'ReactI18NextChildren | Iterable<ReactI18NextChildren>'.
src/components/tasks/__tests__/SubtaskForm.test.tsx(16,11): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskForm.test.tsx(17,13): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskForm.test.tsx(53,9): error TS2739: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskForm.test.tsx(106,17): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskItem.test.tsx(10,11): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskItem.test.tsx(11,13): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskItem.test.tsx(39,9): error TS2739: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskItem.test.tsx(55,9): error TS2739: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskItem.test.tsx(69,9): error TS2739: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskItem.test.tsx(77,69): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskItem.test.tsx(83,9): error TS2739: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskItem.test.tsx(101,9): error TS2739: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskItem.test.tsx(118,9): error TS2739: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskItem.test.tsx(131,9): error TS2739: Type '{ status: any; id: string; title: string; description: string; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskItem.test.tsx(131,44): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskItem.test.tsx(145,9): error TS2739: Type '{ description: string; id: string; title: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskList.test.tsx(11,13): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskList.test.tsx(12,15): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskList.test.tsx(31,13): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskList.test.tsx(32,15): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskList.test.tsx(61,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskList.test.tsx(90,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskList.test.tsx(104,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskList.test.tsx(115,61): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskList.test.tsx(121,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskList.test.tsx(138,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskList.test.tsx(159,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskList.test.tsx(177,17): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskList.test.tsx(183,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskCard.test.tsx(9,11): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskCard.test.tsx(10,13): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskCard.test.tsx(37,9): error TS2739: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskCard.test.tsx(61,9): error TS2739: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskCard.test.tsx(74,9): error TS2739: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskCard.test.tsx(83,66): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskCard.test.tsx(94,9): error TS2739: Type '{ deadline: string; id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskCard.test.tsx(111,9): error TS2739: Type '{ deadline: string; id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskCard.test.tsx(131,9): error TS2739: Type '{ assignees: { id: string; name: string; email: string; }[]; id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskCard.test.tsx(144,9): error TS2739: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskCard.test.tsx(159,15): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskCard.test.tsx(160,17): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskCard.test.tsx(173,9): error TS2739: Type '{ id: string; title: string; status: any; priority: any; createdBy: { id: string; name: string; email: string; }; assignees: never[]; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskDetails.keyboard.test.tsx(7,8): error TS2307: Cannot find module '@/test-utils' or its corresponding type declarations.
src/components/tasks/__tests__/TaskForm.test.tsx(11,11): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskForm.test.tsx(12,13): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskForm.test.tsx(64,9): error TS2739: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskForm.test.tsx(110,69): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskForm.test.tsx(111,71): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskForm.test.tsx(128,17): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskForm.test.tsx(129,19): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskList.test.tsx(11,13): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskList.test.tsx(12,15): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskList.test.tsx(31,13): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskList.test.tsx(32,15): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskList.test.tsx(62,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskList.test.tsx(77,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskList.test.tsx(92,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskList.test.tsx(109,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskList.test.tsx(126,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskList.test.tsx(135,63): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskList.test.tsx(141,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskList.test.tsx(170,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskList.test.tsx(185,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/comments/CommentSection.tsx(11,10): error TS2459: Module '"@/contexts/AuthContext"' declares 'User' locally, but it is not exported.
src/components/tasks/details/TaskDetailsPanel.tsx(7,10): error TS2459: Module '"@/contexts/AuthContext"' declares 'User' locally, but it is not exported.
src/components/tasks/details/TaskDetailsPanel.tsx(481,21): error TS2339: Property 'creator' does not exist on type 'Task'.
src/components/tasks/details/TaskDetailsPanel.tsx(483,25): error TS2339: Property 'creator' does not exist on type 'Task'.
src/components/tasks/details/TaskDetailsPanel.tsx(485,33): error TS2339: Property 'creator' does not exist on type 'Task'.
src/components/tasks/details/TaskDetailsPanel.tsx(486,33): error TS2339: Property 'creator' does not exist on type 'Task'.
src/components/tasks/details/TaskDetailsPanel.tsx(491,29): error TS2339: Property 'creator' does not exist on type 'Task'.
src/components/tasks/details/TaskDetailsPanel.tsx(494,65): error TS2339: Property 'creator' does not exist on type 'Task'.
src/components/tasks/DroppableColumn.tsx(42,38): error TS2551: Property 'TODO' does not exist on type '{ todo: string; doing: string; pending: string; review: string; blocked: string; done: string; close: string; rejected: string; archived: string; }'. Did you mean 'todo'?
src/components/tasks/DroppableColumn.tsx(42,85): error TS2551: Property 'TODO' does not exist on type '{ todo: string; doing: string; pending: string; review: string; blocked: string; done: string; close: string; rejected: string; archived: string; }'. Did you mean 'todo'?
src/components/tasks/SubtaskForm.tsx(4,28): error TS2305: Module '"@/types/task"' has no exported member 'User'.
src/components/tasks/SubtaskForm.tsx(19,3): error TS2322: Type 'true' is not assignable to type 'never'.
src/components/tasks/SubtaskForm.tsx(20,3): error TS2322: Type 'true' is not assignable to type 'never'.
src/components/tasks/SubtaskForm.tsx(53,32): error TS2339: Property 'effortHours' does not exist on type 'Task'.
src/components/tasks/SubtaskForm.tsx(54,32): error TS2551: Property 'assignees' does not exist on type 'Task'. Did you mean 'assignee'?
src/components/tasks/SubtaskForm.tsx(54,46): error TS7006: Parameter 'a' implicitly has an 'any' type.
src/components/tasks/SubtaskForm.tsx(58,19): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskForm.tsx(67,17): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskItem.tsx(24,7): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/components/tasks/SubtaskItem.tsx(25,26): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskItem.tsx(25,44): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskItem.tsx(25,69): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskItem.tsx(35,14): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/components/tasks/SubtaskItem.tsx(48,32): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/components/tasks/SubtaskItem.tsx(52,30): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskItem.tsx(54,34): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskItem.tsx(67,36): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskItem.tsx(72,35): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskItem.tsx(105,20): error TS2339: Property 'effortHours' does not exist on type 'Task'.
src/components/tasks/SubtaskItem.tsx(105,50): error TS2339: Property 'effortHours' does not exist on type 'Task'.
src/components/tasks/SubtaskItem.tsx(106,20): error TS2551: Property 'assignees' does not exist on type 'Task'. Did you mean 'assignee'?
src/components/tasks/SubtaskItem.tsx(119,24): error TS2551: Property 'assignees' does not exist on type 'Task'. Did you mean 'assignee'?
src/components/tasks/SubtaskItem.tsx(119,38): error TS7006: Parameter 'assignee' implicitly has an 'any' type.
src/components/tasks/SubtaskList.tsx(24,71): error TS2339: Property 'effortHours' does not exist on type 'Task'.
src/components/tasks/SubtaskList.tsx(25,66): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskList.tsx(29,34): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskList.tsx(30,11): error TS2538: Type 'unknown' cannot be used as an index type.
src/components/tasks/SubtaskList.tsx(44,28): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskList.tsx(46,37): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/components/tasks/SubtaskList.tsx(54,28): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/components/tasks/SubtaskList.tsx(54,59): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskList.tsx(54,77): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskList.tsx(54,102): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskList.tsx(58,32): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskList.tsx(63,31): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskList.tsx(73,16): error TS2339: Property 'effortHours' does not exist on type 'Task'.
src/components/tasks/SubtaskList.tsx(75,28): error TS2339: Property 'effortHours' does not exist on type 'Task'.
src/components/tasks/tabs/CommentsTab.tsx(3,10): error TS2459: Module '"@/contexts/AuthContext"' declares 'User' locally, but it is not exported.
src/components/tasks/TaskDetail.tsx(4,10): error TS2459: Module '"../../contexts/AuthContext"' declares 'User' locally, but it is not exported.
src/components/tasks/TaskDetailPage.tsx(6,10): error TS2459: Module '"@/contexts/AuthContext"' declares 'User' locally, but it is not exported.
src/components/tasks/TaskDetailPage.tsx(925,15): error TS2561: Object literal may only specify known properties, but 'task_id' does not exist in type 'CreateCommentInput'. Did you mean to write 'taskId'?
src/components/tasks/TaskDetailPage.tsx(1038,15): error TS2561: Object literal may only specify known properties, but 'task_id' does not exist in type 'CreateCommentInput'. Did you mean to write 'taskId'?
src/components/tasks/TaskDetailPage/index.tsx(5,10): error TS2459: Module '"@/contexts/AuthContext"' declares 'User' locally, but it is not exported.
src/components/tasks/TaskDetailPage_backup.tsx(5,10): error TS2459: Module '"@/contexts/AuthContext"' declares 'User' locally, but it is not exported.
src/components/tasks/TaskDetailPage_backup/index.tsx(5,10): error TS2459: Module '"@/contexts/AuthContext"' declares 'User' locally, but it is not exported.
src/components/tasks/TaskDetails.tsx(158,56): error TS2322: Type 'string | UserBasic' is not assignable to type 'ReactI18NextChildren | Iterable<ReactI18NextChildren>'.
  Type 'UserBasic' is not assignable to type 'ReactI18NextChildren | Iterable<ReactI18NextChildren>'.
src/components/tasks/TaskFilterBar.tsx(3,10): error TS2459: Module '"../../contexts/AuthContext"' declares 'User' locally, but it is not exported.
src/components/tasks/TaskFilterModal.tsx(4,70): error TS2305: Module '"@/types/task"' has no exported member 'TaskAssignee'.
src/components/tasks/TaskForm.tsx(4,38): error TS2305: Module '"@/types/task"' has no exported member 'User'.
src/components/tasks/TaskForm.tsx(5,31): error TS2724: '"@/schemas/taskForm"' has no exported member named 'TaskFormSchema'. Did you mean 'taskFormSchema'?
src/components/tasks/TaskForm.tsx(55,29): error TS2339: Property 'effortHours' does not exist on type 'Task'.
src/components/tasks/TaskForm.tsx(56,27): error TS2551: Property 'startDate' does not exist on type 'Task'. Did you mean 'start_date'?
src/components/tasks/TaskForm.tsx(58,29): error TS2551: Property 'assignees' does not exist on type 'Task'. Did you mean 'assignee'?
src/components/tasks/TaskForm.tsx(58,43): error TS7006: Parameter 'a' implicitly has an 'any' type.
src/components/tasks/TaskForm.tsx(61,19): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskForm.tsx(62,21): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/TaskForm.tsx(132,28): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskForm.tsx(133,23): error TS2322: Type 'unknown' is not assignable to type 'Key | null | undefined'.
src/components/tasks/TaskForm.tsx(133,36): error TS2322: Type 'unknown' is not assignable to type 'string | number | readonly string[] | undefined'.
src/components/tasks/TaskForm.tsx(134,18): error TS18046: 'status' is of type 'unknown'.
src/components/tasks/TaskForm.tsx(157,28): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/TaskForm.tsx(158,23): error TS2322: Type 'unknown' is not assignable to type 'Key | null | undefined'.
src/components/tasks/TaskForm.tsx(158,38): error TS2322: Type 'unknown' is not assignable to type 'string | number | readonly string[] | undefined'.
src/components/tasks/TaskForm.tsx(159,17): error TS2322: Type 'unknown' is not assignable to type 'ReactI18NextChildren | Iterable<ReactI18NextChildren>'.
src/components/tasks/TaskList.tsx(19,9): error TS2740: Type '{ [x: number]: string; }' is missing the following properties from type 'Record<TaskStatus, string>': TODO, DOING, DONE, CLOSE, and 5 more.
src/components/tasks/TaskList.tsx(20,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(21,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(22,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(23,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(24,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(25,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(28,9): error TS2739: Type '{ [x: number]: string; }' is missing the following properties from type 'Record<Priority, string>': LOW, MEDIUM, HIGH, URGENT, CRITICAL
src/components/tasks/TaskList.tsx(29,6): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(30,6): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(31,6): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(32,6): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(55,11): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(55,26): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(61,28): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(64,14): error TS7053: Element implicitly has an 'any' type because expression of type 'any' can't be used to index type 'Record<Priority, string>'.
src/components/tasks/TaskList.tsx(130,5): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(131,5): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(132,5): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(133,5): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(134,5): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(135,5): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(138,9): error TS2740: Type '{ [x: number]: string; }' is missing the following properties from type 'Record<TaskStatus, string>': TODO, DOING, DONE, CLOSE, and 5 more.
src/components/tasks/TaskList.tsx(139,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(140,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(141,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(142,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(143,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(144,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(177,28): error TS7053: Element implicitly has an 'any' type because expression of type 'any' can't be used to index type 'Record<TaskStatus, string>'.
src/components/tasks/TaskListView.tsx(239,28): error TS2345: Argument of type '(member: ProjectMember) => void' is not assignable to parameter of type '(value: Member, index: number, array: Member[]) => void'.
  Types of parameters 'member' and 'value' are incompatible.
    Property 'joined_at' is missing in type 'Member' but required in type 'ProjectMember'.
src/components/tasks/TaskListView.tsx(240,40): error TS2551: Property 'userId' does not exist on type '{ user_id: string; email: string; username: string; full_name: string | null; avatar_url: string | null; }'. Did you mean 'user_id'?
src/components/tasks/TaskListView.tsx(241,43): error TS2551: Property 'userId' does not exist on type '{ user_id: string; email: string; username: string; full_name: string | null; avatar_url: string | null; }'. Did you mean 'user_id'?
src/components/tasks/TaskListView.tsx(242,33): error TS2551: Property 'userId' does not exist on type '{ user_id: string; email: string; username: string; full_name: string | null; avatar_url: string | null; }'. Did you mean 'user_id'?
src/components/tasks/TaskListView.tsx(243,59): error TS2551: Property 'fullName' does not exist on type '{ user_id: string; email: string; username: string; full_name: string | null; avatar_url: string | null; }'. Did you mean 'full_name'?
src/components/tasks/TaskListView.tsx(244,36): error TS2551: Property 'avatarUrl' does not exist on type '{ user_id: string; email: string; username: string; full_name: string | null; avatar_url: string | null; }'. Did you mean 'avatar_url'?
src/components/tasks/TaskListView.tsx(1224,43): error TS2322: Type 'string | null' is not assignable to type 'string | undefined'.
  Type 'null' is not assignable to type 'string | undefined'.
src/components/timeline/__tests__/increment1-modes.test.tsx(47,13): error TS2339: Property 'title' does not exist on type '{ task_id: string; }'.
src/components/ui/__tests__/Dialog.test.tsx(104,41): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string | undefined'.
  Type 'null' is not assignable to type 'string | undefined'.
src/components/ui/__tests__/Dialog.test.tsx(144,44): error TS2554: Expected 1 arguments, but got 2.
src/contexts/AuthContext.tsx(116,13): error TS2345: Argument of type '{ providerData: never[]; id: string; email: string; name: string; emailVerified?: boolean; }' is not assignable to parameter of type 'SetStateAction<User | null>'.
  Type '{ providerData: never[]; id: string; email: string; name: string; emailVerified?: boolean; }' is not assignable to type 'User'.
    Types of property 'emailVerified' are incompatible.
      Type 'boolean | undefined' is not assignable to type 'boolean'.
        Type 'undefined' is not assignable to type 'boolean'.
src/data/mockTasks.ts(1,38): error TS2305: Module '"@/types/task"' has no exported member 'User'.
src/data/mockTasks.ts(34,5): error TS2561: Object literal may only specify known properties, but 'priorityOrder' does not exist in type 'Task'. Did you mean to write 'priority_order'?
src/data/mockTasks.ts(84,5): error TS2561: Object literal may only specify known properties, but 'priorityOrder' does not exist in type 'Task'. Did you mean to write 'priority_order'?
src/data/mockTasks.ts(130,5): error TS2561: Object literal may only specify known properties, but 'priorityOrder' does not exist in type 'Task'. Did you mean to write 'priority_order'?
src/data/mockTasks.ts(145,5): error TS2561: Object literal may only specify known properties, but 'priorityOrder' does not exist in type 'Task'. Did you mean to write 'priority_order'?
src/graphql/index.ts(4,1): error TS2308: Module './queries/tasks' has already exported a member named 'GET_PROJECT_TASKS'. Consider explicitly re-exporting to resolve the ambiguity.
src/graphql/index.ts(10,1): error TS2308: Module './mutations/projectMembers' has already exported a member named 'REMOVE_PROJECT_MEMBER'. Consider explicitly re-exporting to resolve the ambiguity.
src/graphql/index.ts(10,1): error TS2308: Module './mutations/projectMembers' has already exported a member named 'UPDATE_PROJECT_MEMBER_ROLE'. Consider explicitly re-exporting to resolve the ambiguity.
src/hooks/use-sidebar-state.ts(32,60): error TS2802: Type 'Set<string>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
src/hooks/useCommonApi.ts(3,10): error TS2305: Module '"@/lib/api"' has no exported member 'API_BASE_URL'.
src/hooks/useProjectDetail.ts(4,10): error TS2305: Module '"@/types/task"' has no exported member 'TaskResponse'.
src/hooks/useTaskFilters.ts(41,43): error TS2551: Property 'assignees' does not exist on type 'Task'. Did you mean 'assignee'?
src/hooks/useTaskFilters.ts(41,58): error TS7006: Parameter 'a' implicitly has an 'any' type.
src/hooks/useTaskFilters.ts(50,28): error TS2769: No overload matches this call.
  Overload 1 of 4, '(value: string | number | Date): Date', gave the following error.
    Argument of type 'string | undefined' is not assignable to parameter of type 'string | number | Date'.
      Type 'undefined' is not assignable to type 'string | number | Date'.
  Overload 2 of 4, '(value: string | number): Date', gave the following error.
    Argument of type 'string | undefined' is not assignable to parameter of type 'string | number'.
      Type 'undefined' is not assignable to type 'string | number'.
src/hooks/useTaskFilters.ts(50,61): error TS2769: No overload matches this call.
  Overload 1 of 4, '(value: string | number | Date): Date', gave the following error.
    Argument of type 'string | undefined' is not assignable to parameter of type 'string | number | Date'.
      Type 'undefined' is not assignable to type 'string | number | Date'.
  Overload 2 of 4, '(value: string | number): Date', gave the following error.
    Argument of type 'string | undefined' is not assignable to parameter of type 'string | number'.
      Type 'undefined' is not assignable to type 'string | number'.
src/hooks/useTaskFilters.ts(54,34): error TS2551: Property 'LOW' does not exist on type '{ high: number; medium: number; low: number; }'. Did you mean 'low'?
src/hooks/useTaskFilters.ts(54,63): error TS2551: Property 'LOW' does not exist on type '{ high: number; medium: number; low: number; }'. Did you mean 'low'?
src/hooks/useTaskFilters.ts(83,19): error TS2352: Conversion of type '{ high: number; medium: number; low: number; }' to type 'Record<Priority, number>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
  Type '{ high: number; medium: number; low: number; }' is missing the following properties from type 'Record<Priority, number>': LOW, MEDIUM, HIGH, URGENT, CRITICAL
src/lib/__tests__/utils.test.ts(2,3): error TS2724: '"../utils"' has no exported member named 'formatDate'. Did you mean 'formatDateVN'?
src/lib/__tests__/utils.test.ts(4,3): error TS2305: Module '"../utils"' has no exported member 'generateId'.
src/lib/__tests__/utils.test.ts(5,3): error TS2305: Module '"../utils"' has no exported member 'truncateText'.
src/lib/__tests__/utils.test.ts(6,3): error TS2305: Module '"../utils"' has no exported member 'calculateTimeLeft'.
src/lib/__tests__/utils.test.ts(7,3): error TS2305: Module '"../utils"' has no exported member 'isOverdue'.
src/lib/__tests__/utils.test.ts(8,3): error TS2305: Module '"../utils"' has no exported member 'isNearDeadline'.
src/lib/__tests__/utils.test.ts(9,3): error TS2305: Module '"../utils"' has no exported member 'getInitials'.
src/lib/graphql/resolvers/project.ts(51,9): error TS2698: Spread types may only be created from object types.
src/lib/graphql/resolvers/project.ts(52,9): error TS2698: Spread types may only be created from object types.
src/lib/graphql/resolvers/project.ts(53,9): error TS2698: Spread types may only be created from object types.
src/lib/graphql/resolvers/project.ts(78,9): error TS2698: Spread types may only be created from object types.
src/lib/graphql/resolvers/task.ts(31,9): error TS2698: Spread types may only be created from object types.
src/lib/graphql/resolvers/task.ts(32,9): error TS2698: Spread types may only be created from object types.
src/lib/graphql/resolvers/task.ts(33,9): error TS2698: Spread types may only be created from object types.
src/lib/graphql/resolvers/task.ts(44,9): error TS2698: Spread types may only be created from object types.
src/lib/graphql/resolvers/task.ts(45,9): error TS2698: Spread types may only be created from object types.
src/lib/graphql/resolvers/task.ts(46,9): error TS2698: Spread types may only be created from object types.
src/lib/scheduler.ts(18,23): error TS2551: Property 'priorityOrder' does not exist on type 'Task'. Did you mean 'priority_order'?
src/lib/scheduler.ts(18,41): error TS2551: Property 'priorityOrder' does not exist on type 'Task'. Did you mean 'priority_order'?
src/lib/scheduler.ts(20,36): error TS2339: Property 'effortHours' does not exist on type 'Task'.
src/lib/scheduler.ts(21,26): error TS2551: Property 'startDate' does not exist on type 'Task'. Did you mean 'start_date'?
src/lib/scheduler.ts(21,52): error TS2551: Property 'startDate' does not exist on type 'Task'. Did you mean 'start_date'?
src/lib/testUtils.ts(1,10): error TS2305: Module '"@/types/task"' has no exported member 'CreateTaskInput'.
src/lib/testUtils.ts(1,27): error TS2305: Module '"@/types/task"' has no exported member 'TaskDiagnosticResponse'.
```

## Raw unfiltered TypeScript diagnostics — baseline 704d5221

Command: disposable archived `704d5221:web` + same existing `web/node_modules`; `npx tsc --noEmit --pretty false`

```text
src/app/api/auth/__tests__/session.test.ts(9,1): error TS2578: Unused '@ts-expect-error' directive.
src/app/api/auth/__tests__/session.test.ts(33,17): error TS2540: Cannot assign to 'NODE_ENV' because it is a read-only property.
src/app/api/auth/_session.ts(55,22): error TS2802: Type 'Uint8Array<ArrayBufferLike>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
src/app/dashboard/page.tsx(17,65): error TS2339: Property 'role' does not exist on type 'User'.
src/app/dashboard/page.tsx(61,11): error TS2719: Type 'DashboardTask[]' is not assignable to type 'DashboardTask[]'. Two different types with this name exist, but they are unrelated.
  Type 'DashboardTask' is missing the following properties from type 'DashboardTask': type, assignee
src/app/dashboard/page.tsx(62,11): error TS2719: Type 'DashboardTask[]' is not assignable to type 'DashboardTask[]'. Two different types with this name exist, but they are unrelated.
  Type 'DashboardTask' is missing the following properties from type 'DashboardTask': type, assignee
src/app/dashboard/page.tsx(63,11): error TS2719: Type 'DashboardTask[]' is not assignable to type 'DashboardTask[]'. Two different types with this name exist, but they are unrelated.
  Type 'DashboardTask' is missing the following properties from type 'DashboardTask': type, assignee
src/app/dashboard/page.tsx(64,11): error TS2719: Type 'DashboardTask[]' is not assignable to type 'DashboardTask[]'. Two different types with this name exist, but they are unrelated.
  Type 'DashboardTask' is missing the following properties from type 'DashboardTask': type, assignee
src/app/dashboard/page.tsx(68,11): error TS2719: Type 'DashboardTask[]' is not assignable to type 'DashboardTask[]'. Two different types with this name exist, but they are unrelated.
  Type 'DashboardTask' is missing the following properties from type 'DashboardTask': type, assignee
src/app/dashboard/page.tsx(69,11): error TS2719: Type 'Record<string, DashboardTask[]>' is not assignable to type 'Record<string, DashboardTask[]>'. Two different types with this name exist, but they are unrelated.
  'string' index signatures are incompatible.
    Type 'DashboardTask[]' is not assignable to type 'DashboardTask[]'. Two different types with this name exist, but they are unrelated.
      Type 'DashboardTask' is missing the following properties from type 'DashboardTask': type, assignee
src/components/auth/LoginForm.tsx(14,11): error TS2339: Property 'signInWithEmail' does not exist on type 'AuthContextType'.
src/components/auth/LoginForm.tsx(14,28): error TS2339: Property 'signInWithGoogle' does not exist on type 'AuthContextType'.
src/components/auth/RegisterForm.tsx(13,11): error TS2339: Property 'signUpWithEmail' does not exist on type 'AuthContextType'.
src/components/comments/CommentForm.tsx(5,8): error TS2304: Cannot find name 'content'.
src/components/comments/CommentForm.tsx(7,3): error TS2304: Cannot find name 'setSubmitting'.
src/components/comments/CommentForm.tsx(11,28): error TS2304: Cannot find name 'content'.
src/components/comments/CommentForm.tsx(12,9): error TS2304: Cannot find name 'content'.
src/components/comments/CommentForm.tsx(13,64): error TS2304: Cannot find name 'content'.
src/components/comments/CommentForm.tsx(17,9): error TS2552: Cannot find name 'onSubmit'. Did you mean 'onsubmit'?
src/components/comments/CommentForm.tsx(18,13): error TS2552: Cannot find name 'onSubmit'. Did you mean 'onsubmit'?
src/components/comments/CommentForm.tsx(22,10): error TS2304: Cannot find name 'isEdit'.
src/components/comments/CommentForm.tsx(23,7): error TS2304: Cannot find name 'setContent'.
src/components/comments/CommentForm.tsx(28,5): error TS2304: Cannot find name 'setSubmitting'.
src/components/common/TaskForm.tsx(5,3): error TS2304: Cannot find name 'setSubmitting'.
src/components/common/TaskForm.tsx(9,30): error TS2304: Cannot find name 'taskFormSchema'.
src/components/common/TaskForm.tsx(9,55): error TS2304: Cannot find name 'formState'.
src/components/common/TaskForm.tsx(13,7): error TS2304: Cannot find name 'setFormErrors'.
src/components/common/TaskForm.tsx(18,32): error TS2304: Cannot find name 'formState'.
src/components/common/TaskForm.tsx(19,9): error TS2304: Cannot find name 'formState'.
src/components/common/TaskForm.tsx(19,34): error TS2304: Cannot find name 'formState'.
src/components/common/TaskForm.tsx(20,68): error TS2304: Cannot find name 'formState'.
src/components/common/TaskForm.tsx(25,10): error TS2304: Cannot find name 'formState'.
src/components/common/TaskForm.tsx(30,9): error TS2304: Cannot find name 'onSave'.
src/components/common/TaskForm.tsx(31,13): error TS2304: Cannot find name 'onSave'.
src/components/common/TaskForm.tsx(35,9): error TS2304: Cannot find name 'resetOnSubmit'.
src/components/common/TaskForm.tsx(36,7): error TS2304: Cannot find name 'setFormState'.
src/components/common/TaskForm.tsx(36,20): error TS2304: Cannot find name 'initialState'.
src/components/common/TaskForm.tsx(39,5): error TS2304: Cannot find name 'setSubmitting'.
src/components/common/TaskForm.tsx(42,5): error TS2304: Cannot find name 'setSubmitting'.
src/components/common/UserMenu.tsx(25,11): error TS2322: Type '{ src: string | null; alt: string; size: "sm"; }' is not assignable to type 'IntrinsicAttributes & UserAvatarProps'.
  Property 'src' does not exist on type 'IntrinsicAttributes & UserAvatarProps'.
src/components/common/UserSelect.tsx(82,23): error TS2322: Type '{ src: string | null | undefined; alt: string; size: "sm"; className: string; }' is not assignable to type 'IntrinsicAttributes & UserAvatarProps'.
  Property 'src' does not exist on type 'IntrinsicAttributes & UserAvatarProps'.
src/components/common/UserTag.tsx(31,9): error TS2322: Type '{ src: string | null | undefined; alt: string; size: "sm"; className: string; }' is not assignable to type 'IntrinsicAttributes & UserAvatarProps'.
  Property 'src' does not exist on type 'IntrinsicAttributes & UserAvatarProps'.
src/components/dashboard/__tests__/UserDashboard.test.tsx(25,13): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/dashboard/__tests__/UserDashboard.test.tsx(26,15): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/dashboard/__tests__/UserDashboard.test.tsx(46,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/dashboard/__tests__/UserDashboard.test.tsx(61,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/dashboard/__tests__/UserDashboard.test.tsx(62,9): error TS2322: Type '{ totalTasks: number; completedTasks: number; urgentTasks: number; upcomingDeadlines: number; averageCompletionTime: number; tasksByStatus: { [x: string]: number; [x: number]: number; }; }' is not assignable to type 'DashboardStats'.
  Types of property 'tasksByStatus' are incompatible.
    Type '{ [x: string]: number; [x: number]: number; }' is missing the following properties from type 'Record<TaskStatus, number>': TODO, DOING, DONE, CLOSE, and 5 more.
src/components/dashboard/__tests__/UserDashboard.test.tsx(77,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/dashboard/__tests__/UserDashboard.test.tsx(78,9): error TS2322: Type '{ totalTasks: number; completedTasks: number; urgentTasks: number; upcomingDeadlines: number; averageCompletionTime: number; tasksByStatus: { [x: string]: number; [x: number]: number; }; }' is not assignable to type 'DashboardStats'.
  Types of property 'tasksByStatus' are incompatible.
    Type '{ [x: string]: number; [x: number]: number; }' is missing the following properties from type 'Record<TaskStatus, number>': TODO, DOING, DONE, CLOSE, and 5 more.
src/components/dashboard/__tests__/UserDashboard.test.tsx(92,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/dashboard/__tests__/UserDashboard.test.tsx(93,9): error TS2322: Type '{ totalTasks: number; completedTasks: number; urgentTasks: number; upcomingDeadlines: number; averageCompletionTime: number; tasksByStatus: { [x: string]: number; [x: number]: number; }; }' is not assignable to type 'DashboardStats'.
  Types of property 'tasksByStatus' are incompatible.
    Type '{ [x: string]: number; [x: number]: number; }' is missing the following properties from type 'Record<TaskStatus, number>': TODO, DOING, DONE, CLOSE, and 5 more.
src/components/dashboard/__tests__/UserDashboard.test.tsx(106,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/dashboard/__tests__/UserDashboard.test.tsx(107,9): error TS2322: Type '{ totalTasks: number; completedTasks: number; urgentTasks: number; upcomingDeadlines: number; averageCompletionTime: number; tasksByStatus: { [x: string]: number; [x: number]: number; }; }' is not assignable to type 'DashboardStats'.
  Types of property 'tasksByStatus' are incompatible.
    Type '{ [x: string]: number; [x: number]: number; }' is missing the following properties from type 'Record<TaskStatus, number>': TODO, DOING, DONE, CLOSE, and 5 more.
src/components/dashboard/__tests__/UserDashboard.test.tsx(120,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/dashboard/__tests__/UserDashboard.test.tsx(121,9): error TS2322: Type '{ totalTasks: number; completedTasks: number; urgentTasks: number; upcomingDeadlines: number; averageCompletionTime: number; tasksByStatus: { [x: string]: number; [x: number]: number; }; }' is not assignable to type 'DashboardStats'.
  Types of property 'tasksByStatus' are incompatible.
    Type '{ [x: string]: number; [x: number]: number; }' is missing the following properties from type 'Record<TaskStatus, number>': TODO, DOING, DONE, CLOSE, and 5 more.
src/components/dashboard/__tests__/UserDashboard.test.tsx(134,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/dashboard/__tests__/UserDashboard.test.tsx(135,9): error TS2322: Type '{ totalTasks: number; completedTasks: number; urgentTasks: number; upcomingDeadlines: number; averageCompletionTime: number; tasksByStatus: { [x: string]: number; [x: number]: number; }; }' is not assignable to type 'DashboardStats'.
  Types of property 'tasksByStatus' are incompatible.
    Type '{ [x: string]: number; [x: number]: number; }' is missing the following properties from type 'Record<TaskStatus, number>': TODO, DOING, DONE, CLOSE, and 5 more.
src/components/dashboard/__tests__/UserDashboard.test.tsx(148,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/dashboard/__tests__/UserDashboard.test.tsx(149,9): error TS2322: Type '{ totalTasks: number; completedTasks: number; urgentTasks: number; upcomingDeadlines: number; averageCompletionTime: number; tasksByStatus: { [x: string]: number; [x: number]: number; }; }' is not assignable to type 'DashboardStats'.
  Types of property 'tasksByStatus' are incompatible.
    Type '{ [x: string]: number; [x: number]: number; }' is missing the following properties from type 'Record<TaskStatus, number>': TODO, DOING, DONE, CLOSE, and 5 more.
src/components/dashboard/__tests__/UserDashboard.test.tsx(161,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/dashboard/__tests__/UserDashboard.test.tsx(162,9): error TS2322: Type '{ totalTasks: number; completedTasks: number; urgentTasks: number; upcomingDeadlines: number; averageCompletionTime: number; tasksByStatus: { [x: string]: number; [x: number]: number; }; }' is not assignable to type 'DashboardStats'.
  Types of property 'tasksByStatus' are incompatible.
    Type '{ [x: string]: number; [x: number]: number; }' is missing the following properties from type 'Record<TaskStatus, number>': TODO, DOING, DONE, CLOSE, and 5 more.
src/components/dashboard/__tests__/UserDashboard.test.tsx(176,9): error TS2322: Type '{ totalTasks: number; completedTasks: number; urgentTasks: number; upcomingDeadlines: number; averageCompletionTime: number; tasksByStatus: { [x: string]: number; [x: number]: number; }; }' is not assignable to type 'DashboardStats'.
  Types of property 'tasksByStatus' are incompatible.
    Type '{ [x: string]: number; [x: number]: number; }' is missing the following properties from type 'Record<TaskStatus, number>': TODO, DOING, DONE, CLOSE, and 5 more.
src/components/project/TasksTab.tsx(51,46): error TS2551: Property 'taskId' does not exist on type 'Task'. Did you mean 'task_id'?
src/components/project/TasksTab.tsx(85,46): error TS2551: Property 'dueDate' does not exist on type 'Task'. Did you mean 'due_date'?
src/components/project/TasksTab.tsx(93,47): error TS2339: Property 'fullName' does not exist on type 'UserBasic'.
src/components/rich-text-editor/ImageHandler.ts(137,7): error TS2322: Type 'ParentNode | null' is not assignable to type 'Node'.
  Type 'null' is not assignable to type 'Node'.
src/components/rich-text-editor/TableHandler.ts(118,7): error TS2531: Object is possibly 'null'.
src/components/rich-text-editor/TableHandler.ts(185,18): error TS2339: Property 'title' does not exist on type 'Element'.
src/components/rich-text-editor/TableHandler.ts(191,28): error TS2345: Argument of type 'Event' is not assignable to parameter of type 'MouseEvent'.
  Type 'Event' is missing the following properties from type 'MouseEvent': altKey, button, buttons, clientX, and 23 more.
src/components/rich-text-editor/TableMenuHandler.ts(61,54): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/components/rich-text-editor/TableMenuHandler.ts(108,24): error TS2339: Property 'title' does not exist on type 'Element'.
src/components/rich-text-editor/TableMenuHandler.ts(128,30): error TS2339: Property 'title' does not exist on type 'Element'.
src/components/rich-text-editor/TableMenuHandler.ts(156,21): error TS18047: 'switchModeButton' is possibly 'null'.
src/components/rich-text-editor/TableMenuHandler.ts(157,21): error TS18047: 'switchModeButton' is possibly 'null'.
src/components/rich-text-editor/TableMenuHandler.ts(159,21): error TS18047: 'switchModeButton' is possibly 'null'.
src/components/rich-text-editor/TableMenuHandler.ts(160,21): error TS18047: 'switchModeButton' is possibly 'null'.
src/components/task/TaskFilters.tsx(63,26): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/task/TaskFilters.tsx(64,21): error TS2322: Type 'unknown' is not assignable to type 'Key | null | undefined'.
src/components/task/TaskFilters.tsx(64,34): error TS2322: Type 'unknown' is not assignable to type 'string | number | readonly string[] | undefined'.
src/components/task/TaskFilters.tsx(65,16): error TS18046: 'status' is of type 'unknown'.
src/components/task/TaskItem.tsx(38,30): error TS2551: Property 'LOW' does not exist on type '{ readonly high: "bg-red-100 text-red-800"; readonly medium: "bg-yellow-100 text-yellow-800"; readonly low: "bg-green-100 text-green-800"; }'. Did you mean 'low'?
src/components/task/TaskItem.tsx(51,27): error TS2769: No overload matches this call.
  Overload 1 of 4, '(value: string | number | Date): Date', gave the following error.
    Argument of type 'string | undefined' is not assignable to parameter of type 'string | number | Date'.
      Type 'undefined' is not assignable to type 'string | number | Date'.
  Overload 2 of 4, '(value: string | number): Date', gave the following error.
    Argument of type 'string | undefined' is not assignable to parameter of type 'string | number'.
      Type 'undefined' is not assignable to type 'string | number'.
src/components/task/TaskItem.tsx(55,15): error TS2322: Type 'UserBasic' is not assignable to type 'ReactI18NextChildren | Iterable<ReactI18NextChildren>'.
src/components/tasks/__tests__/SubtaskForm.test.tsx(16,11): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskForm.test.tsx(17,13): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskForm.test.tsx(53,9): error TS2739: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskForm.test.tsx(106,17): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskItem.test.tsx(10,11): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskItem.test.tsx(11,13): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskItem.test.tsx(39,9): error TS2739: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskItem.test.tsx(55,9): error TS2739: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskItem.test.tsx(69,9): error TS2739: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskItem.test.tsx(77,69): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskItem.test.tsx(83,9): error TS2739: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskItem.test.tsx(101,9): error TS2739: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskItem.test.tsx(118,9): error TS2739: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskItem.test.tsx(131,9): error TS2739: Type '{ status: any; id: string; title: string; description: string; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskItem.test.tsx(131,44): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskItem.test.tsx(145,9): error TS2739: Type '{ description: string; id: string; title: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskList.test.tsx(11,13): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskList.test.tsx(12,15): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskList.test.tsx(31,13): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskList.test.tsx(32,15): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskList.test.tsx(61,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskList.test.tsx(90,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskList.test.tsx(104,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskList.test.tsx(115,61): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskList.test.tsx(121,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskList.test.tsx(138,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskList.test.tsx(159,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/SubtaskList.test.tsx(177,17): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/SubtaskList.test.tsx(183,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskCard.test.tsx(9,11): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskCard.test.tsx(10,13): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskCard.test.tsx(37,9): error TS2739: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskCard.test.tsx(61,9): error TS2739: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskCard.test.tsx(74,9): error TS2739: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskCard.test.tsx(83,66): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskCard.test.tsx(94,9): error TS2739: Type '{ deadline: string; id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskCard.test.tsx(111,9): error TS2739: Type '{ deadline: string; id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskCard.test.tsx(131,9): error TS2739: Type '{ assignees: { id: string; name: string; email: string; }[]; id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskCard.test.tsx(144,9): error TS2739: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskCard.test.tsx(159,15): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskCard.test.tsx(160,17): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskCard.test.tsx(173,9): error TS2739: Type '{ id: string; title: string; status: any; priority: any; createdBy: { id: string; name: string; email: string; }; assignees: never[]; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskDetails.keyboard.test.tsx(7,8): error TS2307: Cannot find module '@/test-utils' or its corresponding type declarations.
src/components/tasks/__tests__/TaskForm.test.tsx(11,11): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskForm.test.tsx(12,13): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskForm.test.tsx(64,9): error TS2739: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskForm.test.tsx(110,69): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskForm.test.tsx(111,71): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskForm.test.tsx(128,17): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskForm.test.tsx(129,19): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskList.test.tsx(11,13): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskList.test.tsx(12,15): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskList.test.tsx(31,13): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskList.test.tsx(32,15): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskList.test.tsx(62,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskList.test.tsx(77,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskList.test.tsx(92,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskList.test.tsx(109,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskList.test.tsx(126,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskList.test.tsx(135,63): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/__tests__/TaskList.test.tsx(141,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskList.test.tsx(170,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/__tests__/TaskList.test.tsx(185,9): error TS2322: Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }[]' is not assignable to type 'Task[]'.
  Type '{ id: string; title: string; description: string; status: any; priority: any; effortHours: number; startDate: string; deadline: string; assignees: { id: string; name: string; email: string; }[]; createdBy: { ...; }; createdAt: string; updatedAt: string; }' is missing the following properties from type 'Task': task_id, project_id, priority_order, created_by
src/components/tasks/comments/CommentSection.tsx(11,10): error TS2459: Module '"@/contexts/AuthContext"' declares 'User' locally, but it is not exported.
src/components/tasks/details/TaskDetailsPanel.tsx(7,10): error TS2459: Module '"@/contexts/AuthContext"' declares 'User' locally, but it is not exported.
src/components/tasks/details/TaskDetailsPanel.tsx(481,21): error TS2339: Property 'creator' does not exist on type 'Task'.
src/components/tasks/details/TaskDetailsPanel.tsx(483,25): error TS2339: Property 'creator' does not exist on type 'Task'.
src/components/tasks/details/TaskDetailsPanel.tsx(485,33): error TS2339: Property 'creator' does not exist on type 'Task'.
src/components/tasks/details/TaskDetailsPanel.tsx(486,33): error TS2339: Property 'creator' does not exist on type 'Task'.
src/components/tasks/details/TaskDetailsPanel.tsx(491,29): error TS2339: Property 'creator' does not exist on type 'Task'.
src/components/tasks/details/TaskDetailsPanel.tsx(494,65): error TS2339: Property 'creator' does not exist on type 'Task'.
src/components/tasks/DroppableColumn.tsx(42,38): error TS2551: Property 'TODO' does not exist on type '{ todo: string; doing: string; pending: string; review: string; blocked: string; done: string; close: string; rejected: string; archived: string; }'. Did you mean 'todo'?
src/components/tasks/DroppableColumn.tsx(42,85): error TS2551: Property 'TODO' does not exist on type '{ todo: string; doing: string; pending: string; review: string; blocked: string; done: string; close: string; rejected: string; archived: string; }'. Did you mean 'todo'?
src/components/tasks/SubtaskForm.tsx(4,28): error TS2305: Module '"@/types/task"' has no exported member 'User'.
src/components/tasks/SubtaskForm.tsx(19,3): error TS2322: Type 'true' is not assignable to type 'never'.
src/components/tasks/SubtaskForm.tsx(20,3): error TS2322: Type 'true' is not assignable to type 'never'.
src/components/tasks/SubtaskForm.tsx(53,32): error TS2339: Property 'effortHours' does not exist on type 'Task'.
src/components/tasks/SubtaskForm.tsx(54,32): error TS2551: Property 'assignees' does not exist on type 'Task'. Did you mean 'assignee'?
src/components/tasks/SubtaskForm.tsx(54,46): error TS7006: Parameter 'a' implicitly has an 'any' type.
src/components/tasks/SubtaskForm.tsx(58,19): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskForm.tsx(67,17): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskItem.tsx(24,7): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/components/tasks/SubtaskItem.tsx(25,26): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskItem.tsx(25,44): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskItem.tsx(25,69): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskItem.tsx(35,14): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/components/tasks/SubtaskItem.tsx(48,32): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/components/tasks/SubtaskItem.tsx(52,30): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskItem.tsx(54,34): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskItem.tsx(67,36): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskItem.tsx(72,35): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskItem.tsx(105,20): error TS2339: Property 'effortHours' does not exist on type 'Task'.
src/components/tasks/SubtaskItem.tsx(105,50): error TS2339: Property 'effortHours' does not exist on type 'Task'.
src/components/tasks/SubtaskItem.tsx(106,20): error TS2551: Property 'assignees' does not exist on type 'Task'. Did you mean 'assignee'?
src/components/tasks/SubtaskItem.tsx(119,24): error TS2551: Property 'assignees' does not exist on type 'Task'. Did you mean 'assignee'?
src/components/tasks/SubtaskItem.tsx(119,38): error TS7006: Parameter 'assignee' implicitly has an 'any' type.
src/components/tasks/SubtaskList.tsx(24,71): error TS2339: Property 'effortHours' does not exist on type 'Task'.
src/components/tasks/SubtaskList.tsx(25,66): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskList.tsx(29,34): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskList.tsx(30,11): error TS2538: Type 'unknown' cannot be used as an index type.
src/components/tasks/SubtaskList.tsx(44,28): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskList.tsx(46,37): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/components/tasks/SubtaskList.tsx(54,28): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
src/components/tasks/SubtaskList.tsx(54,59): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskList.tsx(54,77): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskList.tsx(54,102): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskList.tsx(58,32): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskList.tsx(63,31): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/SubtaskList.tsx(73,16): error TS2339: Property 'effortHours' does not exist on type 'Task'.
src/components/tasks/SubtaskList.tsx(75,28): error TS2339: Property 'effortHours' does not exist on type 'Task'.
src/components/tasks/tabs/CommentsTab.tsx(3,10): error TS2459: Module '"@/contexts/AuthContext"' declares 'User' locally, but it is not exported.
src/components/tasks/TaskDetail.tsx(4,10): error TS2459: Module '"../../contexts/AuthContext"' declares 'User' locally, but it is not exported.
src/components/tasks/TaskDetailPage.tsx(6,10): error TS2459: Module '"@/contexts/AuthContext"' declares 'User' locally, but it is not exported.
src/components/tasks/TaskDetailPage.tsx(925,15): error TS2561: Object literal may only specify known properties, but 'task_id' does not exist in type 'CreateCommentInput'. Did you mean to write 'taskId'?
src/components/tasks/TaskDetailPage.tsx(1038,15): error TS2561: Object literal may only specify known properties, but 'task_id' does not exist in type 'CreateCommentInput'. Did you mean to write 'taskId'?
src/components/tasks/TaskDetailPage/index.tsx(5,10): error TS2459: Module '"@/contexts/AuthContext"' declares 'User' locally, but it is not exported.
src/components/tasks/TaskDetailPage_backup.tsx(5,10): error TS2459: Module '"@/contexts/AuthContext"' declares 'User' locally, but it is not exported.
src/components/tasks/TaskDetailPage_backup/index.tsx(5,10): error TS2459: Module '"@/contexts/AuthContext"' declares 'User' locally, but it is not exported.
src/components/tasks/TaskDetails.tsx(158,56): error TS2322: Type 'string | UserBasic' is not assignable to type 'ReactI18NextChildren | Iterable<ReactI18NextChildren>'.
  Type 'UserBasic' is not assignable to type 'ReactI18NextChildren | Iterable<ReactI18NextChildren>'.
src/components/tasks/TaskFilterBar.tsx(3,10): error TS2459: Module '"../../contexts/AuthContext"' declares 'User' locally, but it is not exported.
src/components/tasks/TaskFilterModal.tsx(4,70): error TS2305: Module '"@/types/task"' has no exported member 'TaskAssignee'.
src/components/tasks/TaskForm.tsx(4,38): error TS2305: Module '"@/types/task"' has no exported member 'User'.
src/components/tasks/TaskForm.tsx(5,31): error TS2724: '"@/schemas/taskForm"' has no exported member named 'TaskFormSchema'. Did you mean 'taskFormSchema'?
src/components/tasks/TaskForm.tsx(55,29): error TS2339: Property 'effortHours' does not exist on type 'Task'.
src/components/tasks/TaskForm.tsx(56,27): error TS2551: Property 'startDate' does not exist on type 'Task'. Did you mean 'start_date'?
src/components/tasks/TaskForm.tsx(58,29): error TS2551: Property 'assignees' does not exist on type 'Task'. Did you mean 'assignee'?
src/components/tasks/TaskForm.tsx(58,43): error TS7006: Parameter 'a' implicitly has an 'any' type.
src/components/tasks/TaskForm.tsx(61,19): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskForm.tsx(62,21): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/TaskForm.tsx(132,28): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskForm.tsx(133,23): error TS2322: Type 'unknown' is not assignable to type 'Key | null | undefined'.
src/components/tasks/TaskForm.tsx(133,36): error TS2322: Type 'unknown' is not assignable to type 'string | number | readonly string[] | undefined'.
src/components/tasks/TaskForm.tsx(134,18): error TS18046: 'status' is of type 'unknown'.
src/components/tasks/TaskForm.tsx(157,28): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/TaskForm.tsx(158,23): error TS2322: Type 'unknown' is not assignable to type 'Key | null | undefined'.
src/components/tasks/TaskForm.tsx(158,38): error TS2322: Type 'unknown' is not assignable to type 'string | number | readonly string[] | undefined'.
src/components/tasks/TaskForm.tsx(159,17): error TS2322: Type 'unknown' is not assignable to type 'ReactI18NextChildren | Iterable<ReactI18NextChildren>'.
src/components/tasks/TaskList.tsx(19,9): error TS2740: Type '{ [x: number]: string; }' is missing the following properties from type 'Record<TaskStatus, string>': TODO, DOING, DONE, CLOSE, and 5 more.
src/components/tasks/TaskList.tsx(20,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(21,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(22,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(23,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(24,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(25,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(28,9): error TS2739: Type '{ [x: number]: string; }' is missing the following properties from type 'Record<Priority, string>': LOW, MEDIUM, HIGH, URGENT, CRITICAL
src/components/tasks/TaskList.tsx(29,6): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(30,6): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(31,6): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(32,6): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(55,11): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(55,26): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(61,28): error TS2693: 'Priority' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(64,14): error TS7053: Element implicitly has an 'any' type because expression of type 'any' can't be used to index type 'Record<Priority, string>'.
src/components/tasks/TaskList.tsx(130,5): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(131,5): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(132,5): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(133,5): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(134,5): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(135,5): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(138,9): error TS2740: Type '{ [x: number]: string; }' is missing the following properties from type 'Record<TaskStatus, string>': TODO, DOING, DONE, CLOSE, and 5 more.
src/components/tasks/TaskList.tsx(139,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(140,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(141,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(142,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(143,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(144,6): error TS2693: 'TaskStatus' only refers to a type, but is being used as a value here.
src/components/tasks/TaskList.tsx(177,28): error TS7053: Element implicitly has an 'any' type because expression of type 'any' can't be used to index type 'Record<TaskStatus, string>'.
src/components/tasks/TaskListView.tsx(239,28): error TS2345: Argument of type '(member: ProjectMember) => void' is not assignable to parameter of type '(value: Member, index: number, array: Member[]) => void'.
  Types of parameters 'member' and 'value' are incompatible.
    Property 'joined_at' is missing in type 'Member' but required in type 'ProjectMember'.
src/components/tasks/TaskListView.tsx(240,40): error TS2551: Property 'userId' does not exist on type '{ user_id: string; email: string; username: string; full_name: string | null; avatar_url: string | null; }'. Did you mean 'user_id'?
src/components/tasks/TaskListView.tsx(241,43): error TS2551: Property 'userId' does not exist on type '{ user_id: string; email: string; username: string; full_name: string | null; avatar_url: string | null; }'. Did you mean 'user_id'?
src/components/tasks/TaskListView.tsx(242,33): error TS2551: Property 'userId' does not exist on type '{ user_id: string; email: string; username: string; full_name: string | null; avatar_url: string | null; }'. Did you mean 'user_id'?
src/components/tasks/TaskListView.tsx(243,59): error TS2551: Property 'fullName' does not exist on type '{ user_id: string; email: string; username: string; full_name: string | null; avatar_url: string | null; }'. Did you mean 'full_name'?
src/components/tasks/TaskListView.tsx(244,36): error TS2551: Property 'avatarUrl' does not exist on type '{ user_id: string; email: string; username: string; full_name: string | null; avatar_url: string | null; }'. Did you mean 'avatar_url'?
src/components/tasks/TaskListView.tsx(1224,43): error TS2322: Type 'string | null' is not assignable to type 'string | undefined'.
  Type 'null' is not assignable to type 'string | undefined'.
src/components/timeline/__tests__/gantt-hierarchy.test.tsx(34,13): error TS2339: Property 'title' does not exist on type '{ task_id: string; }'.
src/components/timeline/__tests__/increment1-modes.test.tsx(47,13): error TS2339: Property 'title' does not exist on type '{ task_id: string; }'.
src/components/ui/__tests__/Dialog.test.tsx(104,41): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string | undefined'.
  Type 'null' is not assignable to type 'string | undefined'.
src/components/ui/__tests__/Dialog.test.tsx(144,44): error TS2554: Expected 1 arguments, but got 2.
src/contexts/AuthContext.tsx(116,13): error TS2345: Argument of type '{ providerData: never[]; id: string; email: string; name: string; emailVerified?: boolean; }' is not assignable to parameter of type 'SetStateAction<User | null>'.
  Type '{ providerData: never[]; id: string; email: string; name: string; emailVerified?: boolean; }' is not assignable to type 'User'.
    Types of property 'emailVerified' are incompatible.
      Type 'boolean | undefined' is not assignable to type 'boolean'.
        Type 'undefined' is not assignable to type 'boolean'.
src/data/mockTasks.ts(1,38): error TS2305: Module '"@/types/task"' has no exported member 'User'.
src/data/mockTasks.ts(34,5): error TS2561: Object literal may only specify known properties, but 'priorityOrder' does not exist in type 'Task'. Did you mean to write 'priority_order'?
src/data/mockTasks.ts(84,5): error TS2561: Object literal may only specify known properties, but 'priorityOrder' does not exist in type 'Task'. Did you mean to write 'priority_order'?
src/data/mockTasks.ts(130,5): error TS2561: Object literal may only specify known properties, but 'priorityOrder' does not exist in type 'Task'. Did you mean to write 'priority_order'?
src/data/mockTasks.ts(145,5): error TS2561: Object literal may only specify known properties, but 'priorityOrder' does not exist in type 'Task'. Did you mean to write 'priority_order'?
src/graphql/index.ts(4,1): error TS2308: Module './queries/tasks' has already exported a member named 'GET_PROJECT_TASKS'. Consider explicitly re-exporting to resolve the ambiguity.
src/graphql/index.ts(10,1): error TS2308: Module './mutations/projectMembers' has already exported a member named 'REMOVE_PROJECT_MEMBER'. Consider explicitly re-exporting to resolve the ambiguity.
src/graphql/index.ts(10,1): error TS2308: Module './mutations/projectMembers' has already exported a member named 'UPDATE_PROJECT_MEMBER_ROLE'. Consider explicitly re-exporting to resolve the ambiguity.
src/hooks/use-sidebar-state.ts(32,60): error TS2802: Type 'Set<string>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
src/hooks/useCommonApi.ts(3,10): error TS2305: Module '"@/lib/api"' has no exported member 'API_BASE_URL'.
src/hooks/useProjectDetail.ts(4,10): error TS2305: Module '"@/types/task"' has no exported member 'TaskResponse'.
src/hooks/useTaskFilters.ts(41,43): error TS2551: Property 'assignees' does not exist on type 'Task'. Did you mean 'assignee'?
src/hooks/useTaskFilters.ts(41,58): error TS7006: Parameter 'a' implicitly has an 'any' type.
src/hooks/useTaskFilters.ts(50,28): error TS2769: No overload matches this call.
  Overload 1 of 4, '(value: string | number | Date): Date', gave the following error.
    Argument of type 'string | undefined' is not assignable to parameter of type 'string | number | Date'.
      Type 'undefined' is not assignable to type 'string | number | Date'.
  Overload 2 of 4, '(value: string | number): Date', gave the following error.
    Argument of type 'string | undefined' is not assignable to parameter of type 'string | number'.
      Type 'undefined' is not assignable to type 'string | number'.
src/hooks/useTaskFilters.ts(50,61): error TS2769: No overload matches this call.
  Overload 1 of 4, '(value: string | number | Date): Date', gave the following error.
    Argument of type 'string | undefined' is not assignable to parameter of type 'string | number | Date'.
      Type 'undefined' is not assignable to type 'string | number | Date'.
  Overload 2 of 4, '(value: string | number): Date', gave the following error.
    Argument of type 'string | undefined' is not assignable to parameter of type 'string | number'.
      Type 'undefined' is not assignable to type 'string | number'.
src/hooks/useTaskFilters.ts(54,34): error TS2551: Property 'LOW' does not exist on type '{ high: number; medium: number; low: number; }'. Did you mean 'low'?
src/hooks/useTaskFilters.ts(54,63): error TS2551: Property 'LOW' does not exist on type '{ high: number; medium: number; low: number; }'. Did you mean 'low'?
src/hooks/useTaskFilters.ts(83,19): error TS2352: Conversion of type '{ high: number; medium: number; low: number; }' to type 'Record<Priority, number>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
  Type '{ high: number; medium: number; low: number; }' is missing the following properties from type 'Record<Priority, number>': LOW, MEDIUM, HIGH, URGENT, CRITICAL
src/lib/__tests__/utils.test.ts(2,3): error TS2724: '"../utils"' has no exported member named 'formatDate'. Did you mean 'formatDateVN'?
src/lib/__tests__/utils.test.ts(4,3): error TS2305: Module '"../utils"' has no exported member 'generateId'.
src/lib/__tests__/utils.test.ts(5,3): error TS2305: Module '"../utils"' has no exported member 'truncateText'.
src/lib/__tests__/utils.test.ts(6,3): error TS2305: Module '"../utils"' has no exported member 'calculateTimeLeft'.
src/lib/__tests__/utils.test.ts(7,3): error TS2305: Module '"../utils"' has no exported member 'isOverdue'.
src/lib/__tests__/utils.test.ts(8,3): error TS2305: Module '"../utils"' has no exported member 'isNearDeadline'.
src/lib/__tests__/utils.test.ts(9,3): error TS2305: Module '"../utils"' has no exported member 'getInitials'.
src/lib/graphql/resolvers/project.ts(51,9): error TS2698: Spread types may only be created from object types.
src/lib/graphql/resolvers/project.ts(52,9): error TS2698: Spread types may only be created from object types.
src/lib/graphql/resolvers/project.ts(53,9): error TS2698: Spread types may only be created from object types.
src/lib/graphql/resolvers/project.ts(78,9): error TS2698: Spread types may only be created from object types.
src/lib/graphql/resolvers/task.ts(31,9): error TS2698: Spread types may only be created from object types.
src/lib/graphql/resolvers/task.ts(32,9): error TS2698: Spread types may only be created from object types.
src/lib/graphql/resolvers/task.ts(33,9): error TS2698: Spread types may only be created from object types.
src/lib/graphql/resolvers/task.ts(44,9): error TS2698: Spread types may only be created from object types.
src/lib/graphql/resolvers/task.ts(45,9): error TS2698: Spread types may only be created from object types.
src/lib/graphql/resolvers/task.ts(46,9): error TS2698: Spread types may only be created from object types.
src/lib/scheduler.ts(18,23): error TS2551: Property 'priorityOrder' does not exist on type 'Task'. Did you mean 'priority_order'?
src/lib/scheduler.ts(18,41): error TS2551: Property 'priorityOrder' does not exist on type 'Task'. Did you mean 'priority_order'?
src/lib/scheduler.ts(20,36): error TS2339: Property 'effortHours' does not exist on type 'Task'.
src/lib/scheduler.ts(21,26): error TS2551: Property 'startDate' does not exist on type 'Task'. Did you mean 'start_date'?
src/lib/scheduler.ts(21,52): error TS2551: Property 'startDate' does not exist on type 'Task'. Did you mean 'start_date'?
src/lib/testUtils.ts(1,10): error TS2305: Module '"@/types/task"' has no exported member 'CreateTaskInput'.
src/lib/testUtils.ts(1,27): error TS2305: Module '"@/types/task"' has no exported member 'TaskDiagnosticResponse'.
```
