"use client";

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { 
  GET_NOTIFICATIONS, 
  GET_NOTIFICATION_COUNT
} from '@/graphql/queries/notifications';
import { 
  MARK_NOTIFICATION_AS_READ,
  MARK_ALL_NOTIFICATIONS_AS_READ
} from '@/graphql/mutations/notifications';
import { 
  Notification, 
  NotificationState,
  NotificationQueryResponse,
  NotificationCountQueryResponse
} from '@/types/notification';
import { useRouter } from 'next/navigation';

export const useNotifications = () => {
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Fetch notifications
  const { data: notificationsData, loading: notificationsLoading, refetch: refetchNotifications } = useQuery<NotificationQueryResponse>(
    GET_NOTIFICATIONS
  );
  
  // Fetch notification count
  const { data: countData, loading: countLoading, refetch: refetchCount } = useQuery<NotificationCountQueryResponse>(
    GET_NOTIFICATION_COUNT
  );
  
  // Mark notification as read mutation
  const [markAsReadMutation] = useMutation(MARK_NOTIFICATION_AS_READ, {
    onCompleted: () => {
      refetchNotifications();
      refetchCount();
    }
  });
  
  // Mark all notifications as read mutation
  const [markAllAsReadMutation] = useMutation(MARK_ALL_NOTIFICATIONS_AS_READ, {
    onCompleted: () => {
      refetchNotifications();
      refetchCount();
    }
  });

  const notifications = notificationsData?.notifications || [];
  const unreadCount = countData?.notificationCount?.unread || 0;

  const markAsRead = async (id: string) => {
    try {
      await markAsReadMutation({
        variables: { id }
      });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await markAllAsReadMutation();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(prev => !prev);
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    // Navigate to the appropriate page based on notification type
    if (notification.projectId && notification.taskId) {
      router.push(`/projects/${notification.projectId}/tasks/${notification.taskId}`);
    } else if (notification.projectId) {
      router.push(`/projects/${notification.projectId}`);
    }
    
    toggleDropdown();
  };

  // TODO: Implement WebSocket subscription for real-time notifications
  // This would be implemented with useSubscription from Apollo Client

  return {
    notifications,
    unreadCount,
    isDropdownOpen,
    toggleDropdown,
    markAsRead,
    markAllAsRead,
    handleNotificationClick,
    loading: notificationsLoading || countLoading
  };
};
