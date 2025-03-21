import { gql } from '@apollo/client';

export const ADD_PROJECT_MEMBER = gql`
  mutation AddProjectMember($projectId: ID!, $email: String!, $role: ProjectRole!) {
    addProjectMemberByEmail(projectId: $projectId, email: $email, role: $role) {
      userId
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
  mutation UpdateProjectMemberRole($projectId: ID!, $userId: ID!, $role: ProjectRole!) {
    updateProjectMember(projectId: $projectId, userId: $userId, role: $role) {
      userId
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