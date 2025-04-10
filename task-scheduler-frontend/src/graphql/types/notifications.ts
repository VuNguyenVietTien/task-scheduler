export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  metadata: Record<string, any>;
}

export interface NotificationCount {
  count: number;
}

export interface NotificationResponse {
  notifications: Notification[];
  notification_count: NotificationCount;
}

export interface MarkNotificationAsReadResponse {
  markNotificationAsRead: {
    notificationId: string;
    isRead: boolean;
  };
}

export interface MarkAllNotificationsAsReadResponse {
  markAllNotificationsAsRead: {
    success: boolean;
  };
} 