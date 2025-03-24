import { gql } from '@apollo/client';

export const GET_USERS = gql`
  query GetUsers {
    users {
      userId
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
      userId
      username
      fullName
      email
      avatarUrl
      role
    }
  }
`;