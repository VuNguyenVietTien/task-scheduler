export enum NotificationType {
  TASK_ASSIGNMENT = 'TASK_ASSIGNMENT',
  TASK_REASSIGNMENT = 'TASK_REASSIGNMENT',
  TASK_COMPLETION = 'TASK_COMPLETION',
  TASK_DUE_SOON = 'TASK_DUE_SOON',
  TASK_OVERDUE = 'TASK_OVERDUE',
  PROJECT_INVITATION = 'PROJECT_INVITATION',
  PROJECT_ROLE_CHANGE = 'PROJECT_ROLE_CHANGE',
  PROJECT_REMOVAL = 'PROJECT_REMOVAL',
  SYSTEM = 'SYSTEM'
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any>;
}

export interface NotificationCount {
  total: number;
  unread: number;
}

export interface NotificationResponse {
  notifications: Notification[];
  notificationCount: NotificationCount;
}

export interface SingleNotificationResponse {
  notification: Notification;
}

export interface MarkNotificationAsReadResponse {
  success: boolean;
}

export interface MarkAllNotificationsAsReadResponse {
  success: boolean;
}

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  user_id: string;
} 