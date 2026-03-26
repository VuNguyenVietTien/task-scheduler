import { gql } from '@apollo/client';

export const GET_PROJECT_MEMBERS = gql`
  query GetProjectMembers($projectId: ID!) {
    projectMembers(projectId: $projectId) {
      user {
        userId
        email
        username
        fullName
        avatarUrl
      }
      role
      joinedAt
    }
  }
`;

export const GET_PROJECT_TASKS = gql`
  query GetProjectTasks($projectId: ID!) {
    projectTasks(projectId: $projectId) {
      taskId
      title
      description
      status
      priority
      startDate
      dueDate
      progress
      assignee {
        id
        username
        fullName
        avatarUrl
      }
      createdAt
      updatedAt
    }
  }
`; 