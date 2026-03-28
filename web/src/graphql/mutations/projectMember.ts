import { gql } from '@apollo/client';

export const ADD_PROJECT_MEMBER_BY_EMAIL = gql`
  mutation AddProjectMemberByEmail($input: AddProjectMemberInput!) {
    add_project_member(input: $input) {
      user {
        user_id
        email
        full_name
        username
        avatar_url
      }
      role
      joined_at
    }
  }
`;

export const UPDATE_PROJECT_MEMBER_ROLE = gql`
  mutation UpdateProjectMemberRole($input: UpdateProjectMemberInput!) {
    update_project_member(input: $input) {
      user {
        user_id
        email
        full_name
        username
        avatar_url
      }
      role
      joined_at
    }
  }
`;

export const REMOVE_PROJECT_MEMBER = gql`
  mutation RemoveProjectMember($project_id: ID!, $user_id: ID!) {
    remove_project_member(project_id: $project_id, user_id: $user_id)
  }
`;
