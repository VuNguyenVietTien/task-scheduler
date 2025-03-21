import { gql } from '@apollo/client';

export const GET_USER_PROJECTS = gql`
  query GetUserProjects {
    projects {
      projectId
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
      projectId
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
    }
  }
`;

export const CREATE_PROJECT = gql`
  mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      projectId
      name
      description
      startDate
      endDate 
      status
      priority
      visibility
      tags
      category
      metadata
      iconUrl
      isPublic
      createdAt
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