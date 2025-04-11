'use client';

import { useEffect, useState, useRef } from 'react';
import { useApolloClient } from '@apollo/client';
import { NotificationService } from '@/services/notificationService';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/redux/hooks';
import { addNotification, fetchNotificationCount, incrementUnreadCount } from '@/redux/features/notificationsSlice';
import type { Notification, NotificationType } from '@/types/notification';

interface FcmNotificationHandlerProps {
  userId?: string | null;
}

export default function FcmNotificationHandler({ userId }: FcmNotificationHandlerProps) {
  const [initialized, setInitialized] = useState(false);
  const soundRef = useRef<HTMLAudioElement | null>(null);
  const apolloClient = useApolloClient();
  const router = useRouter();
  const dispatch = useAppDispatch();
  
  // Create or get the notification sound element
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const existingSound = document.getElementById('notification-sound') as HTMLAudioElement;
      
      if (existingSound) {
        soundRef.current = existingSound;
      } else {
        const audio = document.createElement('audio');
        audio.id = 'notification-sound';
        audio.src = '/sounds/notification.mp3';
        audio.preload = 'auto';
        document.body.appendChild(audio);
        soundRef.current = audio;
      }
    }
    
    return () => {
      // Don't remove the audio element since other components might be using it
    };
  }, []);
  
  // Play the notification sound
  const playNotificationSound = () => {
    if (soundRef.current) {
      soundRef.current.currentTime = 0; // Reset to start
      soundRef.current.play().catch(e => 
        console.error('[FCM] Error playing notification sound:', e)
      );
    }
  };
  
  // Process notification and update store
  const processNotification = (payload: any) => {
    console.log('[FcmNotificationHandler] Processing notification:', payload);
    
    if (!payload.data) {
        console.warn('[FcmNotificationHandler] No data in notification payload');
        return;
    }

    const {
        notification_id,
        notification_type,
        project_id,
        task_id,
        comment_id,
        user_id,
        sender_id,
    } = payload.data;

    // Create notification object
    const notification: Notification = {
        id: notification_id,
        userId: user_id,
        message: payload.notification?.body || '',
        type: notification_type as NotificationType,
        isRead: false,
        createdAt: new Date().toISOString(),
        projectId: project_id || undefined,
        taskId: task_id || undefined,
        commentId: comment_id || undefined,
        senderId: sender_id || undefined,
        metadata: {
            project_id: project_id || '',
            task_id: task_id || '',
            comment_id: comment_id,
            task_title: payload.notification?.title || '',
        }
    };

    // Add to Redux store (this will automatically increment unread count in the reducer)
    dispatch(addNotification(notification));
    
    // Create in-app notification
    createInAppNotification(notification);
    
    // Create browser notification
    createBrowserNotification(notification);
  };
  
  useEffect(() => {
    // Only initialize if user is logged in and component hasn't been initialized
    if (userId && !initialized) {
      const notificationService = new NotificationService(
        // @ts-ignore - Type mismatch is acceptable here
        apolloClient
      );
      
      const initializeFcm = async () => {
        try {
          const token = await notificationService.initializeFcm((payload) => {
            console.log('[FCM] Message received in FcmNotificationHandler:', payload);
            processNotification(payload);
          });
          
          if (token) {
            console.log('[FCM] Initialized with token:', token);
            setInitialized(true);
          } else {
            console.log('[FCM] Initialization failed');
          }
        } catch (error) {
          console.error('[FCM] Error initializing FCM:', error);
        }
      };
      
      initializeFcm();
    }
  }, [userId, initialized, apolloClient, router, dispatch]);
  
  // Create in-app notification element
  const createInAppNotification = (notification: any) => {
    const notificationElement = document.createElement('div');
    notificationElement.className = 'notification-toast';
    notificationElement.innerHTML = `
      <div class="notification-content">
        <div class="notification-message">${notification.message}</div>
        <div class="notification-time">Just now</div>
      </div>
    `;
    
    notificationElement.addEventListener('click', () => {
      const { project_id, task_id, comment_id } = notification.metadata;
      if (comment_id) {
        window.location.href = `/projects/${project_id}/tasks/${task_id}#comment-${comment_id}`;
      } else {
        window.location.href = `/projects/${project_id}/tasks/${task_id}`;
      }
    });
    
    // Add to DOM
    document.body.appendChild(notificationElement);
    
    // Remove after 5 seconds
    setTimeout(() => {
      notificationElement.style.transform = 'translateX(100%)';
      notificationElement.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(notificationElement);
      }, 300);
    }, 5000);
  };
  
  // Create browser notification
  const createBrowserNotification = (notification: any) => {
    const { project_id, task_id, comment_id, task_title } = notification.metadata;
    const notificationOptions = {
      body: notification.message,
      icon: '/favicon.ico',
      data: {
        url: comment_id 
          ? `/projects/${project_id}/tasks/${task_id}#comment-${comment_id}`
          : `/projects/${project_id}/tasks/${task_id}`,
        taskTitle: task_title
      }
    };
    
    if (!('Notification' in window)) {
      console.log('This browser does not support desktop notification');
      return;
    }
    
    if (Notification.permission === 'granted') {
      const browserNotification = new Notification(notification.message, notificationOptions);
      
      browserNotification.onclick = () => {
        const { url } = notificationOptions.data;
        window.location.href = url;
      };
    }
  };
  
  // Ensure animation styles are added to document
  const ensureAnimationStyles = () => {
    if (!document.getElementById('notification-animations')) {
      const style = document.createElement('style');
      style.id = 'notification-animations';
      style.innerHTML = `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-20px); }
        }
        .fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
        .fadeOut {
          animation: fadeOut 0.3s ease-out forwards;
        }
      `;
      document.head.appendChild(style);
    }
  };
  
  // This component doesn't render anything
  return null;
} 