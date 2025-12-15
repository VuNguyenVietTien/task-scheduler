import { gql } from '@apollo/client';

export const GET_USERS = gql`
  query GetUsers {
    users {
      id
      fullName
      email
      avatarUrl
      role
    }
  }
`;

export const GET_USER_BY_ID = gql`
  query GetUserById($userId: ID!) {
    user(userId: $userId) {
      id
      username
      fullName
      email
      avatarUrl
      role
    }
  }
`;