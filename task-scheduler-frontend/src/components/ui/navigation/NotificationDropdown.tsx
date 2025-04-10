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
  
  // Handle notification click with logging
  const handleNotificationClick = (notification: Notification) => {
    console.log('[NotificationDropdown] Notification clicked:', notification.id);
    onNotificationClick(notification);
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
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`block px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${
                  !notification.isRead ? 'bg-blue-50' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex justify-between">
                  <p className="text-sm font-medium text-gray-900">
                    {notification.type === 'TASK_ASSIGNED' ? 'Task Assigned' :
                     notification.type === 'TASK_REASSIGNED' ? 'Task Reassigned' :
                     notification.type === 'TASK_COMPLETED' ? 'Task Completed' :
                     notification.type === 'TASK_OVERDUE' ? 'Task Overdue' :
                     notification.type === 'COMMENT_MENTION' ? 'Comment Mention' :
                     notification.type === 'TASK_COMMENT' ? 'Task Comment' :
                     notification.type}
                  </p>
                  <span className="text-xs text-gray-500">
                    {new Date(notification.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">{notification.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationDropdown;
