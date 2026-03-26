"use client";

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useApolloClient } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { GET_NOTIFICATIONS, GET_NOTIFICATION_COUNT } from '@/graphql/queries/notifications';
import { MARK_NOTIFICATION_AS_READ, MARK_ALL_NOTIFICATIONS_AS_READ } from '@/graphql/mutations/notifications';
import { NotificationService } from '@/services/notificationService';
import type { Notification, BackendNotification, NotificationType } from '@/types/notification';

export default function useNotifications() {
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const apolloClient = useApolloClient();
  
  // Fetch notifications
  const { 
    data: notificationsData, 
    loading: notificationsLoading, 
    error: notificationsError,
    refetch: refetchNotifications
  } = useQuery(GET_NOTIFICATIONS, {
    fetchPolicy: 'network-only',
    onCompleted: (data) => {
      console.log('[useNotifications] Fetched notifications:', data?.notifications?.length || 0);
    }
  });
  
  // Fetch notification count
  const {
    data: countData,
    loading: countLoading,
    error: countError,
    refetch: refetchCount
  } = useQuery(GET_NOTIFICATION_COUNT, {
    fetchPolicy: 'network-only',
    onCompleted: (data) => {
      if (data?.notificationCount) {
        setUnreadCount(data.notificationCount.unread || 0);
        console.log('[useNotifications] Unread count updated:', data.notificationCount.unread);
      }
    }
  });
  
  // Mark as read mutation
  const [markAsRead] = useMutation(MARK_NOTIFICATION_AS_READ, {
    onCompleted: () => {
      refetchCount();
    }
  });
  
  // Mark all as read mutation
  const [markAllAsRead] = useMutation(MARK_ALL_NOTIFICATIONS_AS_READ, {
    onCompleted: () => {
      refetchCount();
      refetchNotifications();
    }
  });
  
  // Cập nhật lại danh sách thông báo khi nhận được thông báo mới từ FCM
  const handleNotificationReceived = useCallback((event: any) => {
    console.log('[useNotifications] Received notificationReceived event:', event.detail);
    
    // Check if we have the full notification object
    const newNotification = event.detail?.notification;
    if (newNotification) {
      console.log('[useNotifications] Using provided notification object for UI update');
      
      // Directly update local cache with the new notification
      try {
        // Update the notifications cache
        const existingData = apolloClient.readQuery({ 
          query: GET_NOTIFICATIONS 
        });
        
        if (existingData?.notifications) {
          // Check if this notification already exists to prevent duplicates
          const exists = existingData.notifications.some(
            (n: BackendNotification) => n.notificationId === newNotification.notificationId
          );
          
          if (!exists) {
            // Add the new notification to the cache
            apolloClient.writeQuery({
              query: GET_NOTIFICATIONS,
              data: {
                notifications: [newNotification, ...existingData.notifications]
              }
            });
            console.log('[useNotifications] Added new notification to cache:', newNotification.notificationId);
            
            // Update the notification count
            const countData = apolloClient.readQuery({ 
              query: GET_NOTIFICATION_COUNT 
            });
            
            if (countData?.notificationCount) {
              const newUnreadCount = (countData.notificationCount.unread || 0) + 1;
              apolloClient.writeQuery({
                query: GET_NOTIFICATION_COUNT,
                data: {
                  notificationCount: {
                    ...countData.notificationCount,
                    unread: newUnreadCount
                  }
                }
              });
              setUnreadCount(newUnreadCount);
              console.log('[useNotifications] Updated unread count:', newUnreadCount);
            }
          }
        }
      } catch (error) {
        console.error('[useNotifications] Error updating cache with new notification:', error);
      }
    }
    
    // Always refetch to ensure UI is up-to-date
    console.log('[useNotifications] Refetching notifications and counts');
    refetchNotifications();
    refetchCount();
  }, [apolloClient, refetchNotifications, refetchCount]);
  
  // Init FCM and setup event listeners
  const initFcm = useCallback(async () => {
    try {
      const notificationService = new NotificationService(apolloClient);
      console.log('[useNotifications] Initializing FCM...');
      const token = await notificationService.initializeFcm((payload) => {
        console.log('[useNotifications] FCM message received in hook:', payload);
      });
      
      setFcmToken(token);
      console.log('[useNotifications] FCM token set:', token ? 'success' : 'null');
      return token;
    } catch (error) {
      console.error('[useNotifications] Error initializing FCM:', error);
      return null;
    }
  }, [apolloClient]);
  
  // Thiết lập service và event listener cho FCM
  useEffect(() => {
    // Đăng ký listener cho sự kiện notificationReceived
    window.addEventListener('notificationReceived', handleNotificationReceived);
    
    // Khởi tạo FCM nếu cần thiết và đang ở client-side
    if (typeof window !== 'undefined') {
      initFcm();
    }
    
    // Cleanup khi component unmount
    return () => {
      // Xóa event listener
      window.removeEventListener('notificationReceived', handleNotificationReceived);
      
      // Hủy đăng ký FCM token khi component unmount
      if (fcmToken) {
        const notificationService = new NotificationService(apolloClient);
        notificationService.unregisterFcmToken(fcmToken).catch(console.error);
      }
    };
  }, [apolloClient, handleNotificationReceived, initFcm, fcmToken]);
  
  // Xử lý đánh dấu một thông báo đã đọc
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead({
        variables: { notificationId }
      });
      
      // Cập nhật cache tại chỗ để UI cập nhật ngay lập tức
      const cachedData = apolloClient.readQuery({ query: GET_NOTIFICATIONS });
      
      if (cachedData?.notifications) {
        const updatedNotifications = cachedData.notifications.map((notification: any) => {
          if (notification.notificationId === notificationId) {
            return { ...notification, isRead: true };
          }
          return notification;
        });
        
        apolloClient.writeQuery({
          query: GET_NOTIFICATIONS,
          data: { notifications: updatedNotifications }
        });
      }
      
      console.log('[useNotifications] Notification marked as read:', notificationId);
    } catch (error) {
      console.error('[useNotifications] Error marking notification as read:', error);
    }
  };
  
  // Xử lý đánh dấu tất cả thông báo đã đọc
  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      console.log('[useNotifications] All notifications marked as read');
      setUnreadCount(0);
    } catch (error) {
      console.error('[useNotifications] Error marking all notifications as read:', error);
    }
  };
  
  // Convert backend notifications to frontend format
  const convertBackendNotification = (notification: BackendNotification): Notification => {
    return {
      id: notification.notificationId || '',
      userId: notification.userId,
      message: notification.message,
      type: notification.type as NotificationType,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      projectId: notification.projectId,
      taskId: notification.referenceType === 'TASK' ? notification.referenceId : undefined,
      commentId: notification.referenceType === 'COMMENT' ? notification.referenceId : undefined,
      senderId: notification.senderId,
      link: notification.action ? notification.action : undefined
    };
  };
  
  const notifications = notificationsData?.notifications 
        ? notificationsData.notifications.map(convertBackendNotification) 
        : [];
  
  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };
  
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }
    
    // Navigate to related page based on notification type
    if (notification.type === 'TASK_ASSIGNED' && notification.taskId) {
      router.push(`/dashboard/tasks/${notification.taskId}`);
    } else if (notification.type === ('TASK_DUE_SOON' as NotificationType) && notification.taskId) {
      router.push(`/dashboard/tasks/${notification.taskId}`);
    } else if (notification.type === ('PROJECT_INVITATION' as NotificationType) && notification.projectId) {
      router.push(`/dashboard/projects/${notification.projectId}`);
    }
    
    toggleDropdown();
  };
  
  return {
    notifications,
    unreadCount,
    isDropdownOpen,
    toggleDropdown,
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
    handleNotificationClick,
    loading: notificationsLoading || countLoading,
    error: notificationsError || countError,
    refetch: () => {
      refetchNotifications();
      refetchCount();
    },
    fcmToken,
    initializeFcm: initFcm
  };
}
