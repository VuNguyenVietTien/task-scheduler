import { gql } from '@apollo/client';

export const GET_NOTIFICATIONS = gql`
  query GetNotifications {
    notifications {
      notificationId
      userId
      message
      type
      isRead
      createdAt
    }
  }
`;

export const GET_NOTIFICATION = gql`
  query GetNotification($notificationId: UUID!) {
    notification(notificationId: $notificationId) {
      notificationId
      type
      message
      isRead
      createdAt
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