import { gql } from '@apollo/client';

// Dashboard query: fetch tasks with optional assignee filter
// PM: no assigneeId (all tasks), Member: assigneeId = user.id
export const GET_DASHBOARD_TASKS = gql`
  query GetDashboardTasks($assigneeId: ID) {
    tasks(assignee_id: $assigneeId) {
      task_id
      title
      project_id
      status
      priority
      type_
      due_date
    }
  }
`;
