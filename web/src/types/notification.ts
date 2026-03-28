export type NotificationType = 'TASK_ASSIGNED' | 'TASK_REASSIGNED' | 'TASK_COMPLETED' | 'TASK_OVERDUE' | 'COMMENT_MENTION' | 'TASK_COMMENT' | 'COMMENT_MENTION';
// column_name               |
// --------------------------+
// notification_id           |
// user_id                   |
// type                      |
// reference_type            |
// reference_id              |
// message                   |
// is_read                   |
// created_at                |
// project_id                |
// sender_id                 |
// action                    |
// metadata                  |
export interface BackendNotification {
  notification_id?: string;
  user_id: string;
  message: string;
  type: string;
  reference_type: string;
  reference_id: string;
  is_read: boolean;
  created_at: string;
  project_id?: string;
  sender_id?: string;
  action: string;
  metadata?: {
    project_id: string;
    task_id: string;
    comment_id?: string;
    task_title?: string;
  };
}

// Interface for UI components - camelCase for frontend use
export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  projectId?: string;
  taskId?: string;
  commentId?: string;
  senderId?: string;
  metadata?: {
    project_id: string;
    task_id: string;
    comment_id?: string;
    task_title?: string;
  };
}

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
}

export interface NotificationCount {
  total: number;
  unread: number;
}

export interface CreateNotificationInput {
  userId: string;
  message: string;
  type: NotificationType;
  projectId?: string;
  taskId?: string;
  commentId?: string;
  senderId?: string;
}

// Response interfaces updated for new naming convention
export interface NotificationQueryResponse {
  getNotifications?: BackendNotification[];
  notifications?: BackendNotification[];  // Fallback for backward compatibility
}

export interface NotificationCountQueryResponse {
  getNotificationCount?: NotificationCount;
  notificationCount?: NotificationCount;  // Fallback for backward compatibility
}
