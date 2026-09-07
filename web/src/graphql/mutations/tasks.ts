import { gql } from '@apollo/client';

export const UPDATE_TASK_STATUS = gql`
  mutation UpdateTaskStatus($input: UpdateTaskStatusInput!) {
    update_task_status(input: $input) {
      task_id
      project_id
      parent_task_id
      title
      description
      assignee_resource_member_id
      assignee {
        user_id
        username
        full_name
        avatar_url
        role
      }
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
    }
  }
`;

export const UPDATE_TASK_EFFORT = gql`
  mutation UpdateTaskEffort($input: UpdateTaskEffortInput!) {
    update_task_effort(input: $input) {
      task_id
      project_id
      parent_task_id
      title
      description
      assignee_resource_member_id
      assignee {
        user_id
        username
        full_name
        avatar_url
        role
      }
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
    }
  }
`;

export const UPDATE_TASK = gql`
  mutation UpdateTask($input: UpdateTaskInput!) {
    update_task(input: $input) {
      task_id
      project_id
      parent_task_id
      title
      description
      assignee_resource_member_id
      assignee {
        user_id
        username
        full_name
        avatar_url
        role
      }
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
    }
  }
`;

export const CREATE_TASK_COMMENT = gql`
  mutation CreateTaskComment($input: CreateCommentInput!) {
    create_comment(input: $input) {
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

export const DELETE_TASK_COMMENT = gql`
  mutation DeleteTaskComment($commentId: ID!) {
    delete_comment(id: $commentId)
  }
`;

// Rust schema: reorder_tasks(input: ReorderTasksInput!): [Task!]!
// Returns the full updated Task list (NOT a boolean/wrapper) — callers must
// treat the result as Task[] keyed by task_id.
export const REORDER_TASKS = gql`
  mutation ReorderTasks($input: ReorderTasksInput!) {
    reorder_tasks(input: $input) {
      task_id
      priority_order
      status
      title
    }
  }
`;
