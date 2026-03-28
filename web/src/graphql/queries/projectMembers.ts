import { gql } from '@apollo/client';

export const GET_PROJECT_MEMBERS = gql`
  query GetProjectMembers($projectId: ID!) {
    project_members(project_id: $projectId) {
      user {
        user_id
        email
        username
        full_name
        avatar_url
      }
      role
      joined_at
    }
  }
`;

export const GET_PROJECT_TASKS = gql`
  query GetProjectTasks($projectId: ID!) {
    tasks(project_id: $projectId) {
      task_id
      title
      description
      status
      priority
      start_date
      due_date
      progress
      assignee {
        user_id
        username
        full_name
        avatar_url
      }
      created_at
      updated_at
    }
  }
`;
