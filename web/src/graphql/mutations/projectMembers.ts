import { gql } from '@apollo/client';

export const ADD_PROJECT_MEMBER = gql`
  mutation AddProjectMember($projectId: ID!, $input: AddMemberInput!) {
    add_project_member(project_id: $projectId, input: $input) {
      member_id
      user_id
      role
      joined_at
      user {
        user_id
        email
        username
        full_name
        avatar_url
      }
    }
  }
`;

export const UPDATE_MEMBER_ROLE = gql`
  mutation UpdateMemberRole($projectId: ID!, $input: UpdateMemberRoleInput!) {
    update_member_role(project_id: $projectId, input: $input) {
      member_id
      user_id
      role
      joined_at
      user {
        user_id
        email
        username
        full_name
        avatar_url
      }
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

export const UPDATE_MULTIPLE_MEMBER_ROLES = gql`
  mutation UpdateMultipleMemberRoles($projectId: ID!, $updates: [MemberRoleUpdate!]!) {
    update_multiple_members(project_id: $projectId, updates: $updates) {
      success_count
      members {
        member_id
        project_id
        user_id
        role
        joined_at
        user {
          user_id
          email
          username
          full_name
          avatar_url
        }
      }
    }
  }
`;

export const REMOVE_PROJECT_MEMBER = gql`
  mutation RemoveProjectMember($projectId: ID!, $userId: ID!) {
    remove_project_member(project_id: $projectId, user_id: $userId)
  }
`;

export const REMOVE_MULTIPLE_PROJECT_MEMBERS = gql`
  mutation RemoveMultipleProjectMembers($projectId: ID!, $memberIds: [ID!]!) {
    remove_multiple_project_members(project_id: $projectId, member_ids: $memberIds) {
      success_count
      failed_count
    }
  }
`;
