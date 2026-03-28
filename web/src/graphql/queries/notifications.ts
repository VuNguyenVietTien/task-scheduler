import { gql } from '@apollo/client';

export const GET_NOTIFICATIONS = gql`
  query GetNotifications {
    notifications {
      notification_id
      user_id
      message
      type_
      is_read
      created_at
      metadata
    }
  }
`;

export const GET_NOTIFICATION = gql`
  query GetNotification($notificationId: ID!) {
    notification(id: $notificationId) {
      notification_id
      type_
      message
      is_read
      created_at
      metadata
    }
  }
`;

export const GET_NOTIFICATION_COUNT = gql`
  query GetNotificationCount {
    notification_count {
      total
      unread
    }
  }
`;
