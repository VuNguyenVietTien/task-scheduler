import { gql } from '@apollo/client';

export const NOTIFICATION_SUBSCRIPTION = gql`
  subscription OnNotificationReceived {
    notificationReceived {
      id
      userId
      type
      referenceType
      referenceId
      message
      action
      metadata
      isRead
      createdAt
      projectId
      senderId
    }
  }
`; 