# Requirement mapping

Updated 2026-09-08. `LIVE` means the matching frontend and backend artifact is on production; `IN PROGRESS` is not yet promised live.

| Requirement | Frontend owner / behavior | Backend owner / response | Unit evidence | Deploy status |
|---|---|---|---|---|
| Gantt tree, discontinuous daily-hour bars, resource matrix | `Timeline` and scheduling components | plan/resource GraphQL | focused Gantt/lifecycle suites | LIVE |
| Canonical linked/unlinked project members | single Members UI and assignment selectors | physical `project_members`, compatibility view | member/backend contract suites | LIVE |
| Gantt User picker includes unlinked members | `Timeline` canonical resource-member filter | existing scheduling member query | 28 focused cases | LIVE |
| Fixed en/ja/vi project catalogs | Settings three-field editor; shared locale selector | catalog item/label mutations | 19 focused cases plus paste alignment regression | LIVE |
| Excel cell edit, assignment, rectangular copy/paste, fixed widths, effort refresh | `TaskExcelGrid` / `TaskListView` | existing task update mutation | 20 grid + 7 List cases | LIVE from main `d6c25d7` |
| Rename project | Settings name form, refresh project/sidebar | `update_project` returns authoritative name | 12 combined member/rename frontend cases; backend contract | LIVE |
| Remove linked/unlinked member | per-row Members action, confirm and refresh | `remove_resource_member(project_id, member_id)` transaction and owner/target guard | 12 frontend cases; Ubuntu contract build | LIVE |
| Manager catalog/access writes | catalog and member access editors; normalized Manager role | catalog mutations / `set_project_member_access`; owner/self/privileged-target guards retained | focused catalog/auth contracts; live schema introspection | LIVE |
| Delete Progress/Category/Task type | per-item confirmed Delete and task refresh | transaction nulls matching task catalog ID + legacy scalar, then deletes item | three-kind backend contract + frontend catalog suite | LIVE |
| Authoritative realtime task updates | List/Excel/Gantt modal dispatch normalized returned task into Redux | update mutation returns the same complete task shape used by List | focused realtime/editor suites | LIVE |
| Excel stable scroll + unsaved navigation guard | preserve cell/scroll, dirty count, bulk Save, beforeunload/in-app confirm | no new DB contract beyond batch task results | editor suites: 31/31 | LIVE |
| Normal List edits all task fields | inline inputs; project catalog/member dropdowns; authoritative Redux upsert | complete task update response shared with List query | editor suites: 31/31 | LIVE |
| Excel dropdown editors | Progress type, Category, Task type, Assignee dropdowns integrated with dirty/bulk-save flow | existing authoritative batch task update responses | editor suites: 31/31 | LIVE |
| Kanban parent and descendant tasks | flatten task tree with parent context; each task grouped by its own status | existing hierarchical task query and update response | Kanban/realtime suites: 6/6 | LIVE |
| Default task visibility by status | List/Kanban/Gantt hide DONE/CLOSE/REJECTED/ARCHIVED by default; explicit status filter shows selected status with required ancestor context | existing task status data; no status mutation contract change | shared status/Gantt suites: 11/11 | LIVE |

This table is updated after every fast module release. Known browser-only checks remain in `remaining.md` on `dev`.
