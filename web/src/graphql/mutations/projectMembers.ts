import { gql } from '@apollo/client';

export const ADD_PROJECT_MEMBER = gql`
  mutation AddProjectMember($input: AddProjectMemberInput!) {
    add_project_member(input: $input) {
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

// update_member_role does not exist in the Rust schema; single-role updates use
// update_project_member (positional args), mirrored here.
export const UPDATE_MEMBER_ROLE = gql`
  mutation UpdateMemberRole($project_id: ID!, $user_id: ID!, $role: MemberRole!) {
    update_project_member(project_id: $project_id, user_id: $user_id, role: $role) {
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

export const UPDATE_MULTIPLE_MEMBER_ROLES = gql`
  mutation UpdateMultipleMemberRoles($projectId: ID!, $updates: [MemberRoleUpdate!]!) {
    update_multiple_members(project_id: $projectId, updates: $updates) {
      success_count
      members {
        user_id
        role
        joined_at
        user {
          id
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
