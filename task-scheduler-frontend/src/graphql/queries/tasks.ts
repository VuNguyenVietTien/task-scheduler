import { gql } from '@apollo/client';

// Query lấy tasks trong project
export const GET_PROJECT_TASKS = gql`
  query GetTasks($projectId: ID!) {
    tasks(projectId: $projectId) {
      taskId
      projectId
      parentTaskId
      title
      description
      assignee {
        userId
        username
        avatarUrl
        role
      }
      priorityOrder
      startDate
      dueDate
      actualStartDate
      actualEndDate
      effort
      progress
      createdBy
      createdAt
      updatedAt
      isDeleted
      status
      priority
      type
      category
      tags
      progressType
      childTasks {
        taskId
        projectId
        parentTaskId
        title
        description
        assignee {
          userId
          username
          avatarUrl
          role
        }
        priorityOrder
        startDate
        dueDate
        effort
        progress
        status
        priority
        type
        category
      }
    }
  }
`;