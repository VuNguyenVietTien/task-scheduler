import { gql } from '@apollo/client';

export const CREATE_TASK = gql`
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      taskId
      title
      description
      status
      priority
      priorityOrder
      assigneeId
      effort
      startDate
      dueDate
      createdBy
      projectId
      type
      category
      progressType
      tags
      parentTaskId
    }
  }
`;

export const UPDATE_TASK = gql`
  mutation UpdateTask(
    $taskId: ID!
    $title: String
    $description: String
    $status: TaskStatus
    $priority: TaskPriority
    $startDate: DateTime
    $deadline: DateTime
    $assigneeId: ID
    $priorityOrder: Int
    $type: String
    $category: String
    $progressType: TaskProgressType
    $tags: [String!]
  ) {
    updateTask(
      taskId: $taskId
      title: $title
      description: $description
      status: $status
      priority: $priority
      startDate: $startDate
      deadline: $deadline
      assigneeId: $assigneeId
      priorityOrder: $priorityOrder
      type: $type
      category: $category
      progressType: $progressType
      tags: $tags
    ) {
      taskId
      title
      description
      status
      priority  
      priorityOrder
      assigneeId
      effort
      startDate
      dueDate
      type
      category
      progressType
      tags
    }
  }
`;