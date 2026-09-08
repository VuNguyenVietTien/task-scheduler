import { gql } from '@apollo/client';

export const GET_USER_PROJECTS = gql`
  query GetUserProjects {
    projects {
      project_id
      name
      start_date
      end_date
      status
      member_count
      progress
      category
      priority
      visibility
      icon_url
      owner {
        user_id
        email
        username
        full_name
        avatar_url
      }
    }
  }
`;

export const GET_PROJECT_BY_ID = gql`
  query GetProjectById($projectId: ID!) {
    project(project_id: $projectId) {
      project_id
      name
      description
      created_at
      priority
      visibility
      tags
      progress
      category
      metadata
      start_date
      end_date
      icon_url
      is_public
      status
      member_count
      user_role
      owner {
        user_id
        email
        username
        full_name
        avatar_url
      }
      members {
        role
        joined_at
        user {
          user_id
          email
          full_name
          username
          avatar_url
        }
      }
    }
  }
`;

export const UPDATE_PROJECT_NAME = gql`
  mutation UpdateProjectName($projectId: ID!, $name: String!) {
    update_project(project_id: $projectId, name: $name)
  }
`;

export const CREATE_PROJECT = gql`
  mutation CreateProject($input: CreateProjectInput!) {
    create_project(input: $input) {
      project_id
      name
      description
      start_date
      end_date
      status
      priority
      visibility
      tags
      category
      metadata
      icon_url
      is_public
      created_at
      owner {
        user_id
        email
        username
        full_name
        avatar_url
      }
    }
  }
`;
