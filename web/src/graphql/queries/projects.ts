import { gql } from '@apollo/client';

export const GET_PROJECTS = gql`
  query GetProjects {
    projects {
      projectId
      name 
      description
      owner
      createdBy
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
        name
        avatarUrl
      }
    }
  }
`;

export const GET_PROJECT_BY_ID = gql`
  query GetProjectById($projectId: UUID!) {
    project(project_id: $projectId) {
      projectId
      name
      description 
      owner
      createdBy
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
        name
        avatarUrl
      }
      members {
        userId
        email
        name
        avatarUrl
        role
        joinedAt
      }
    }
  }
`;