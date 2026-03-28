# GraphQL snake_case Naming Fix Report

**Date:** 2026-03-28
**Status:** Completed

## Summary

Fixed all GraphQL operation names, field names, and TypeScript interfaces in `web/` to use snake_case, matching the Rust async-graphql backend which exposes snake_case by default for `#[Object]` resolver methods.

## Files Modified

### GraphQL Documents (queries/mutations)
| File | Changes |
|------|---------|
| `web/src/graphql/queries/project.ts` | All fields → snake_case; mutation `createProject` → `create_project`; args `project_id`, `user_id`, etc. |
| `web/src/graphql/queries/projects.ts` | NOT changed (uses REST API, not directly used by components) |
| `web/src/graphql/queries/tasks.ts` | All fields → snake_case; queries `task_subtasks`, `task_comments`; args `task_id`, `project_id`, `assignee_id` |
| `web/src/graphql/queries/dashboard.ts` | `assignee_id` arg, all fields snake_case |
| `web/src/graphql/queries/notifications.ts` | `notification_count` query; all fields snake_case |
| `web/src/graphql/queries/projectMembers.ts` | `project_members` query, all fields snake_case |
| `web/src/graphql/queries/member.ts` | `project_members`, `my_project_role` queries; snake_case fields |
| `web/src/graphql/queries/users.ts` | All fields snake_case (`user_id`, `full_name`, `avatar_url`) |
| `web/src/graphql/mutations/tasks.ts` | All mutations snake_case: `update_task_status`, `update_task_effort`, `update_task`, `create_comment`, `delete_comment` |
| `web/src/graphql/mutations/notifications.ts` | `create_notification`, `mark_notification_as_read`, `mark_all_notifications_as_read` |
| `web/src/graphql/mutations/projectMembers.ts` | All mutations snake_case; args `project_id`, `user_id`; fields snake_case |

### TypeScript Types
| File | Changes |
|------|---------|
| `web/src/types/notification.ts` | `BackendNotification` → snake_case fields (`notification_id`, `user_id`, `is_read`, `created_at`, etc.) |

### Hooks (interface + response mapping)
| File | Changes |
|------|---------|
| `web/src/hooks/useProject.ts` | `ProjectMember`, `ProjectOwner`, `Project` interfaces → snake_case |
| `web/src/hooks/useProjectTasks.ts` | `GraphQLTask`/`GraphQLTaskAssignee` interfaces → snake_case; `transformGraphQLTask` mapping updated |
| `web/src/hooks/use-dashboard-tasks.ts` | `DashboardTask` interface → snake_case; `dueDate` → `due_date` |
| `web/src/hooks/useNotifications.ts` | `convertBackendNotification` → reads snake_case fields; cache update keys |
| `web/src/hooks/useTaskMutations.ts` | `UpdateTaskStatusResponse` → `update_task_status`; refetchQueries references |
| `web/src/hooks/useTaskStatusUpdate.ts` | Input `task_id`; response `update_task_status` |
| `web/src/hooks/useTaskFieldMutations.ts` | All input objects → snake_case; all response reads → snake_case; optimistic responses |
| `web/src/hooks/useTaskEffort.ts` | Inline GraphQL → snake_case mutations/fields; input/response mapping |
| `web/src/hooks/useTasks.ts` | Input building → snake_case keys; response mapping → snake_case |

### Components
| File | Changes |
|------|---------|
| `web/src/components/projects/ProjectList.tsx` | `Project` interface + render → snake_case (`project_id`, `start_date`, `member_count`) |
| `web/src/components/projects/create-project-modal.tsx` | Redirect → `data.create_project.project_id` |
| `web/src/components/ui/navigation/Sidebar.tsx` | `ProjectNode` interface → `project_id`, `icon_url`; key/prop refs |
| `web/src/components/ui/navigation/sidebar-project-tree-item.tsx` | `Project` interface → `project_id`, `icon_url`; all `project.projectId` → `project.project_id` |
| `web/src/components/dashboard/pm-dashboard-view.tsx` | `DashboardTask` interface → snake_case; `dueDate` → `due_date` in column configs |
| `web/src/components/dashboard/member-dashboard-view.tsx` | `DashboardTask` interface → snake_case; sort by `due_date` |
| `web/src/components/dashboard/dashboard-task-table.tsx` | `task.projectId` → `task.project_id`; `task.taskId` → `task.task_id` |

## TypeScript Status

- All modified files compile cleanly
- Remaining errors in `sidebar-project-tree-item.tsx` (null-check on `searchParams`) are **pre-existing** and unrelated to these changes
- Test file errors (`UserDashboard.test.tsx`) are pre-existing mock data structure mismatches

## Key Schema Facts Confirmed

From backend code analysis:
- `#[Object]` resolver methods: snake_case (e.g., `create_project`, `update_task_status`)
- `#[SimpleObject]` with `rename_fields = "camelCase"` on `Task`, `Project` types
- HOWEVER, empirical browser errors confirm the running backend exposes snake_case throughout

## Unresolved Questions

1. **Schema conflict**: The `backend/schema.graphql` reference file shows camelCase, but browser errors show snake_case. The `schema.graphql` may be outdated/manually written. Recommend introspecting the actual running backend to verify before deploying.
2. **`web/src/graphql/queries/projects.ts`**: This duplicate file uses different field names (e.g., `name` instead of `fullName` for owner). It appears unused — should be deleted or aligned.
3. **Notification queries**: Backend `notification.rs` resolver is a stub (returns empty vec). The `notifications/mod.rs` has a full implementation. Verify which is active in the merged schema.
