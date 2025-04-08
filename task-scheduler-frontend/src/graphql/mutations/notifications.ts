import { gql } from '@apollo/client';

export const CREATE_NOTIFICATION = gql`
  mutation CreateNotification($input: CreateNotificationInput!) {
    create_notification(input: $input) {
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

export const MARK_NOTIFICATION_AS_READ = gql`
  mutation MarkNotificationAsRead($id: UUID!) {
    mark_notification_as_read(id: $id) {
      success
    }
  }
`;

export const MARK_ALL_NOTIFICATIONS_AS_READ = gql`
  mutation MarkAllNotificationsAsRead {
    mark_all_notifications_as_read {
      success
    }
  }
`; 