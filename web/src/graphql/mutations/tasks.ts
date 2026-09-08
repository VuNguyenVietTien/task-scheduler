import { gql } from '@apollo/client';
import { TASK_WITH_CHILDREN_FIELDS } from '@/graphql/queries/tasks';

// These mutations share List's exact Task selection. A resolved mutation is
// therefore safe to normalize and replace in Redux without guessing fields.
export const UPDATE_TASK_STATUS = gql`
  ${TASK_WITH_CHILDREN_FIELDS}
  mutation UpdateTaskStatus($input: UpdateTaskStatusInput!) {
    update_task_status(input: $input) { ...TaskWithChildrenFields }
  }
`;

export const UPDATE_TASK_EFFORT = gql`
  ${TASK_WITH_CHILDREN_FIELDS}
  mutation UpdateTaskEffort($input: UpdateTaskEffortInput!) {
    update_task_effort(input: $input) { ...TaskWithChildrenFields }
  }
`;

export const UPDATE_TASK = gql`
  ${TASK_WITH_CHILDREN_FIELDS}
  mutation UpdateTask($input: UpdateTaskInput!) {
    update_task(input: $input) { ...TaskWithChildrenFields }
  }
`;

export const CREATE_TASK = gql`
  mutation CreateTask($input: CreateTaskInput!) {
    create_task(input: $input) {
      task_id
      project_id
      parent_task_id
      title
      description
      status
      priority
      priority_order
      assignee_resource_member_id
      effort
      start_date
      due_date
      type_
      category
      progress_type
      progress_catalog_item_id
      category_catalog_item_id
      task_type_catalog_item_id
      tags
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
