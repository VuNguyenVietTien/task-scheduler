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

// Query mới: lấy tasks có phân trang và lọc
export const GET_PROJECT_TASKS_PAGINATED = gql`
  query GetTasksPaginated(
    $projectId: ID!, 
    $page: Int, 
    $pageSize: Int, 
    $filters: TaskFiltersInput
  ) {
    tasksPaginated(
      projectId: $projectId, 
      page: $page, 
      pageSize: $pageSize, 
      filters: $filters
    ) {
      tasks {
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
      pagination {
        totalItems
        totalPages
        currentPage
        pageSize
      }
    }
  }
`;

export const GET_TASK_COMMENTS = gql`
  query GetTaskComments($taskId: ID!) {
    taskComments(taskId: $taskId) {
      id
      content
      authorId
      username
      createdAt
      updatedAt
    }
  }
`;