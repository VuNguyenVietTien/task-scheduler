import { gql } from '@apollo/client';

export const GET_NOTIFICATIONS = gql`
  query GetNotifications {
    notifications {
      id
      userId
      title
      message
      type
      read
      createdAt
      updatedAt
    }
  }
`;

export const GET_NOTIFICATION = gql`
  query GetNotification($id: UUID!) {
    notification(id: $id) {
      id
      type
      title
      message
      read
      created_at
      metadata
    }
  }
`;

export const GET_NOTIFICATION_COUNT = gql`
  query GetNotificationCount {
    notificationCount {
      total
      unread
    }
  }
`; 