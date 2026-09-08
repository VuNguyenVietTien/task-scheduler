# GANTT-PLAN-UX-0908
Role: implementer/debugger
Route: openai-codex/gpt-5.6-sol high
Environment: Windows PowerShell, 2026-09-08 Asia/Bangkok. Pane w1:p30 starts in dev-0908 but ALL product writes must be in C:/Users/TienVNV/Documents/prjmngr/worktrees/gantt-plan-ux-0908, branch codex/gantt-plan-ux-0908, base17e885a.
Read: AGENTS.md, docs/README.md, project-overview-pdr.md, code-standards.md, system-architecture.md, development-roadmap.md; existing GANTT-PARENT-SUMMARY-0908.md. Load relevant debug/frontend skill. Scout bounded web Gantt plan selection/lifecycle/parser and member resource rendering.
Write ownership: Gantt plan toolbar/state/hooks/parser, resource daily cells, related locales and focused unit tests only. You are not alone: other workers own TaskListView/TaskFilterModal/Kanban/TaskDetailPage; do not edit or revert their work. No shared dependency/config changes, no server startup, no backend changes unless report proven need first.
Outcome/acceptance:
1. No saved plans => current priority/assignee auto schedule. Plans exist => default newest saved plan. Explicit No plan selection stays selected and uses current scheduling; do not reselect on every render.
2. Remove Live (current config) and Live view jargon; simple localized No plan option in EN/JA/VI. Clear visible Delete plan action.
3. Diagnose error plan_data.tasks[0] has invalid daily hours after deleting plan. Fix cause and safe legacy handling, never fabricate allocations, overwrite snapshots or hide corrupt data as success. Delete selection transitions newest remaining or no-plan without stale parser errors. Preserve snapshot semantics and current validation safety. No production deletion for testing.
4. Daily member cells only two lines assigned hours and working hours/capacity. assigned0 white; positive below capacity yellow; equal green; above red. Zero capacity+zero assigned white. Remove reserved/remaining clutter, preserve underlying scheduling calculations.
5. Preserve just-integrated Master continuous bars across holidays/no hour labels and sparse WBS parent summaries, immutable saved plans.
Fast delivery: aim15min, ONLY focused unit tests, no exhaustive review/lint/build. Existing dependencies in dev-0908/web/node_modules; use direct Jest and NODE_PATH as needed, do not install packages. Commit focused code/report on own branch; no merge/deploy. Report exact commits, root cause, test evidence, known gaps. PM integrates and browser checks localhost.
Report: C:/Users/TienVNV/Documents/prjmngr/worktrees/gantt-plan-ux-0908/plans/reports/GANTT-PLAN-UX-0908.md. No ledger edits. Finish Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT.
