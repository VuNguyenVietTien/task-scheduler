"use client";

import { useState, useEffect } from 'react';
import { Notification, NotificationState } from '@/types/notification';

export const useNotifications = () => {
  const [state, setState] = useState<NotificationState>({
    notifications: [],
    unreadCount: 0
  });
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // TODO: Replace with actual API call
  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications');
      const data = await response.json();
      setState({
        notifications: data.notifications,
        unreadCount: data.notifications.filter((n: Notification) => !n.read).length
      });
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'POST'
      });
      
      setState(prev => ({
        notifications: prev.notifications.map(n => 
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: prev.unreadCount - 1
      }));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(prev => !prev);
  };

  useEffect(() => {
    fetchNotifications();
    // Set up WebSocket connection for real-time notifications
    // TODO: Implement WebSocket connection
  }, []);

  return {
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    isDropdownOpen,
    toggleDropdown,
    markAsRead
  };
};
