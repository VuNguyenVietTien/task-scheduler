"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Notification } from '@/types/notification';

interface NotificationDropdownProps {
  notifications: Notification[];
  isOpen: boolean;
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onNotificationClick: (notification: Notification) => void;
  loading?: boolean;
}

// Format notification time: "X minutes ago" if < 24h, otherwise show date and time
const formatNotificationTime = (timestamp: string) => {
  const now = new Date();
  const notificationTime = new Date(timestamp);
  const diffMs = now.getTime() - notificationTime.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  if (diffHours < 24) {
    // Less than 24 hours, show relative time
    if (diffHours < 1) {
      // Less than an hour
      const minutes = Math.floor(diffMs / (1000 * 60));
      return minutes <= 1 ? 'just now' : `${minutes} minutes ago`;
    } else {
      // More than an hour but less than 24 hours
      const hours = Math.floor(diffHours);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    }
  } else {
    // More than 24 hours, show date and time
    return notificationTime.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};

// Format notification type to be more user-friendly
const formatNotificationType = (type: string) => {
  switch (type) {
    case 'TASK_ASSIGNED':
      return 'Task Assigned';
    case 'TASK_REASSIGNED':
      return 'Task Reassigned';
    case 'TASK_COMPLETED':
      return 'Task Completed';
    case 'TASK_OVERDUE':
      return 'Task Overdue';
    case 'COMMENT_MENTION':
      return 'Comment Mention';
    case 'TASK_COMMENT':
      return 'Task Comment';
    default:
      return type.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
  }
};

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  notifications,
  isOpen,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  onNotificationClick,
  loading = false
}) => {
  // Store last notification count to detect changes
  const [lastNotificationCount, setLastNotificationCount] = useState(notifications.length);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  
  // Log when dropdown is opened/closed or notifications change
  useEffect(() => {
    if (isOpen) {
      console.log('[NotificationDropdown] Opened with notifications:', {
        count: notifications.length,
        notifications: notifications.map(n => ({ id: n.id, type: n.type, isRead: n.isRead }))
      });
      
      // Reset new notifications flag when opened
      setHasNewNotifications(false);
    }
  }, [isOpen, notifications]);
  
  // Detect new notifications
  useEffect(() => {
    if (notifications.length > lastNotificationCount) {
      console.log('[NotificationDropdown] New notifications detected:', {
        previous: lastNotificationCount,
        current: notifications.length
      });
      setHasNewNotifications(true);
    }
    setLastNotificationCount(notifications.length);
  }, [notifications.length, lastNotificationCount]);
  
  // Get notification link based on type and metadata
  const getNotificationLink = (notification: Notification) => {
    if (!notification.metadata) return null;

    const { project_id, task_id, comment_id } = notification.metadata;
    
    if (!project_id || !task_id) return null;

    // For comment-related notifications, include comment_id in hash
    if (comment_id && (notification.type === 'COMMENT_MENTION' || notification.type === 'TASK_COMMENT')) {
      return `/projects/${project_id}/tasks/${task_id}#comment-${comment_id}`;
    }

    // For task-related notifications, just link to task
    return `/projects/${project_id}/tasks/${task_id}`;
  };

  // Handle notification click with logging and link navigation
  const handleNotificationClick = (notification: Notification) => {
    console.log('[NotificationDropdown] Notification clicked:', notification.id);
    
    // Mark as read if not already read
    if (!notification.isRead) {
      onMarkAsRead(notification.id);
    }
    
    // Get the link for this notification
    const link = getNotificationLink(notification);
    if (link) {
      // Use the notification click handler which will handle navigation
      onNotificationClick(notification);
    }
  };
  
  // Handle mark all as read with logging
  const handleMarkAllAsRead = () => {
    console.log('[NotificationDropdown] Mark all as read clicked');
    onMarkAllAsRead();
  };

  if (!isOpen) return null;

  return (
    <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg py-1 z-50">
      <div className="px-4 py-2 border-b border-gray-100">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            Notifications
            {hasNewNotifications && (
              <span className="ml-2 text-xs text-white bg-blue-500 px-2 py-1 rounded-full">New</span>
            )}
          </h3>
          {notifications.length > 0 && (
            <button 
              className="text-sm text-blue-600 hover:text-blue-800"
              onClick={handleMarkAllAsRead}
            >
              Mark all as read
            </button>
          )}
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-3 text-sm text-gray-500 flex justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-3 text-sm text-gray-500">
            No new notifications
          </div>
        ) : (
          <div>
            {notifications.map((notification) => {
              const link = getNotificationLink(notification);
              return (
                <div
                  key={notification.id}
                  className={`block px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${
                    !notification.isRead ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                  data-has-comment={!!notification.metadata?.comment_id}
                  data-has-task={!!notification.metadata?.task_id}
                >
                  <div className="flex justify-between">
                    <p className="text-sm font-medium text-gray-900">
                      {formatNotificationType(notification.type)}
                    </p>
                    <span className="text-xs text-gray-500">
                      {formatNotificationTime(notification.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{notification.message}</p>
                  {link && (
                    <p className="mt-1 text-xs text-blue-600 hover:text-blue-800">
                      View {notification.metadata?.comment_id ? 'comment' : 'task'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationDropdown;
