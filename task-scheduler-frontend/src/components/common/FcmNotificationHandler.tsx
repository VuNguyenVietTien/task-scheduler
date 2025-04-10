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
    console.log('[FCM] Processing notification in FcmNotificationHandler:', payload);
    
    // Extract notification data
    const notification = payload.notification || {};
    const data = payload.data || {};
    const title = notification.title || 'New notification';
    const body = notification.body || '';
    
    console.log('[FCM] Notification details:', { title, body, data });
    
    // Play sound regardless of whether we can create a complete notification object
    playNotificationSound();
    
    // Process the notification and dispatch to Redux
    if (data) {
      // Create notification object
      const notificationId = data.notification_id || data.notificationId;
      const notificationType = data.notification_type || data.notificationType;
      
      console.log('[FCM] Extracted notification data:', { 
        notificationId, 
        notificationType,
        userId: data.user_id || data.userId || userId,
        taskId: data.task_id || data.taskId,
        projectId: data.project_id || data.projectId
      });
      
      if (notificationId && notificationType) {
        const newNotification = {
          id: notificationId,
          userId: data.user_id || data.userId || userId || '',
          type: notificationType,
          message: body,
          isRead: false,
          createdAt: new Date().toISOString(),
          projectId: data.project_id || data.projectId || null,
          taskId: data.task_id || data.taskId || null,
          commentId: data.comment_id || data.commentId || null,
          senderId: data.sender_id || data.senderId || null,
          link: data.action || null
        };
        
        console.log('[FCM] Dispatching to Redux:', newNotification);
        
        // First, update the store - this is synchronous
        try {
          dispatch(addNotification(newNotification));
          console.log('[FCM] Successfully dispatched notification to Redux');
          
          // Then immediately update the notification count
          dispatch(fetchNotificationCount());
          console.log('[FCM] Dispatched fetchNotificationCount');
        } catch (dispatchError) {
          console.error('[FCM] Error dispatching to Redux:', dispatchError);
        }
        
        // Trigger custom event for other components to synchronize
        // We do this after Redux update to ensure store is updated first
        try {
          const event = new CustomEvent('notificationReceived', {
            detail: { payload, notification: newNotification }
          });
          window.dispatchEvent(event);
          console.log('[FCM] CustomEvent notificationReceived dispatched');
        } catch (eventError) {
          console.error('[FCM] Error dispatching custom event:', eventError);
        }
        
        // Create and show a custom notification UI element
        createInAppNotification(newNotification, title, body);
      } else {
        console.warn('[FCM] Missing required fields in notification data:', data);
        
        // Create a basic notification UI element even if data is incomplete
        createInAppNotification(null, title, body);
      }
    }
    
    // Show browser notification if app is not in focus
    if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
      createBrowserNotification(title, body, data);
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
  const createInAppNotification = (notification: any, title: string, body: string) => {
    const notificationDiv = document.createElement('div');
    notificationDiv.className = 'fixed top-5 right-5 bg-white shadow-lg rounded-lg p-4 z-50 max-w-sm';
    notificationDiv.innerHTML = `
      <div class="flex justify-between items-start">
        <h4 class="font-semibold text-lg">${title}</h4>
        <button class="text-gray-400 hover:text-gray-500" id="close-notification">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
      <p class="text-sm text-gray-600 mt-2">${body}</p>
      ${(notification?.taskId) ? '<button class="mt-3 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium" id="view-notification">View</button>' : ''}
    `;
    document.body.appendChild(notificationDiv);
    
    // Add style for animation
    ensureAnimationStyles();
    notificationDiv.classList.add('fadeIn');
    
    // Add click handler for close button
    const closeButton = notificationDiv.querySelector('#close-notification');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        notificationDiv.classList.add('fadeOut');
        setTimeout(() => {
          notificationDiv.remove();
        }, 300);
      });
    }
    
    // Add click handler for the action button
    if (notification?.taskId) {
      const actionButton = notificationDiv.querySelector('#view-notification');
      if (actionButton) {
        actionButton.addEventListener('click', () => {
          const taskId = notification.taskId;
          const projectId = notification.projectId;
          if (projectId && taskId) {
            router.push(`/projects/${projectId}/tasks/${taskId}`);
          } else if (taskId) {
            router.push(`/dashboard/tasks/${taskId}`);
          }
          notificationDiv.classList.add('fadeOut');
          setTimeout(() => {
            notificationDiv.remove();
          }, 300);
        });
      }
    }
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      notificationDiv.classList.add('fadeOut');
      setTimeout(() => {
        notificationDiv.remove();
      }, 300);
    }, 5000);
  };
  
  // Create browser notification
  const createBrowserNotification = (title: string, body: string, data: any) => {
    // Create notification
    const notificationOptions = {
      body,
      icon: '/favicon.ico',
      requireInteraction: true,
    };
    
    const browserNotification = new Notification(title, notificationOptions);
    
    // Handle notification click
    browserNotification.onclick = function() {
      window.focus();
      const taskId = data?.task_id || data?.taskId;
      const projectId = data?.project_id || data?.projectId;
      if (projectId && taskId) {
        router.push(`/projects/${projectId}/tasks/${taskId}`);
      } else if (taskId) {
        router.push(`/dashboard/tasks/${taskId}`);
      }
      browserNotification.close();
    };
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