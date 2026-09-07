import { gql } from '@apollo/client';

export const CREATE_TASK = gql`
  mutation CreateTask($input: CreateTaskInput!) {
    create_task(input: $input) {
      task_id
      title
      description
      status
      priority
      priority_order
      assignee_resource_member_id
      assignee {
        user_id
        username
        avatar_url
        role
      }
      effort
      start_date
      due_date
      created_by
      project_id
      type_
      category
      progress_type
      tags
      parent_task_id
    }
  }
`;

export const CLONE_TASK_SUBTREE = gql`
  mutation CloneTaskSubtree($input: CloneTaskSubtreeInput!) {
    clone_task_subtree(input: $input) {
      root_task_ids
      created_task_ids
    }
  }
`;

export const UPDATE_TASK = gql`
  mutation UpdateTask($input: UpdateTaskInput!) {
    update_task(input: $input) {
      task_id
      title
      description
      status
      priority
      priority_order
      assignee {
        user_id
        username
        avatar_url
        role
      }
      effort
      start_date
      due_date
      type_
      category
      progress_type
      tags
    }
  }
`;
