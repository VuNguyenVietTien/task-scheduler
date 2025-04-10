import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchNotifications,
  fetchNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  addNotification,
  selectNotifications,
  selectNotificationCount,
  selectNotificationsLoading,
  selectNotificationsError
} from '@/redux/features/notificationsSlice';
import { NotificationService } from '@/services/notificationService';
import { useApolloClient } from '@apollo/client';
import type { Notification } from '@/types/notification';

// Debounce function helper
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: any[]) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export default function useNotificationsRedux() {
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [lastReceivedNotification, setLastReceivedNotification] = useState<string | null>(null);
  
  // Reference to track if notifications have been initialized
  const initialized = useRef(false);
  // Force re-render on notification updates
  const [forceUpdate, setForceUpdate] = useState(0);
  
  const dispatch = useAppDispatch();
  const notifications = useAppSelector(selectNotifications);
  const { unread: unreadCount } = useAppSelector(selectNotificationCount);
  const loading = useAppSelector(selectNotificationsLoading);
  const error = useAppSelector(selectNotificationsError);
  
  const apolloClient = useApolloClient();
  
  // Create debounced refetch function
  const debouncedRefetch = useCallback(
    debounce(() => {
      console.log('[useNotificationsRedux] Executing debounced refetch');
      dispatch(fetchNotifications());
      dispatch(fetchNotificationCount());
    }, 1000),
    [dispatch]
  );
  
  // Initialize notifications
  useEffect(() => {
    if (!initialized.current) {
      console.log('[useNotificationsRedux] Initializing notifications data');
      dispatch(fetchNotifications());
      dispatch(fetchNotificationCount());
      initialized.current = true;
    }
  }, [dispatch]);
  
  // Handle FCM notification reception
  const handleNotificationReceived = useCallback((event: any) => {
    console.log('[useNotificationsRedux] Received notificationReceived event with details:', event.detail);
    
    // If we have a notification object in the event, add it to Redux
    const newNotification = event.detail?.notification;
    if (newNotification && newNotification.id) {
      console.log('[useNotificationsRedux] Processing notification:', newNotification);
      
      // Save the ID of the last notification to prevent duplicate refreshes
      setLastReceivedNotification(newNotification.id);
      
      // Trigger immediate UI update
      setForceUpdate(prev => prev + 1);
      
      // Play notification sound if available
      const audio = document.getElementById('notification-sound') as HTMLAudioElement;
      if (audio) {
        audio.currentTime = 0; // Reset to start
        audio.play().catch(e => console.log('[useNotificationsRedux] Error playing sound:', e));
      } else {
        console.warn('[useNotificationsRedux] Notification sound element not found');
      }
      
      // Note: We don't need to dispatch to Redux here since FcmNotificationHandler already did it
      // But we'll trigger a re-fetch to ensure data consistency
      debouncedRefetch();
    } else {
      console.warn('[useNotificationsRedux] Received event but no valid notification data found:', event.detail);
    }
  }, [debouncedRefetch]);
  
  // Initialize FCM and set up listeners
  const initFcm = useCallback(async () => {
    try {
      const notificationService = new NotificationService(apolloClient);
      console.log('[useNotificationsRedux] Initializing FCM...');
      
      const token = await notificationService.initializeFcm((payload) => {
        console.log('[useNotificationsRedux] FCM message received in hook:', payload);
        // This callback is just for logging - the actual handling happens via the custom event
      });
      
      setFcmToken(token);
      console.log('[useNotificationsRedux] FCM token set:', token ? 'success' : 'null');
      return token;
    } catch (error) {
      console.error('[useNotificationsRedux] Error initializing FCM:', error);
      return null;
    }
  }, [apolloClient]);
  
  // Set up event listeners
  useEffect(() => {
    console.log('[useNotificationsRedux] Setting up notification listeners');
    
    // Add a hidden audio element for notification sounds
    if (typeof window !== 'undefined' && !document.getElementById('notification-sound')) {
      const audioElement = document.createElement('audio');
      audioElement.id = 'notification-sound';
      audioElement.src = '/sounds/notification.mp3';
      audioElement.preload = 'auto';
      document.body.appendChild(audioElement);
      console.log('[useNotificationsRedux] Notification sound element created');
    } else {
      console.log('[useNotificationsRedux] Notification sound element already exists');
    }
    
    // Register listener for the notificationReceived event
    console.log('[useNotificationsRedux] Adding notificationReceived event listener');
    window.addEventListener('notificationReceived', handleNotificationReceived);
    
    // Initialize FCM if needed and on client-side
    if (typeof window !== 'undefined') {
      initFcm();
    }
    
    // Clean up when component unmounts
    return () => {
      console.log('[useNotificationsRedux] Cleaning up notification listeners');
      // Remove event listener
      window.removeEventListener('notificationReceived', handleNotificationReceived);
      
      // Remove audio element
      const audioElement = document.getElementById('notification-sound');
      if (audioElement) {
        document.body.removeChild(audioElement);
      }
      
      // Unregister FCM token when component unmounts
      if (fcmToken) {
        const notificationService = new NotificationService(apolloClient);
        notificationService.unregisterFcmToken(fcmToken).catch(console.error);
      }
    };
  }, [apolloClient, handleNotificationReceived, initFcm, fcmToken]);

  // Force refresh notifications when forceUpdate changes
  useEffect(() => {
    if (forceUpdate > 0) {
      console.log('[useNotificationsRedux] Force update triggered, refreshing data');
      // Immediate refresh to ensure UI is up-to-date
      dispatch(fetchNotificationCount());
    }
  }, [forceUpdate, dispatch]);
  
  // Handle mark as read
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await dispatch(markNotificationAsRead(notificationId)).unwrap();
      console.log('[useNotificationsRedux] Notification marked as read:', notificationId);
      // Force refresh to update UI
      dispatch(fetchNotificationCount());
    } catch (error) {
      console.error('[useNotificationsRedux] Error marking notification as read:', error);
    }
  };
  
  // Handle mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      await dispatch(markAllNotificationsAsRead()).unwrap();
      console.log('[useNotificationsRedux] All notifications marked as read');
      // Force refresh to update UI
      dispatch(fetchNotificationCount());
    } catch (error) {
      console.error('[useNotificationsRedux] Error marking all notifications as read:', error);
    }
  };
  
  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }
    
    // Navigate to related page based on notification type
    if (notification.type === 'TASK_ASSIGNED' && notification.taskId) {
      router.push(`/dashboard/tasks/${notification.taskId}`);
    } else if (notification.type === 'TASK_REASSIGNED' && notification.taskId) {
      router.push(`/dashboard/tasks/${notification.taskId}`);
    } else if (notification.type === 'TASK_COMPLETED' && notification.taskId) {
      router.push(`/dashboard/tasks/${notification.taskId}`);
    } else if (notification.type === 'TASK_OVERDUE' && notification.taskId) {
      router.push(`/dashboard/tasks/${notification.taskId}`);
    } else if (notification.type === 'COMMENT_MENTION' && notification.taskId) {
      router.push(`/dashboard/tasks/${notification.taskId}`);
    } else if (notification.type === 'TASK_COMMENT' && notification.taskId) {
      router.push(`/dashboard/tasks/${notification.taskId}`);
    }
    
    // Close dropdown after clicking
    toggleDropdown();
  };
  
  // Toggle dropdown visibility
  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };
  
  // Manual refetch function - for cases where you need immediate data
  const refetch = useCallback(() => {
    console.log('[useNotificationsRedux] Manual refetch triggered');
    dispatch(fetchNotifications());
    dispatch(fetchNotificationCount());
  }, [dispatch]);
  
  // Return the hook interface (similar to the original useNotifications)
  return {
    notifications,
    unreadCount,
    isDropdownOpen,
    toggleDropdown,
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
    handleNotificationClick,
    loading,
    error,
    refetch,
    fcmToken,
    initializeFcm: initFcm,
    lastReceivedNotification,
    forceUpdateValue: forceUpdate
  };
} 