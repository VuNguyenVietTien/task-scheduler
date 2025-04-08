import { ApolloClient, InMemoryCache } from '@apollo/client';
import {
  GET_NOTIFICATIONS,
  GET_NOTIFICATION_COUNT,
} from '@/graphql/queries/notifications';
import { 
  CREATE_NOTIFICATION,
  MARK_NOTIFICATION_AS_READ,
  MARK_ALL_NOTIFICATIONS_AS_READ
} from '@/graphql/mutations/notifications';
import { 
  Notification, 
  NotificationCount, 
  CreateNotificationInput,
  NotificationType
} from '@/types/notification';

export class NotificationService {
  constructor(private client: ApolloClient<InMemoryCache>) {}

  async getNotifications(): Promise<Notification[]> {
    const { data } = await this.client.query({
      query: GET_NOTIFICATIONS,
    });
    return data.notifications;
  }

  async getNotificationCount(): Promise<NotificationCount> {
    const { data } = await this.client.query({
      query: GET_NOTIFICATION_COUNT,
    });
    return data.notificationCount;
  }

  async markNotificationAsRead(id: string): Promise<boolean> {
    const { data } = await this.client.mutate({
      mutation: MARK_NOTIFICATION_AS_READ,
      variables: { id },
    });
    return data.markNotificationAsRead;
  }

  async markAllNotificationsAsRead(): Promise<boolean> {
    const { data } = await this.client.mutate({
      mutation: MARK_ALL_NOTIFICATIONS_AS_READ,
    });
    return data.markAllNotificationsAsRead;
  }

  async createNotification(input: CreateNotificationInput): Promise<Notification> {
    const { data } = await this.client.mutate({
      mutation: CREATE_NOTIFICATION,
      variables: { input },
    });
    return data.createNotification;
  }

  async createTaskAssignmentNotification(
    userId: string,
    taskId: string,
    projectId: string,
    taskTitle: string,
    assignerName: string
  ): Promise<Notification> {
    const input: CreateNotificationInput = {
      userId,
      title: `Task Assigned: ${taskTitle}`,
      message: `${assignerName} assigned you to task "${taskTitle}"`,
      type: 'TASK_ASSIGNED',
      projectId,
      taskId
    };
    
    return this.createNotification(input);
  }

  async createTaskReassignmentNotification(
    userId: string,
    taskId: string,
    projectId: string,
    taskTitle: string,
    reassignerName: string
  ): Promise<Notification> {
    const input: CreateNotificationInput = {
      userId,
      title: `Task Reassigned: ${taskTitle}`,
      message: `${reassignerName} reassigned you to task "${taskTitle}"`,
      type: 'TASK_REASSIGNED',
      projectId,
      taskId
    };
    
    return this.createNotification(input);
  }

  async createTaskCompletedNotification(
    userId: string,
    taskId: string,
    projectId: string,
    taskTitle: string,
    completerName: string
  ): Promise<Notification> {
    const input: CreateNotificationInput = {
      userId,
      title: `Task Completed: ${taskTitle}`,
      message: `${completerName} completed task "${taskTitle}"`,
      type: 'TASK_COMPLETED',
      projectId,
      taskId
    };
    
    return this.createNotification(input);
  }

  async createTaskOverdueNotification(
    userId: string,
    taskId: string,
    projectId: string,
    taskTitle: string
  ): Promise<Notification> {
    const input: CreateNotificationInput = {
      userId,
      title: `Task Overdue: ${taskTitle}`,
      message: `Task "${taskTitle}" is overdue`,
      type: 'TASK_OVERDUE',
      projectId,
      taskId
    };
    
    return this.createNotification(input);
  }

  async createCommentMentionNotification(
    userId: string,
    taskId: string,
    projectId: string,
    taskTitle: string,
    commenterName: string
  ): Promise<Notification> {
    const input: CreateNotificationInput = {
      userId,
      title: `Mentioned by ${commenterName}`,
      message: `${commenterName} mentioned you in a comment on task "${taskTitle}"`,
      type: 'COMMENT_MENTION',
      projectId,
      taskId
    };
    
    return this.createNotification(input);
  }
} 