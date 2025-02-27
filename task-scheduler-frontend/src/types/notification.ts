export interface Notification {
  id: string;
  title: string;
  content: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
}
