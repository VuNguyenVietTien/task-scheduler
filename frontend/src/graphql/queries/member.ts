import { gql } from '@apollo/client';

export const GET_PROJECT_MEMBERS = gql`
  query ProjectMembers($projectId: ID!) {
    projectMembers(projectId: $projectId) {
      role
      joinedAt
      user {
        userId
        email
        fullName
        username
        avatarUrl
      }
    }
    myProjectRole(projectId: $projectId)
  }
`;

export const GET_MY_PROJECT_ROLE = gql`
  query MyProjectRole($projectId: ID!) {
    myProjectRole(projectId: $projectId)
  }
`; 