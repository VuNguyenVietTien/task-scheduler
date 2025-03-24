import { gql } from '@apollo/client';

export const ADD_PROJECT_MEMBER = gql`
  mutation AddProjectMember($projectId: ID!, $input: AddMemberInput!) {
    addProjectMember(projectId: $projectId, input: $input) {
      memberId
      userId
      role
      joinedAt
      user {
        id
        email
        username
        fullName
        avatarUrl
      }
    }
  }
`;

export const UPDATE_MEMBER_ROLE = gql`
  mutation UpdateMemberRole($projectId: ID!, $input: UpdateMemberRoleInput!) {
    updateMemberRole(projectId: $projectId, input: $input) {
      memberId
      userId
      role
      joinedAt
      user {
        id
        email
        username
        fullName
        avatarUrl
      }
    }
  }
`;

export const UPDATE_PROJECT_MEMBER_ROLE = gql`
  mutation UpdateProjectMemberRole($projectId: ID!, $userId: ID!, $role: MemberRole!) {
    updateProjectMember(projectId: $projectId, userId: $userId, role: $role) {
      user {
        userId
        email
        fullName
        username
        avatarUrl
      }
      role
      joinedAt
    }
  }
`;

export const UPDATE_MULTIPLE_MEMBER_ROLES = gql`
  mutation UpdateMultipleMemberRoles($projectId: ID!, $updates: [MemberRoleUpdate!]!) {
    updateMultipleMembers(projectId: $projectId, updates: $updates) {
      successCount
      members {
        memberId
        projectId
        userId
        role
        joinedAt
        user {
          id
          email
          username
          fullName
          avatarUrl
        }
      }
    }
  }
`;

export const REMOVE_PROJECT_MEMBER = gql`
  mutation RemoveProjectMember($projectId: ID!, $memberId: ID!) {
    removeProjectMember(projectId: $projectId, memberId: $memberId)
  }
`;

// New mutation for bulk member removal
export const REMOVE_MULTIPLE_PROJECT_MEMBERS = gql`
  mutation RemoveMultipleProjectMembers($projectId: ID!, $memberIds: [ID!]!) {
    removeMultipleProjectMembers(projectId: $projectId, memberIds: $memberIds) {
      successCount
      failedCount
    }
  }
`; 