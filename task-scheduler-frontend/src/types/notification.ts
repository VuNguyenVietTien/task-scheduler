export type NotificationType = 'TASK_ASSIGNED' | 'TASK_REASSIGNED' | 'TASK_COMPLETED' | 'TASK_OVERDUE' | 'COMMENT_MENTION';

export interface BackendNotification {
  id: string;
  userId: string;
  type: string;
  referenceType: string;
  referenceId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  projectId?: string;
  senderId?: string;
  action: string;
  metadata: any;
}

// Interface for UI components - camelCase for frontend use
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  projectId?: string;
  taskId?: string;
  commentId?: string;
  senderId?: string;
  link?: string;
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
  title: string;
  message: string;
  type: NotificationType;
  projectId?: string;
  taskId?: string;
  commentId?: string;
  senderId?: string;
}

export interface NotificationQueryResponse {
  notifications: BackendNotification[];
}

export interface NotificationCountQueryResponse {
  notificationCount: NotificationCount;
}
