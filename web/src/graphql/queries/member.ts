import { gql } from '@apollo/client';

export const GET_PROJECT_MEMBERS = gql`
  query ProjectMembers($projectId: ID!) {
    project_members(project_id: $projectId) {
      role
      joined_at
      position
      user {
        user_id
        email
        full_name
        username
        avatar_url
      }
    }
    my_project_role(project_id: $projectId)
  }
`;

export const GET_MY_PROJECT_ROLE = gql`
  query MyProjectRole($projectId: ID!) {
    my_project_role(project_id: $projectId)
  }
`;
