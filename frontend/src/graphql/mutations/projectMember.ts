import { gql } from '@apollo/client';

export const ADD_PROJECT_MEMBER_BY_EMAIL = gql`
  mutation AddProjectMemberByEmail($projectId: ID!, $email: String!, $role: MemberRole!) {
    addProjectMemberByEmail(projectId: $projectId, email: $email, role: $role) {
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

export const REMOVE_PROJECT_MEMBER = gql`
  mutation RemoveProjectMember($projectId: ID!, $userId: ID!) {
    removeProjectMember(projectId: $projectId, userId: $userId)
  }
`; 