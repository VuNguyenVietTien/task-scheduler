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
import { NOTIFICATION_SUBSCRIPTION } from '@/graphql/subscriptions/notifications';
import { 
  Notification, 
  BackendNotification,
  NotificationState,
  NotificationQueryResponse,
  NotificationCountQueryResponse,
  NotificationType
} from '@/types/notification';
import { useRouter } from 'next/navigation';
import { useToastContext as useToast } from '@/components/ui/toast/toast-provider';
import { useAuth } from '@/contexts/AuthContext';

// Helper function to convert BackendNotification to Notification
const convertBackendNotification = (notification: BackendNotification): Notification => {
  // Extract metadata to get additional information
  const metadata = notification.metadata || {};
  
  return {
    id: notification.id,
    userId: notification.userId,
    title: notification.action || 'Notification',
    message: notification.message,
    type: notification.type as NotificationType,
    read: notification.isRead,
    createdAt: notification.createdAt,
    projectId: notification.projectId,
    taskId: metadata.taskId,
    commentId: metadata.commentId,
    senderId: notification.senderId,
    link: metadata.link
  };
};

export const useNotifications = () => {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Fetch notifications
  const { data: notificationsData, loading: notificationsLoading, refetch: refetchNotifications } = useQuery<NotificationQueryResponse>(
    GET_NOTIFICATIONS
  );
  
  // Fetch notification count
  const { data: countData, loading: countLoading, refetch: refetchCount } = useQuery<NotificationCountQueryResponse>(
    GET_NOTIFICATION_COUNT
  );
  
  // Subscribe to new notifications
  const { data: subscriptionData } = useSubscription(NOTIFICATION_SUBSCRIPTION, {
    onData: ({ data }) => {
      // Only handle the notification if it's for the current user and toast is available
      const notification = data.data?.notificationReceived;
      if (notification && notification.userId === user?.id && toast) {
        // Refetch notifications and count
        refetchNotifications();
        refetchCount();
        
        // Show toast notification
        toast({
          title: notification.action || 'New notification',
          description: notification.message,
          variant: "default",
        });
        
        // Play notification sound
        const audio = new Audio('/sounds/notification.mp3');
        audio.play().catch(err => console.error('Failed to play notification sound:', err));
      }
    }
  });
  
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

  // Convert backend notifications to frontend format
  const notifications = notificationsData?.notifications 
    ? notificationsData.notifications.map(convertBackendNotification)
    : [];
    
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
