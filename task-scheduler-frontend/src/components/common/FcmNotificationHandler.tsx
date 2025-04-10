'use client';

import { useEffect, useState } from 'react';
import { useApolloClient } from '@apollo/client';
import { NotificationService } from '@/services/notificationService';
import { useRouter } from 'next/navigation';
import { GET_NOTIFICATIONS, GET_NOTIFICATION_COUNT } from '@/graphql/queries/notifications';

interface FcmNotificationHandlerProps {
  userId?: string | null;
}

export default function FcmNotificationHandler({ userId }: FcmNotificationHandlerProps) {
  const [initialized, setInitialized] = useState(false);
  const apolloClient = useApolloClient();
  const router = useRouter();
  
  console.log('[FCM] Component mounted with userId:', userId);
  
  // Định nghĩa hàm để chơi âm thanh thông báo
  const playNotificationSound = () => {
    try {
      console.log('[FCM] Playing notification sound');
      const audio = new Audio('/sounds/notification.mp3');
      audio.play().catch(err => console.error('[FCM] Failed to play notification sound:', err));
    } catch (error) {
      console.error('[FCM] Error playing notification sound:', error);
    }
  };
  
  // Hàm cập nhật cache Apollo khi có thông báo mới
  const updateNotificationCache = (payload: any) => {
    try {
      console.log('[FCM] 🔄 Updating Apollo cache with payload:', payload);
      
      // Lấy dữ liệu từ payload
      const data = payload.data || {};
      console.log('[FCM] Data from payload:', data);
      
      // Sử dụng cả hai kiểu tên trường (snake_case và camelCase)
      const notificationId = data.notification_id || data.notificationId;
      const notificationType = data.notification_type || data.notificationType;
      const title = payload.notification?.title || 'New notification';
      const body = payload.notification?.body || '';
      
      if (notificationId && notificationType) {
        console.log('[FCM] Creating new notification object with ID:', notificationId);
        
        // Create notification object that matches the structure in GET_NOTIFICATIONS query
        const newNotification = {
          __typename: 'Notification',
          notificationId: notificationId,
          userId: data.user_id || data.userId || userId,
          type: notificationType,
          message: body,
          isRead: false,
          createdAt: new Date().toISOString(),
          projectId: data.project_id || data.projectId || null,
          taskId: data.task_id || data.taskId || null,
          commentId: data.comment_id || data.commentId || null,
          senderId: data.sender_id || data.senderId || null,
          referenceType: data.reference_type || data.referenceType || null,
          referenceId: data.reference_id || data.referenceId || null,
          action: data.action || null
        };
        
        console.log('[FCM] New notification object created:', newNotification);
        
        // Trigger custom event before cache update to ensure UI components can respond
        const event = new CustomEvent('notificationReceived', { 
          detail: { 
            payload,
            notification: newNotification
          } 
        });
        console.log('[FCM] Dispatching notificationReceived event with notification data');
        window.dispatchEvent(event);
        
        // Update cache as needed
        try {
          // Force refetch to ensure latest data
          console.log('[FCM] Forcing refetch of notifications');
          apolloClient.refetchQueries({
            include: ['GetNotifications', 'GetNotificationCount'],
          });
          
          // Try to update notification count in cache
          const countCache = apolloClient.readQuery({
            query: GET_NOTIFICATION_COUNT
          });
          
          if (countCache?.getNotificationCount) {
            const currentUnread = countCache.getNotificationCount.unread || 0;
            
            apolloClient.writeQuery({
              query: GET_NOTIFICATION_COUNT,
              data: {
                getNotificationCount: {
                  ...countCache.getNotificationCount,
                  unread: currentUnread + 1
                }
              }
            });
            console.log('[FCM] Updated unread count in cache to:', currentUnread + 1);
          }
          
          // Update notifications cache if possible
          const notificationsCache = apolloClient.readQuery({
            query: GET_NOTIFICATIONS
          });
          
          if (notificationsCache?.getNotifications) {
            // Check if notification already exists
            const exists = notificationsCache.getNotifications.some(
              (n: any) => n.notificationId === notificationId
            );
            
            if (!exists) {
              apolloClient.writeQuery({
                query: GET_NOTIFICATIONS,
                data: {
                  getNotifications: [
                    newNotification,
                    ...notificationsCache.getNotifications
                  ]
                }
              });
              console.log('[FCM] Added new notification to cache');
            }
          }
        } catch (cacheError) {
          console.error('[FCM] Error updating cache:', cacheError);
        }
      } else {
        console.log('[FCM] Missing required fields for notification');
      }
    } catch (error) {
      console.error('[FCM] Error in updateNotificationCache:', error);
    }
  };
  
  useEffect(() => {
    console.log('[FCM] useEffect triggered. userId:', userId, 'initialized:', initialized);
    
    // Only initialize if user is logged in and component hasn't been initialized
    if (userId && !initialized) {
      console.log('[FCM] Initializing FCM for userId:', userId);
      
      const notificationService = new NotificationService(
        // @ts-ignore - Type mismatch is acceptable here
        apolloClient
      );
      
      const initializeFcm = async () => {
        try {
          console.log('[FCM] Starting FCM initialization');
          
          const token = await notificationService.initializeFcm((payload) => {
            console.log('[FCM] 🔔 MESSAGE RECEIVED 🔔:', payload);
            console.log('[FCM] Message data:', payload.data);
            console.log('[FCM] Message notification:', payload.notification);
            
            // Extract notification data
            const notification = payload.notification || {};
            const data = payload.data || {};
            const title = notification.title || 'New notification';
            const body = notification.body || '';
            
            console.log('[FCM] Parsed notification - Title:', title, 'Body:', body);
            
            // Processing flow:
            // 1. Play sound notification
            playNotificationSound();
            
            // 2. Update Apollo cache and trigger UI updates
            updateNotificationCache(payload);
            
            // 3. Create in-app notification toast
            try {
              console.log('[FCM] Creating in-app notification UI');
              const notificationDiv = document.createElement('div');
              notificationDiv.className = 'fixed top-5 right-5 bg-white shadow-lg rounded-lg p-4 z-50 animate-fadeIn max-w-sm';
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
                ${(data.task_id || data.taskId) ? '<button class="mt-3 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium" id="view-notification">View</button>' : ''}
              `;
              document.body.appendChild(notificationDiv);
              console.log('[FCM] In-app notification UI created and appended to DOM');
              
              // Add CSS animation for smooth appearance/disappearance
              const style = document.createElement('style');
              style.innerHTML = `
                @keyframes fadeIn {
                  from { opacity: 0; transform: translateY(-20px); }
                  to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeOut {
                  from { opacity: 1; transform: translateY(0); }
                  to { opacity: 0; transform: translateY(-20px); }
                }
                .animate-fadeIn {
                  animation: fadeIn 0.3s ease-out forwards;
                }
                .animate-fadeOut {
                  animation: fadeOut 0.3s ease-out forwards;
                }
              `;
              document.head.appendChild(style);
              
              // Handle close button action
              const closeButton = notificationDiv.querySelector('#close-notification');
              if (closeButton) {
                closeButton.addEventListener('click', () => {
                  console.log('[FCM] Close button clicked');
                  notificationDiv.classList.add('animate-fadeOut');
                  setTimeout(() => {
                    notificationDiv.remove();
                  }, 300);
                });
              }
              
              // Add click handler for the action button
              const taskId = data.task_id || data.taskId;
              const projectId = data.project_id || data.projectId;
              
              if (taskId) {
                console.log('[FCM] Task ID found, adding action button click handler');
                const actionButton = notificationDiv.querySelector('#view-notification');
                if (actionButton) {
                  actionButton.addEventListener('click', () => {
                    console.log('[FCM] View button clicked, navigating to task');
                    if (projectId && taskId) {
                      router.push(`/projects/${projectId}/tasks/${taskId}`);
                    }
                    notificationDiv.classList.add('animate-fadeOut');
                    setTimeout(() => {
                      notificationDiv.remove();
                    }, 300);
                  });
                }
              }
              
              // Auto remove after 5 seconds
              setTimeout(() => {
                console.log('[FCM] Auto-removing notification after 5 seconds');
                notificationDiv.classList.add('animate-fadeOut');
                setTimeout(() => {
                  notificationDiv.remove();
                }, 300);
              }, 5000);
            } catch (uiError) {
              console.error('[FCM] Error creating notification UI:', uiError);
            }
            
            // Show browser notification if app is not in focus
            try {
              if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
                console.log('[FCM] App not in focus, showing browser notification');
                // Create notification
                const notificationOptions: NotificationOptions = {
                  body,
                  icon: '/favicon.ico',
                  requireInteraction: true, // Yêu cầu tương tác từ người dùng
                };
                
                const notification = new Notification(title, notificationOptions);
                
                // Xử lý sự kiện click vào browser notification
                notification.onclick = function() {
                  console.log('[FCM] Browser notification clicked');
                  window.focus();
                  const taskId = data.task_id || data.taskId;
                  const projectId = data.project_id || data.projectId;
                  if (projectId && taskId) {
                    router.push(`/projects/${projectId}/tasks/${taskId}`);
                  }
                  notification.close();
                };
              }
            } catch (browserNotificationError) {
              console.error('[FCM] Error showing browser notification:', browserNotificationError);
            }
          });
          
          if (token) {
            console.log('[FCM] ✅ Initialized with token:', token);
            setInitialized(true);
          } else {
            console.log('[FCM] ❌ Initialization failed - no token received');
          }
        } catch (error) {
          console.error('[FCM] ❌ Error initializing FCM:', error);
        }
      };
      
      initializeFcm();
      
      // Clean up function
      return () => {
        console.log('[FCM] Component unmounting, cleaning up');
      };
    }
  }, [userId, initialized, apolloClient, router]);
  
  // This component doesn't render anything
  return null;
} 