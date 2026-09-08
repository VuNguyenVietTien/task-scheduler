import { gql } from '@apollo/client';

// List and update mutations intentionally select the same task contract. Keep
// this fragment authoritative: callers normalize only returned task objects.
export const TASK_FIELDS = gql`
  fragment TaskFields on Task {
    task_id
    project_id
    parent_task_id
    title
    description
    assignee_resource_member_id
    assignee { user_id username full_name avatar_url role }
    creator { user_id username full_name avatar_url role }
    priority_order
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
    progress_catalog_item_id
    category_catalog_item_id
    task_type_catalog_item_id
  }
`;

export const TASK_WITH_CHILDREN_FIELDS = gql`
  ${TASK_FIELDS}
  fragment TaskWithChildrenFields on Task {
    ...TaskFields
    child_tasks {
      ...TaskFields
      child_tasks { ...TaskFields }
    }
  }
`;

export const GET_PROJECT_TASKS = gql`
  ${TASK_WITH_CHILDREN_FIELDS}
  query GetTasks($projectId: ID!) {
    tasks(project_id: $projectId) { ...TaskWithChildrenFields }
  }
`;

export const TASK_TREE_ROWS = gql`
  ${TASK_FIELDS}
  query TaskTreeRows($projectId: ID!) {
    task_tree_rows(project_id: $projectId) { ...TaskFields }
  }
`;

export const GET_TASK_BY_ID = gql`
  ${TASK_WITH_CHILDREN_FIELDS}
  query GetTaskById($taskId: ID!) {
    task(task_id: $taskId) { ...TaskWithChildrenFields }
  }
`;

export const GET_PROJECT_TASKS_PAGINATED = gql`
  ${TASK_WITH_CHILDREN_FIELDS}
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
      tasks { ...TaskWithChildrenFields }
      pagination { total_items total_pages current_page page_size }
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
  ${TASK_FIELDS}
  query GetTaskSubtasks($taskId: ID!) {
    task_subtasks(task_id: $taskId) { ...TaskFields }
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
