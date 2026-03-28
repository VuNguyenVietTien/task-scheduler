import { gql } from '@apollo/client';

export const GET_USERS = gql`
  query GetUsers {
    users {
      user_id
      full_name
      email
      avatar_url
      role
    }
  }
`;

export const GET_USER_BY_ID = gql`
  query GetUserById($userId: ID!) {
    user(user_id: $userId) {
      user_id
      username
      full_name
      email
      avatar_url
      role
    }
  }
`;
