import { gql } from '@apollo/client';

export const CREATE_NOTIFICATION = gql`
  mutation CreateNotification($input: CreateNotificationInput!) {
    create_notification(input: $input) {
      notification_id
      type_
      message
      is_read
      created_at
      metadata
    }
  }
`;

export const MARK_NOTIFICATION_AS_READ = gql`
  mutation MarkNotificationAsRead($notificationId: ID!) {
    mark_notification_as_read(notification_id: $notificationId) {
      notification_id
      is_read
    }
  }
`;

export const MARK_ALL_NOTIFICATIONS_AS_READ = gql`
  mutation MarkAllNotificationsAsRead {
    mark_all_notifications_as_read
  }
`;
