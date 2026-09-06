# PM Frontend Scout Report 1 — Scheduling WBS (read-only discovery)

Scope honored: only `web/package.json`, `web/src/app/projects/**`, `web/src/components/**`, `web/src/hooks/**`, `web/src/graphql/**`, `web/src/redux/**`, `web/src/types/**`, `web/src/contexts/**`, `docs/system-architecture.md`. `docs/design-guidelines.md` does **not** exist (docs/ has: code-standards, codebase-summary, deployment, development-roadmap, project-changelog, project-overview-pdr, README, system-architecture). No files edited.

Stack: Next.js 14 App Router + React 18, Apollo Client 3 (`@/lib/apollo-client`), Redux Toolkit (`@/redux`), react-hook-form + zod, dnd-kit + @hello-pangea/dnd, MUI (legacy), Tailwind, TipTap rich text, i18next (locales: `web/src/i18n/locales/{en,vi,ja}.json`), Jest + Testing Library. Monorepo has a parallel legacy `frontend/` tree GitNexus also indexes (out of scope; all citations below are `web/`).

---

## 1. Screen map & data-flow

### 1.1 Routing (`web/src/app/projects/**`)
| Route | File | Renders |
|---|---|---|
| `/projects` | `app/projects/page.tsx` | Project list |
| `/projects/new` | `app/projects/new/page.tsx` | Create project |
| `/projects/[id]` | `app/projects/[id]/page.tsx` → `ProjectPageWrapper` (`useSearchParams().tab`, default `list`) → dynamic import (ssr:false) of `components/projects/ProjectPage.tsx` | `ProjectDetailView` |
| `/projects/[id]/add-task` | `app/projects/[id]/add-task/page.tsx` → `components/tasks/NewTaskForm.tsx` | Task create form |
| `/projects/[id]/tasks/[taskId]` (+ `/create-subtask`) | `app/projects/[id]/tasks/[taskId]/page.tsx`, `.../create-subtask/page.tsx`, `loading.tsx` | Task detail + subtask create |

`ProjectPage.tsx` (`export default function ProjectPage({id, initialTab})`) dispatches `fetchProject`/`resetProject` from `redux/features/projectSlice.ts`, then renders `components/projects/ProjectDetailView.tsx` (`export function ProjectDetailView`, `activeView` synced from `initialTab`; tabs driven by sidebar nav, not internal tabs). Views inside `ProjectDetailView`: List (TaskListView), Timeline/Gantt (`<Timeline />` line ~355, passes `projectMembers` at ~1551), `MembersView` (~317), `DocumentsTab`, plus `fetchProjectMembers` dispatch (~87).

### 1.2 Task List
- `components/tasks/TaskListView.tsx` (1571 lines, `export function TaskListView`) — the real list. Props incl. `initialTasks`. State: `filter`, `sortConfig` (key `created_at`), `selectedTasks: Set`, `expandedTasks` (hierarchy expand), `editingCell: {taskId, field}`, `editValue`. Uses `useUpdateTaskPriorityOrder`/`useUpdateTask` (`hooks/useTasks.ts`) + field hooks from `hooks/useTaskFieldMutations.ts`.
- Inline cell editing already exists: `handleStartEditing/handleCancelEditing/handleSaveEditing` (~900–1000) with a dedicated `effort` branch (~974–990: parses `parseFloat(editValue)`, optimistic `updateSingleTaskInState`, then Redux `dispatch(updateTaskEffort(...))` fallback `updateEffort()` from `useTaskEffort.ts`); also editable `assignee_id`, `due_date`, child-task effort cells (~665–707). CSV export includes `Effort (hours)` (`handleExport` ~781).
- Bulk: `handleBulkStatusChange`, `handleBulkPriorityChange`, `handleBulkDelete` (~773–811) + `components/tasks/TaskBulkActions.tsx` (`TaskBulkActionsProps {selectedCount, onBulkStatusChange, onBulkPriorityChange, …}`) — **no bulk effort**.
- Duplicate/legacy stacks: `components/tasks/TaskList.tsx`, `components/task/TaskList.tsx`, `components/project/TasksTab.tsx` (own inline `GET_PROJECT_TASKS` gql, MUI card list), `components/common/TaskForm.tsx` (43-line wrapper). GanttChart placeholder: `components/tasks/GanttChart.tsx` is **empty (0 lines)**.
- Filters: `components/tasks/TaskFilterBar.tsx`, `TaskFilterModal.tsx`, `hooks/useTaskFilters.ts` (status/priority/assignee + sort field deadline|priority|status).

### 1.3 Gantt / Timeline (plan & schedule)
- `components/timeline/Timeline.tsx` (1557 lines, `export function Timeline({isLoading, onTaskClick, users})`) — hand-rolled day-grid Gantt. Key internals: VN date utils `getCurrentDateVN/getLastMonday` (~121–136), `dateRange` state (~152), `processTasks` (~280), `allMembers` memo merging redux members + task assignees, defaulting role `'member'` (~291–303), `orderedTasks` (~485), `filteredTasks`/`visibleTasks` (~570–595), dnd-kit `onDragStart/onDragEnd` bar drag (~624–632), date inputs `handleStartDateChange/handleEndDateChange` (~784–794), task reorder `handleTaskReorder` (~946), auto-sort `handleAutoSort` (~1007, sets `autoSort` + redux `updateAutoSort`).
- Plan persistence: `handleNewPlan` (~822), `handleSelectPlan` (~829), `handleSavePlan` (~848, counts non DONE/CLOSE tasks), `handleDeletePlan` (~927); plan select dropdown renders `plans` and `activePlan` (sed window ~1035–1120). Redux: `redux/features/plansSlice.ts` thunks `fetchProjectPlans, fetchLatestProjectPlan, createPlan, updatePlan, deletePlan, setPlanActive` + selectors `selectPlans/selectActivePlan`. Types `types/plan.ts` (`Plan.planData.tasks: PlanTaskData[]` — flat array with `task_id, priority_order, start_date, end_date, effort, assignee_id…`; `PlanMetadata.lastSortedDate/sortCriteria`). GraphQL: `graphql/queries/plans.ts` (`PLAN_FIELDS, GET_PROJECT_PLANS, GET_LATEST_PROJECT_PLAN, GET_PLAN_BY_ID`), `graphql/mutations/plans.ts` (`CREATE_PLAN, UPDATE_PLAN, DELETE_PLAN, SET_PLAN_ACTIVE`).
- Supporting components: `components/timeline/TaskBar.tsx` (status/priority colors, tooltip on hover), `TaskTooltip.tsx`, `PriorityTaskList.tsx`, `PriorityTaskCard.tsx`, `TimelineSkeleton.tsx`, `gantt-filter-bar.tsx` (`GanttFilterBar` using `GanttFilter` type from `types/task.ts`: search/status/priority/type/tags OR-logic, i18n `gantt.*` keys).
- Data flow: `hooks/useProjectTasks.ts` (fetch + `validateTaskStatus/Priority/Type/Category/ProgressType/Tags` + `transformGraphQLTask` snake→camel) → `redux/features/tasksSlice.ts` thunks `fetchProjectTasks, updateTaskStatus, updateTaskAssignee, updateTaskPriority, updateTaskEffort (line 210), updateTaskDueDate` → `Timeline`/`TaskListView` read via `useAppSelector`. Queries `graphql/queries/tasks.ts`: `GET_PROJECT_TASKS (GetTasks)`, `GET_TASK_BY_ID`, `GET_PROJECT_TASKS_PAGINATED`, `GET_TASK_COMMENTS`, `GET_TASK_SUBTASKS`, `GET_TASK_BASIC_INFO`. Mutations `graphql/mutations/tasks.ts`: `UPDATE_TASK_STATUS, UPDATE_TASK_EFFORT, UPDATE_TASK, CREATE_TASK_COMMENT, DELETE_TASK_COMMENT, REORDER_TASKS`.

### 1.4 Task form
- `components/tasks/NewTaskForm.tsx` (used by add-task page) and `components/tasks/TaskForm.tsx` (zod `TaskFormSchema`, fields: `title, description, status, priority, effortHours (valueAsNumber), startDate, deadline, assigneeIds` via `components/common/UserTagSelectField`; default `assigneeIds: []`). Schema source `web/src/taskForm.schema.ts`. Subtask form: `components/tasks/SubtaskForm.tsx` (+ tests), page `create-subtask/page.tsx`. Task detail: `components/tasks/TaskDetailPage/index.tsx` with tabs (`SubtasksTab, DetailsTab, CommentsTab, DescriptionTab`), `inline-editable-field.tsx`.
- `hooks/useTaskFieldMutations.ts`: `useUpdateTaskStatus, useUpdateTaskPriority, useUpdateTaskEffort, useUpdateTaskDueDate, useUpdateTaskAssignee` — all Apollo-based with cache updates. `hooks/useTaskEffort.ts`: duplicate `useUpdateTaskEffort` — **smells**: uses local `UPDATE_TASK` redefinition instead of `UPDATE_TASK_EFFORT`, `localStorage 'tasks-cache'` fallback, `window` CustomEvent `task-effort-updated`, Vietnamese console logs → fragile; prefer the `useTaskFieldMutations` variant.

### 1.5 Members
- `components/projects/MembersView.tsx` (832 lines): local `emailInput` add (`handleAddMemberByEmail`-style handlers ~187/229, maps backend error `User with this email not found` → `t('members.emailNotFound')`), `handleRemoveMember` (~271), `handleRoleChange`/`handleRoleUpdate` (~314/411), `pendingPositions` saved via `updateMemberPosition` (~359), add modal with email+position+role (~622+). Redux `redux/features/membersSlice.ts` thunks: `fetchProjectMembers, removeMultipleMembers, updateMultipleMemberRoles, addMemberByEmail, removeMember, removeMultipleProjectMembers, updateMemberPosition, updateProjectMemberRole, updateMultipleProjectMemberRoles`.
- GraphQL: `graphql/queries/projectMembers.ts` (`GET_PROJECT_MEMBERS, GET_PROJECT_TASKS`), `graphql/mutations/projectMembers.ts` (`ADD_PROJECT_MEMBER, UPDATE_MEMBER_ROLE, UPDATE_PROJECT_MEMBER_ROLE (dup), UPDATE_MULTIPLE_MEMBER_ROLES, REMOVE_PROJECT_MEMBER, REMOVE_MULTIPLE_PROJECT_MEMBERS`), `graphql/mutations/projectMember.ts` (singular; `INVITE_PROJECT_MEMBER` = `AddProjectMemberByEmail(project_id, email, role)`, `UPDATE_MEMBER_POSITION` — also duplicate ops). Types: `types/project.ts` (`MemberRole = Manager|Leader|Member|Guest`, `ProjectMember`, `normalizeRole` w/ Admin→Manager, Viewer→Guest mapping, `getRolePermissions` returns Vietnamese strings), `types/members.ts` (`Member.position?`, `BulkUpdateResult`, `BulkRemoveResult`). Legacy `components/project/MembersTab.tsx` (675 lines) still present.
- Projects/queries: `graphql/queries/projects.ts` (`GET_PROJECTS`, `GET_PROJECT_BY_ID`), `graphql/queries/GetProjectById.ts`, `hooks/useProjects.ts`, `useProject.ts`, `useProjectDetail.ts`, `useProjectMembers.ts` (21 lines, thin wrapper). Contexts: `contexts/AuthContext.tsx` only.

## 2. What is already usable
- Project detail shell with URL-tab (`?tab=`), sidebar-driven views, protected routes.
- Task List: sorting, filtering, selection, inline edit of status/priority/assignee/due date/**effort (single-task)**, expandable hierarchy rows, CSV export, bulk status/priority/delete, dnd reordering via `useReorderTasks`/`mapReorderInput`/`normalizeReorderResult` (`hooks/useTasks.ts`).
- Gantt: day grid with drag bar date changes, plan create/select/save/delete/active via redux+GraphQL, priority auto-sort, Gantt filter bar (i18n), tooltips.
- Plan model already snapshots flat task schedule data (`types/plan.ts`) — good base for master-schedule-per-phase.
- Member management: invite-by-email, role changes (single+multiple), remove (single+multiple), position field, realtime notifications infra (`hooks/useNotificationsRedux.ts`, `use-realtime-*.ts`, `graphql-ws` dep).
- Effort field exists end-to-end (type, query, mutation `update_task_effort`/`update_task`, list inline edit, form `effortHours`, CSV export).
- i18n: en/vi/ja locale files + `GanttFilterBar`/members already translated.

## 3. UX/API gaps (verified by search)
1. **Hierarchy & prerequisites**: `Task.parent_task_id` + `child_tasks` exist and are rendered/edited, but **no dependency/prerequisite/blocked-by model anywhere** — grep for `prerequis|dependen|blocked_by` only hits unrelated comments. No drag-to-link, no critical path. Gantt bars are purely date-driven; no FS/SS/FF/SF links, no auto-reschedule.
2. **Per-day member capacity & leave/overtime**: no `capacity|leave|overtime|allocation` matches in scope (only false positives in Dialog/ImageHandler). `Timeline.allMembers` is a flat option list (used for filter dropdown ~1156). No resource heatmap, no per-day allocation rows, no working-calendar concept; `PlanTaskData.effort` is a single scalar (no per-day distribution).
3. **Segmented Gantt allocations + effort labels + inline effort edit**: `TaskBar.tsx` renders one solid bar per task (status color, tooltip with date range). No segment-per-assignee, no effort text on bars, no inline effort input inside Gantt (effort inline edit only in TaskListView). Tooltip shows dates only (`TaskTooltip.tsx` via `formatDateRange`).
4. **Bulk List effort edit**: `TaskBulkActions` only status/priority; `TaskListView` bulk handlers don't include effort.
5. **Recurring meetings**: zero matches for `recur|meeting` in scope. No RRULE model, no meeting entity.
6. **Master schedule by phase**: `Plan` is one flat task array; no phase/stage grouping, no plan-per-phase, no rollup dates. `TaskCategory` is a hardcoded 5-value union (`types/task.ts`) used as "category" — not a phase timeline concept.
7. **Custom multilingual phase/category**: `TASK_TYPES/TASK_CATEGORIES/TASK_TAGS` are const unions; `validateTaskCategory` hardcodes the list in `hooks/useProjectTasks.ts`. No CRUD for user-defined categories/phases, no per-locale labels (labels via `constants/task-display-labels` are static). i18n locales exist but cannot cover user-created names without a new entity + translation strategy.
8. **Optional-email members & groups**: add-member requires an existing user email (error path `User with this email not found`); no invite-token/no-account member, no group/team entity, no bulk email invite parsing. `types/project.ts` roles include `Guest` but no email-optional flag.
9. **Hygiene**: duplicate components (`TaskList.tsx` ×2 stacks, `MembersTab` vs `MembersView`, `TasksTab` with its own query, dead `GanttChart.tsx`, `TaskDetailPage_backup.tsx`), duplicated GraphQL member ops across `projectMember.ts`/`projectMembers.ts`, `useTaskEffort.ts` bypasses typed mutations.

## 4. Recommended screen-level delivery slices
1. **S1 – Bulk effort edit (List)**: extend `TaskBulkActions` + `TaskListView` bulk handlers → batch via `REORDER_TASKS`-style input or new `updateTasksEffort` mutation; reuse `useTaskFieldMutations.useUpdateTaskEffort`. Low risk, pure frontend + one mutation.
2. **S2 – Gantt effort labels + inline effort edit**: add effort label to `TaskBar`, effort popover/inline input in `Timeline` calling `useUpdateTaskEffort`; extend `TaskTooltip` with effort/assignee.
3. **S3 – Prerequisites (FS links)**: new `depends_on` field + Link component in `Timeline` (SVG arrows between `TaskBar`s), auto-shift on drag end (`onDragEnd` hook point exists), new query fields + mutation; plan snapshot gains `depends_on` in `PlanTaskData`.
4. **S4 – Segmented allocations**: split bar per assignee-day using new per-day allocation API; render segments in `TaskBar`; per-day capacity row per member in `Timeline` grid.
5. **S5 – Member capacity/leave/overtime model**: entity + UI (member panel in MembersView), calendar overlay in Gantt, capacity-aware scheduling warnings.
6. **S6 – Master schedule by phase**: introduce `Phase` entity + `Plan` grouping (`planData.phases[]`), phase header rows in `Timeline`, rollup dates/progress; migrate `TaskCategory` display to phases.
7. **S7 – Custom multilingual categories/phases**: CRUD entity + `name_i18n` map; replace hardcoded unions in `types/task.ts` + `validateTaskCategory` with fetched lists; locale fallback en→user lang.
8. **S8 – Recurring meetings**: new Meeting entity (RRULE), Gantt overlay lane, link to tasks; independent of task scheduling core.
9. **S9 – Optional-email members & groups**: allow invite without existing account (pending invite state in MembersView), group entity assignable as `assignee`; touches membersSlice + all UserTag selects.
Suggested order: S1→S2→S3 (scheduling core), S6/S7 before S4/S5 (phase model shapes allocation math), S8/S9 parallelizable.

## 5. Test strategy
- **Existing baseline**: Jest + RTL under `web/src/**/__tests__` (TaskList, TaskForm, Subtask*, TaskDetails.keyboard, Dialog, dashboards, `graphql/__tests__/w3-contract.test.ts` + `w3-sdl-fixture.test.ts`). `npm run test` / `test:coverage` (`web/package.json`).
- **Unit**: per hook — `useTaskFieldMutations` (assert mutation variables + cache writes, mock Apollo), `plansSlice`/`tasksSlice`/`membersSlice` thunk reducers; validators in `useProjectTasks.ts` for new phase/category normalization.
- **Component**: `TaskListView` inline effort edit (render input, save fires expected thunk, optimistic rollback on error); `TaskBulkActions` new bulk-effort flow (selection state, call args); `gantt-filter-bar` filter logic; `TaskBar` effort label & segments snapshot.
- **Contract**: extend the `graphql/__tests__/w3-contract` pattern — every new mutation/query gets schema-fixture test (SDL fixture) so frontend/backend drift is caught without a server.
- **Integration**: Timeline plan save/load round-trip with mocked Apollo (planData ↔ redux); drag bar → `handleEndDateChange` → `update_task` payload including new `depends_on` shift results.
- **Manual/E2E (later)**: Playwright for cross-screen flows (add-task → list inline edit → Gantt segment → plan save); visual regression for Gantt grid.

---
*Report generated by pm-frontend-scout-1 (read-only). All paths relative to `web/src/` unless noted.*
