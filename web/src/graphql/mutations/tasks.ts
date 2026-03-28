import { gql } from '@apollo/client';

export const UPDATE_TASK_STATUS = gql`
  mutation UpdateTaskStatus($input: UpdateTaskStatusInput!) {
    update_task_status(input: $input) {
      task_id
      project_id
      parent_task_id
      title
      description
      assignee {
        user_id
        username
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
      assignee {
        user_id
        username
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
      assignee {
        user_id
        username
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
      content
      author_id
      username
      created_at
      updated_at
    }
  }
`;

export const DELETE_TASK_COMMENT = gql`
  mutation DeleteTaskComment($commentId: ID!) {
    delete_comment(comment_id: $commentId)
  }
`;
