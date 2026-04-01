"use client";

import React, { useRef, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import NotificationDropdown from './NotificationDropdown';
import AccountDropdown from './AccountDropdown';
import useNotificationsRedux from '@/hooks/useNotificationsRedux';
import SettingsPanel from '@/components/layout/SettingsPanel';

const Header = () => {
  const { 
    notifications, 
    unreadCount, 
    isDropdownOpen: isNotificationOpen, 
    toggleDropdown: toggleNotification, 
    markAsRead,
    markAllAsRead,
    handleNotificationClick,
    loading: notificationsLoading,
    forceUpdateValue
  } = useNotificationsRedux();
  
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  // Track last unread count to detect changes
  const [lastUnreadCount, setLastUnreadCount] = useState(unreadCount);

  // Log when notifications or unreadCount change
  useEffect(() => {
    console.log('[Header] Notifications updated:', { 
      count: notifications.length,
      unreadCount,
      forceUpdateValue
    });
    
    // Update last unread count
    if (unreadCount !== lastUnreadCount) {
      console.log('[Header] Unread count changed from', lastUnreadCount, 'to', unreadCount);
      setLastUnreadCount(unreadCount);
    }
  }, [notifications, unreadCount, lastUnreadCount, forceUpdateValue]);

  // Process for outside clicks
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        if (isNotificationOpen) toggleNotification();
      }
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setIsAccountOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotificationOpen, toggleNotification]);

  // Handle manual notification toggle
  const handleNotificationToggle = () => {
    console.log('[Header] Notification toggle clicked, current state:', isNotificationOpen);
    toggleNotification();
  };

  const handleLogout = async () => {
    // TODO: Implement logout functionality
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <>
    <header className="fixed top-0 left-0 right-0 h-16 bg-white shadow-md z-50">
      <div className="h-full flex items-center justify-between px-4">
        <div className="flex items-center">
          <Link href="/" className="flex items-center">
            <Image src="/next.svg" alt="Logo" width={32} height={32} className="mr-2" />
            <span className="text-xl font-semibold">Task Scheduler</span>
          </Link>
        </div>

        <div className="flex items-center space-x-4">
          <button className="p-2 hover:bg-gray-100 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          
          <div ref={notificationRef} className="relative">
            <button 
              className="p-2 hover:bg-gray-100 rounded-full relative"
              onClick={handleNotificationToggle}
              aria-label={`Notifications (${unreadCount} unread)`}
              data-unread-count={unreadCount} /* Add data attribute for easier debugging */
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
            <NotificationDropdown
              notifications={notifications}
              isOpen={isNotificationOpen}
              onClose={toggleNotification}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
              onNotificationClick={handleNotificationClick}
              loading={notificationsLoading}
            />
          </div>
          
          <div ref={accountRef} className="relative">
            <button 
              onClick={() => setIsAccountOpen(!isAccountOpen)}
              className="flex items-center p-2 hover:bg-gray-100 rounded-full"
            >
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </button>
            <AccountDropdown
              isOpen={isAccountOpen}
              onClose={() => setIsAccountOpen(false)}
              onLogout={handleLogout}
              onSettingsOpen={() => setIsSettingsOpen(true)}
            />
          </div>
        </div>
      </div>
    </header>
    <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
};

export default Header;
