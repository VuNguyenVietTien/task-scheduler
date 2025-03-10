import { gql } from '@apollo/client';
import { TaskStatus } from '@/types/task';

export const UPDATE_TASK_STATUS = gql`
  mutation UpdateTaskStatus($taskId: ID!, $status: String!) {
    updateTaskStatus(taskId: $taskId, status: $status) {
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
    }
  }
`;