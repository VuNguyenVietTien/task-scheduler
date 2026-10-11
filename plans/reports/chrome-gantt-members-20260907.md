# Chrome findings and implementation handoff

Date: 2026-09-07, Asia/Bangkok
Sender: Codex desktop coordinating with existing Herdr Project Manager.
Recipient: existing Project Manager in default / w1:t5 / w1:pK.
User explicitly requested Chrome inspection then coordination with existing PM; visible PM steering confirms user asked it to receive Codex instructions.

## Scope and acceptance
1. Gantt: merge current Task list and Task into a single left task hierarchy. Show child tasks with parent expand/collapse; corresponding timeline child rows must use the same visibility and ordering. Preserve existing sorting/filtering and schedule behavior.
2. Add planned Start and End to task rows, sourced from the currently displayed plan/timeline, including saved-plan versus live behavior. Do not substitute unrelated deadline fields.
3. List assignee: include all canonical project members, including members not linked to an account. Assignment must persist after reload.
4. Unify the two member management sections and underlying member source using the existing canonical project-member table. Support add by display name without email/user link; PM can subsequently link by an existing system user's email. Preserve member assignments, scheduling capacities, days off, groups, commitments, and account permissions. Avoid duplicate identities and data loss. Database duplication is a hypothesis requiring schema/code verification, not yet proven by browser.
5. Plan, implement, focused tests and broader checks as needed, independent review, and UI verification. Back up before actual database schema/data changes. Do not silently deploy or migrate production; prepare reviewable artifacts and report needed release steps.

## Browser evidence (read-only, no data submitted)
URL: https://prjmngr.vercel.app/projects/b24aac96-4f0e-4689-8469-7222945b5df8?tab=gantt
Project: Codex E2E Production 2026-09-01.
Live view, WBS enabled, date range 2026-09-03 to 2026-09-17. Saved r1/r2 options marked stale.
- Task list shows 24 top-level tasks with priority, no child hierarchy and no row Start/End.
- Separate Task column shows parent/child hierarchy; first order differs: Task list starts with common parent, Task column starts with standalone E2E task.
- On common parent, Collapse removed six child labels in Task and three visible matching review labels in timeline; Expand restored them. Existing timeline collapse already works in that second column. Reuse/preserve that behavior in merged hierarchy.
URL: same project ?tab=list
- Clicked common parent's Chua gan assignee cell. Editor select contains only Chua gan and one linked member. Cancelled without saving.
URL: same project ?tab=members
- Upper section: Project members (named, no email required), five placeholder members, optional email field and per-member Link to user input. All five feed Daily capacity & days off.
- Lower section: Project members, Add member / Edit / Quick Add, one linked Manager account. Only that linked member appears in List assignee select.
- No creation, link, assignment, recalculate, or save was submitted.

## Coordination
Current PM pane w1:pK is visibly running Pi with gpt-5.6-sol medium, currently waiting on docs01 (w1:p14). Finish/checkpoint that work safely before adding this scope. Do not interrupt or overwrite docs worker changes.
Herdr CLI: C:/Users/TienVNV/AppData/Local/Programs/Herdr/bin/herdr.exe, --session default.
The PM pane is missing from agent list; agent get w1:pK returns agent_not_found. Do not spoof agent registration. The browser coordinator can read a response report in the shared workspace.
Please acknowledge receipt in plans/reports/chrome-gantt-members-20260907-ack.md with active plan path, accepted scope, state, and exact next task. Own implementation orchestration and keep reports available for Codex browser verification.
