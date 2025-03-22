import { gql } from '@apollo/client';
import { TaskStatus } from '@/types/task';

export const UPDATE_TASK_STATUS = gql`
  mutation UpdateTaskStatus($input: UpdateTaskStatusInput!) {
    updateTaskStatus(input: $input) {
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

export const UPDATE_TASK_EFFORT = gql`
  mutation UpdateTaskEffort($input: UpdateTaskEffortInput!) {
    updateTaskEffort(input: $input) {
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

export const UPDATE_TASK = gql`
  mutation UpdateTask($input: UpdateTaskInput!) {
    updateTask(input: $input) {
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

export const CREATE_TASK_COMMENT = gql`
  mutation CreateTaskComment($input: CreateCommentInput!) {
    createComment(input: $input) {
      id
      content
      authorId
      username
      createdAt
      updatedAt
    }
  }
`;