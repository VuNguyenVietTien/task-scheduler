import { gql } from '@apollo/client';

export const GET_NOTIFICATIONS = gql`
  query GetNotifications {
    notifications {
      id
      userId
      projectId
      senderId
      type
      referenceType
      referenceId
      message
      action
      metadata
      isRead
      createdAt
    }
  }
`;

export const GET_NOTIFICATION = gql`
  query GetNotification($id: UUID!) {
    notification(id: $id) {
      notificationId
      userId
      projectId
      senderId
      type
      referenceType
      referenceId
      message
      action
      metadata
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