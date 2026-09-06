import { gql } from '@apollo/client';

export const GET_PROJECTS = gql`
  query GetProjects {
    projects {
      project_id
      name
      priority
      visibility
      progress
      category
      start_date
      end_date
      icon_url
      status
      member_count
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

// NOTE (W3 audit): the Rust `projects` root returns the lightweight `Projects`
// type — no description/tags/metadata/is_public/created_by fields. Consumers
// needing those must use project(project_id) instead.

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
