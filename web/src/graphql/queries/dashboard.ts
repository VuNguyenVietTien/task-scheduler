import { gql } from '@apollo/client';

// Dashboard query: fetch tasks with optional assignee filter
// PM: no assigneeId (all tasks), Member: assigneeId = user.id
export const GET_DASHBOARD_TASKS = gql`
  query GetDashboardTasks($assigneeId: ID) {
    tasks(assigneeId: $assigneeId) {
      taskId
      title
      projectId
      status
      priority
      type
      dueDate
      assignee {
        userId
        username
        avatarUrl
      }
    }
  }
`;
