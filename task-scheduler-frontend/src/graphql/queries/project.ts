import { gql } from '@apollo/client';

export const GET_USER_PROJECTS = gql`
  query GetUserProjects($userId: ID!) {
    projects(userId: $userId) {
      id
      name
      startDate
      endDate 
      status
      memberCount
      progress
      category
      priority
      visibility
      iconUrl
      owner {
        userId
        email
        username
        fullName
        avatarUrl
      }
    }
  }
`;