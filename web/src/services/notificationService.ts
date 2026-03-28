import { ApolloClient } from '@apollo/client';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { gql } from '@apollo/client';

// FCM token registration mutation
const SAVE_FCM_TOKEN = gql`
  mutation RegisterFcmToken($token: String!) {
    register_fcm_token(token: $token)
  }
`;

// Notification queries
const GET_NOTIFICATIONS = gql`
  query GetNotifications {
    getNotifications {
      notificationId
      type
      message
      isRead
      createdAt
      projectId
      taskId
      senderId
    }
  }
`;

const GET_NOTIFICATION_COUNT = gql`
  query GetNotificationCount {
    getNotificationCount {
      total
      unread
    }
  }
`;

const MARK_NOTIFICATION_AS_READ = gql`
  mutation MarkNotificationAsRead($notificationId: String!) {
    markNotificationAsRead(notificationId: $notificationId)
  }
`;

const MARK_ALL_NOTIFICATIONS_AS_READ = gql`
  mutation MarkAllNotificationsAsRead {
    markAllNotificationsAsRead
  }
`;

const CREATE_NOTIFICATION = gql`
  mutation CreateNotification($input: CreateNotificationInput!) {
    createNotification(input: $input) {
      notificationId
      type
      message
      isRead
      createdAt
    }
  }
`;

// Thêm định nghĩa type
interface CreateNotificationInput {
  userId: string;
  message: string;
  type: string;
  projectId?: string;
  taskId?: string;
  commentId?: string;
  senderId?: string;
}

export class NotificationService {
  private apolloClient: ApolloClient<any>;
  // Add static token tracking to prevent duplicate registrations
  private static registeredToken: string | null = null;
  private static isRegistering: boolean = false;

  constructor(apolloClient: ApolloClient<any>) {
    this.apolloClient = apolloClient;
  }

  async getNotifications(): Promise<any[]> {
    const { data } = await this.apolloClient.query({
      query: GET_NOTIFICATIONS,
      fetchPolicy: 'network-only' // Don't use cache for notifications
    });
    return data.getNotifications;
  }

  async getNotificationCount(): Promise<any> {
    const { data } = await this.apolloClient.query({
      query: GET_NOTIFICATION_COUNT,
      fetchPolicy: 'network-only' // Don't use cache for notification counts
    });
    return data.getNotificationCount;
  }

  async markNotificationAsRead(id: string): Promise<boolean> {
    const { data } = await this.apolloClient.mutate({
      mutation: MARK_NOTIFICATION_AS_READ,
      variables: { notificationId: id },
    });
    return data.markNotificationAsRead;
  }

  async markAllNotificationsAsRead(): Promise<boolean> {
    const { data } = await this.apolloClient.mutate({
      mutation: MARK_ALL_NOTIFICATIONS_AS_READ,
    });
    return data.markAllNotificationsAsRead;
  }

  async createNotification(input: any): Promise<any> {
    const { data } = await this.apolloClient.mutate({
      mutation: CREATE_NOTIFICATION,
      variables: { input },
    });
    return data.createNotification;
  }

  async initializeFcm(onMessageCallback: (payload: any) => void): Promise<string | null> {
    try {
      console.log('[NotificationService] Starting FCM initialization...');
      
      // Kiểm tra hỗ trợ trình duyệt
      if (!('serviceWorker' in navigator)) {
        console.error('[NotificationService] Service Workers not supported in this browser');
        return null;
      }
      
      if (!('Notification' in window)) {
        console.error('[NotificationService] Notifications not supported in this browser');
        return null;
      }
      
      // Khởi tạo Firebase app nếu chưa có
      let app;
      try {
        const { getApp } = await import('firebase/app');
        app = getApp();
        console.log('[NotificationService] Using existing Firebase app');
      } catch (error) {
        console.log('[NotificationService] Initializing new Firebase app');
        const { initializeApp } = await import('firebase/app');
        const firebaseConfig = {
          apiKey: "AIzaSyBlW27-Kk7j32MaEqlQMmlZzeuPDPQPcH0",
          authDomain: "task-scheduler-bb2c0.firebaseapp.com",
          projectId: "task-scheduler-bb2c0",
          storageBucket: "task-scheduler-bb2c0.appspot.com",
          messagingSenderId: "1057495215001",
          appId: "1:1057495215001:web:f45c7f9ae1fa4a68a9d2f9"
        };
        app = initializeApp(firebaseConfig);
      }
      
      console.log('[NotificationService] Firebase app initialized successfully');
      
      // Kiểm tra quyền thông báo
      let permission = Notification.permission;
      console.log('[NotificationService] Current notification permission:', permission);
      
      if (permission !== 'granted') {
        console.log('[NotificationService] Requesting notification permission...');
        permission = await Notification.requestPermission();
        console.log('[NotificationService] Permission response:', permission);
        if (permission !== 'granted') {
          console.error('[NotificationService] Notification permission denied');
          return null;
        }
      }
      
      console.log('[NotificationService] Notification permission granted');
      
      // Đảm bảo Service Worker được đăng ký
      try {
        console.log('[NotificationService] Checking for service worker registration');
        const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        console.log('[NotificationService] Service Worker registration status:', registration ? 'found' : 'not found');
        
        if (!registration) {
          console.log('[NotificationService] Registering service worker explicitly...');
          await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
            scope: '/'
          });
          await new Promise(resolve => setTimeout(resolve, 1000));
          console.log('[NotificationService] Service Worker registered successfully');
        }
      } catch (swError) {
        console.error('[NotificationService] Service Worker registration error:', swError);
      }
      
      // Lấy instance messaging
      const { getMessaging, getToken, onMessage } = await import('firebase/messaging');
      const messaging = getMessaging(app);
      console.log('[NotificationService] Firebase messaging instance created');
      
      // Lấy FCM token
      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
      }).catch(error => {
        console.warn('[NotificationService] Error getting FCM token:', error);
        return null;
      });
      
      if (token) {
        console.log('[NotificationService] FCM token obtained successfully');
        
        // Check if we've already registered this token
        if (NotificationService.registeredToken === token) {
          console.log('[NotificationService] Token already registered with server, skipping registration');
        } else if (NotificationService.isRegistering) {
          console.log('[NotificationService] Token registration in progress, skipping duplicate request');
        } else {
          // Save token to server (only once)
          NotificationService.isRegistering = true;
          await this.saveTokenToServer(token);
          NotificationService.registeredToken = token;
          NotificationService.isRegistering = false;
        }
        
        // Thiết lập handler thông báo
        console.log('[NotificationService] Setting up foreground message handler');
        onMessage(messaging, (payload) => {
          console.log('[NotificationService] 🔔 Foreground message received:', payload);
          // Dispatch custom event để useNotificationsRedux xử lý
          const event = new CustomEvent('notificationReceived', {
            detail: { payload }
          });
          window.dispatchEvent(event);
        });
        
        return token;
      }
      
      console.error('[NotificationService] FCM token request failed');
      return null;
    } catch (error) {
      console.error('[NotificationService] Error in initializeFcm:', error);
      NotificationService.isRegistering = false;
      return null;
    }
  }

  async saveTokenToServer(token: string) {
    try {
      console.log('[NotificationService] Saving FCM token to server...');
      
      const response = await this.apolloClient.mutate({
        mutation: SAVE_FCM_TOKEN,
        variables: {
          token
        }
      });
      
      console.log('[NotificationService] Token saved to server response:', response);
      
      if (response.data?.register_fcm_token) {
        console.log('[NotificationService] Token saved successfully to server');
        return true;
      } else {
        console.error('[NotificationService] Server rejected token save');
        NotificationService.isRegistering = false;
        return false;
      }
    } catch (error) {
      console.error('[NotificationService] Error saving token to server:', error);
      NotificationService.isRegistering = false;
      return false;
    }
  }
  
  async unregisterFcmToken(token: string) {
    try {
      console.log('[NotificationService] Unregistering FCM token from server:', token);
      // Implement your unregister mutation here
      return true;
    } catch (error) {
      console.error('[NotificationService] Error unregistering FCM token:', error);
      return false;
    }
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
      message: `${commenterName} mentioned you in a comment on task "${taskTitle}"`,
      type: 'COMMENT_MENTION',
      projectId,
      taskId
    };
    
    return this.createNotification(input);
  }
} 