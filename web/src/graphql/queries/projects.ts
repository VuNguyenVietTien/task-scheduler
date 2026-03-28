import { gql } from '@apollo/client';

export const GET_PROJECTS = gql`
  query GetProjects {
    projects {
      project_id
      name
      description
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
      owner {
        user_id
        email
        username
        full_name
        avatar_url
      }
      created_by {
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
  query GetProjectById($projectId: UUID!) {
    project(project_id: $projectId) {
      project_id
      name
      description
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
          username
          full_name
          avatar_url
        }
      }
    }
  }
`;
