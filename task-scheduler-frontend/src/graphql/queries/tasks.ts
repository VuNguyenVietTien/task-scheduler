import { gql } from '@apollo/client';

// Query lấy tasks trong project
export const GET_PROJECT_TASKS = gql`
  query GetTasks($projectId: ID!) {
    tasks(projectId: $projectId) {
      taskId
      projectId
      parentTaskId
      title
      assignee {
        userId
        username
        avatarUrl
        role
      }
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
        assignee {
          userId
          username
          avatarUrl
          role
        }
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

// Query để lấy chi tiết của một task theo ID
export const GET_TASK_BY_ID = gql`
  query GetTaskById($taskId: ID!) {
    task(taskId: $taskId) {
      taskId
      title
      description
      status
      priority
      effort
      progress
      startDate
      dueDate
      actualStartDate
      actualEndDate
      createdAt
      updatedAt
      projectId
      parentTaskId
      assignee {
        userId
        username
        avatarUrl
        role
      }
      creator {
        userId
        username
        avatarUrl
        role
      }
      priorityOrder
      type
      category
      progressType
      tags
      childTasks {
        taskId
        title
        status
        priority
        effort
        progress
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
        assignee {
          userId
          username
          avatarUrl
          role
        }
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
          assignee {
            userId
            username
            avatarUrl
            role
          }
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