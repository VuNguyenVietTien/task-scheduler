import { gql } from '@apollo/client';

export const GET_PROJECT_TASKS = gql`
  query GetTasks($projectId: ID!) {
    tasks(project_id: $projectId) {
      task_id
      project_id
      parent_task_id
      title
      assignee {
        user_id
        username
        full_name
        avatar_url
        role
      }
      start_date
      due_date
      actual_start_date
      actual_end_date
      effort
      progress
      created_by
      created_at
      updated_at
      is_deleted
      status
      priority
      type_
      category
      tags
      progress_type
      child_tasks {
        task_id
        project_id
        parent_task_id
        title
        assignee {
          user_id
          username
          full_name
          avatar_url
          role
        }
        start_date
        due_date
        effort
        progress
        status
        priority
        type_
        category
      }
    }
  }
`;

export const GET_TASK_BY_ID = gql`
  query GetTaskById($taskId: ID!) {
    task(task_id: $taskId) {
      task_id
      title
      description
      status
      priority
      effort
      progress
      start_date
      due_date
      actual_start_date
      actual_end_date
      created_at
      updated_at
      project_id
      parent_task_id
      assignee {
        user_id
        username
        full_name
        avatar_url
        role
      }
      creator {
        user_id
        username
        full_name
        avatar_url
        role
      }
      priority_order
      type_
      category
      progress_type
      tags
    }
  }
`;

export const GET_PROJECT_TASKS_PAGINATED = gql`
  query GetTasksPaginated(
    $projectId: ID!
    $page: Int
    $pageSize: Int
    $filters: TaskFiltersInput
  ) {
    tasks_paginated(
      project_id: $projectId
      page: $page
      page_size: $pageSize
      filters: $filters
    ) {
      tasks {
        task_id
        project_id
        parent_task_id
        title
        assignee {
          user_id
          username
          full_name
          avatar_url
          role
        }
        start_date
        due_date
        actual_start_date
        actual_end_date
        effort
        progress
        created_by
        created_at
        updated_at
        is_deleted
        status
        priority
        type_
        category
        tags
        progress_type
        child_tasks {
          task_id
          project_id
          parent_task_id
          title
          assignee {
            user_id
            username
            full_name
            avatar_url
            role
          }
          start_date
          due_date
          effort
          progress
          status
          priority
          type_
          category
        }
      }
      pagination {
        total_items
        total_pages
        current_page
        page_size
      }
    }
  }
`;

export const GET_TASK_COMMENTS = gql`
  query GetTaskComments($taskId: ID!) {
    task_comments(task_id: $taskId) {
      id
      task_id
      user_id
      content
      username
      avatar_url
      created_at
      updated_at
    }
  }
`;

export const GET_TASK_SUBTASKS = gql`
  query GetTaskSubtasks($taskId: ID!) {
    task_subtasks(task_id: $taskId) {
      task_id
      title
      description
      status
      priority
      effort
      progress
      start_date
      due_date
      assignee {
        user_id
        username
        full_name
        avatar_url
        role
      }
      priority_order
      type_
      category
    }
  }
`;

export const GET_TASK_BASIC_INFO = gql`
  query GetTaskBasicInfo($taskId: ID!) {
    task(task_id: $taskId) {
      task_id
      title
      project_id
    }
  }
`;
