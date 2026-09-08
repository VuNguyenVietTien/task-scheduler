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
| Hierarchy-safe task and Excel updates | normal edits preserve unloaded child hierarchy; explicit null clears authoritative fields; effort commits before arrow/Enter navigation; rectangular multi-cell copy/paste stays row-major | existing task update contract; blank effort saves as `0`; no backend change | Redux/List/Grid focused suites: 38/38 | LIVE |
| Member, owner, settings, and timesheet permissions | role-aware sidebar/direct-view gates; owner transfer confirmation; own/other timesheet selection and editability | shared Manager/Leader/Member/Guest matrix; owner-only transfer; role-aware member/settings/catalog/timesheet enforcement | frontend 21/21; backend permission 4/4 + contract 33/33; public SDL introspection | LIVE |
| Excel stable scroll + unsaved navigation guard | preserve cell/scroll, dirty count, bulk Save, beforeunload/in-app confirm | no new DB contract beyond batch task results | editor suites: 31/31 | LIVE |
| Normal List edits all task fields | inline inputs; project catalog/member dropdowns; authoritative Redux upsert | complete task update response shared with List query | editor suites: 31/31 | LIVE |
| Excel dropdown editors | Progress type, Category, Task type, Assignee dropdowns integrated with dirty/bulk-save flow | existing authoritative batch task update responses | editor suites: 31/31 | LIVE |
| Kanban parent and descendant tasks | flatten task tree with parent context; each task grouped by its own status | existing hierarchical task query and update response | Kanban/realtime suites: 6/6 | LIVE |
| Default task visibility by status | List/Kanban/Gantt hide DONE/CLOSE/REJECTED/ARCHIVED by default; REJECTED remains historical-filter-only and is removed from every create/edit/bulk/Excel/Kanban status editor | existing task status data; no status mutation contract change | focused editor/filter/delete suites: 32/32 | LIVE |
| Clone selected child roots to another parent or no parent | Clone dialog preserves selected descendants when source is unchecked; Task Detail renders authoritative direct `child_tasks` | clone input accepts one optional destination mode and rejects invalid/cyclic/cross-project targets | combined clone/delete frontend suites: 35/35; Ubuntu contract: 33/33 | LIVE |
| Hard-delete task subtree | confirmed Delete in detail/List/Excel recursively hard deletes the parent and all descendants after an irreversible confirmation showing the loaded descendant count; Redux removes every returned subtree ID | authorized transaction deletes the locked same-project subtree and returns `project_id` plus `deleted_task_ids` | focused editor/filter/delete suites: 32/32; Ubuntu contract: 33/33 | LIVE |

This table is updated after every fast module release. Known browser-only checks remain in `remaining.md` on `dev`.
