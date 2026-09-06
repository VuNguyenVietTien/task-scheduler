import { gql } from '@apollo/client';

export const INVITE_PROJECT_MEMBER = gql`
  mutation AddProjectMemberByEmail($project_id: ID!, $email: String!, $role: MemberRole!) {
    add_project_member_by_email(project_id: $project_id, email: $email, role: $role) {
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

// Canonical alias: Rust schema op is add_project_member_by_email (invite_project_member does not exist)
export const ADD_PROJECT_MEMBER_BY_EMAIL = INVITE_PROJECT_MEMBER;

export const UPDATE_PROJECT_MEMBER_ROLE = gql`
  mutation UpdateProjectMemberRole($project_id: ID!, $user_id: ID!, $role: MemberRole!) {
    update_project_member(project_id: $project_id, user_id: $user_id, role: $role) {
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

// RESIDUAL (W3 audit): update_member_position has NO Rust backend op in
// backend/schema.graphql (ProjectMember has no `position` field). Kept for the
// legacy server SDL until a Rust op exists; will fail against the Rust endpoint.
export const UPDATE_MEMBER_POSITION = gql`
  mutation UpdateMemberPosition($project_id: ID!, $user_id: ID!, $position: String) {
    update_member_position(project_id: $project_id, user_id: $user_id, position: $position) {
      user {
        user_id
        email
        full_name
        username
        avatar_url
      }
      role
      joined_at
      position
    }
  }
`;
