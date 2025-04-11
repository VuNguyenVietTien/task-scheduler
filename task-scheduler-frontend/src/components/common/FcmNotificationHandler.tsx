'use client';

import { useEffect, useState, useRef } from 'react';
import { useApolloClient } from '@apollo/client';
import { NotificationService } from '@/services/notificationService';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/redux/hooks';
import { addNotification, fetchNotificationCount } from '@/redux/features/notificationsSlice';

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
    
    // Extract notification data
    const notificationData = payload.data;
    const notification = {
      id: notificationData.notification_id,
      userId: notificationData.user_id,
      message: payload.notification.body,
      type: notificationData.notification_type,
      isRead: false,
      createdAt: new Date().toISOString(),
      projectId: notificationData.project_id,
      taskId: notificationData.task_id,
      commentId: notificationData.comment_id,
      senderId: notificationData.sender_id,
      link: `/projects/${notificationData.project_id}/tasks/${notificationData.task_id}${notificationData.comment_id ? `/comments/${notificationData.comment_id}` : ''}`
    };
    
    // Dispatch to Redux store
    dispatch(addNotification(notification));
    dispatch(fetchNotificationCount());
    
    // Create in-app notification
    createInAppNotification(notification);
    
    // Create browser notification if app is not in focus
    if (document.hidden) {
      createBrowserNotification(notification);
    }
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
    notificationElement.className = 'fixed top-4 right-4 z-50 bg-white shadow-lg rounded-lg p-4 max-w-sm transform transition-all duration-300 translate-x-0 opacity-100';
    notificationElement.style.width = '320px';
    
    // Add notification content
    notificationElement.innerHTML = `
      <div class="flex items-start">
        <div class="flex-shrink-0">
          <svg class="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div class="ml-3 w-0 flex-1">
          <p class="text-sm font-medium text-gray-900">${notification.message}</p>
          <p class="mt-1 text-xs text-gray-500">Just now</p>
        </div>
        <div class="ml-4 flex-shrink-0 flex">
          <button class="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none">
            <span class="sr-only">Close</span>
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    `;
    
    // Add click handler
    notificationElement.addEventListener('click', () => {
      window.location.href = notification.link;
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
    if (!('Notification' in window)) {
      console.log('This browser does not support desktop notification');
      return;
    }
    
    if (Notification.permission === 'granted') {
      const browserNotification = new Notification(notification.message, {
        body: notification.message,
        icon: '/notification-icon.png',
        data: notification
      });
      
      browserNotification.onclick = () => {
        window.location.href = notification.link;
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