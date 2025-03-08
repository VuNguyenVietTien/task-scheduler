import { gql } from '@apollo/client';

export const GET_USER_PROJECTS = gql`
  query GetUserProjects {
    projects {
      id: projectId
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

export const GET_PROJECT_BY_ID = gql`
  query GetProjectById($projectId: ID!) {
    project(projectId: $projectId) {
      id: projectId 
      name
      description
      createdAt
      priority
      visibility
      tags
      progress
      category
      metadata
      startDate
      endDate
      iconUrl
      isPublic
      status
      memberCount
      owner {
        userId
        email
        username
        fullName
        avatarUrl
      }
      members {
        userId
        username
        avatarUrl
        role
      }
    }
  }
`;