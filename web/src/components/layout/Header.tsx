'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { BellIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { useQuery, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { formatDistance } from 'date-fns';
import { vi, enUS, ja } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import SettingsPanel from '@/components/layout/SettingsPanel';

// GraphQL Queries
const GET_NOTIFICATIONS = gql`
  query GetNotifications($limit: Int) {
    notifications(limit: $limit) {
      notificationId
      type
      title
      message
      isRead
      created_at
      metadata
    }
    notification_count
  }
`;

const MARK_NOTIFICATION_AS_READ = gql`
  mutation MarkNotificationAsRead($notificationId: UUID!) {
    markNotificationAsRead(notificationId: $notificationId)
  }
`;

const MARK_ALL_NOTIFICATIONS_AS_READ = gql`
  mutation MarkAllNotificationsAsRead {
    markAllNotificationsAsRead
  }
`;

export default function Header() {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const pathname = usePathname();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Pick date-fns locale based on current language
  const dateLocale = i18n.language === 'vi' ? vi : i18n.language === 'ja' ? ja : enUS;

  // Fetch notifications
  const { data, loading, refetch } = useQuery(GET_NOTIFICATIONS, {
    variables: { limit: 10 },
    pollInterval: 30000,
  });

  // Mutations
  const [markAsRead] = useMutation(MARK_NOTIFICATION_AS_READ);
  const [markAllAsRead] = useMutation(MARK_ALL_NOTIFICATIONS_AS_READ);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(`${path}/`);
  };

  const handleNotificationClick = async (notificationId: string) => {
    try {
      await markAsRead({ variables: { notificationId } });
      refetch();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      refetch();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const navigateToTask = (taskId: string) => {
    window.location.href = `/tasks/${taskId}`;
  };

  // Get initials from email for avatar
  const getInitials = (email?: string) => {
    if (!email) return '?';
    return email.charAt(0).toUpperCase();
  };

  return (
    <>
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/" className="text-xl font-bold text-gray-800">
                  {t('nav.taskManager')}
                </Link>
              </div>
            </div>

            <div className="flex items-center">
              {user ? (
                <div className="flex items-center gap-3">
                  {/* Notification Bell */}
                  <div className="relative" ref={notificationRef}>
                    <button
                      onClick={() => setShowNotifications(!showNotifications)}
                      className="relative p-1 rounded-full text-gray-600 hover:text-gray-900 focus:outline-none"
                    >
                      <BellIcon className="h-6 w-6" />
                      {data?.notification_count > 0 && (
                        <span className="absolute top-0 right-0 block h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                          {data.notification_count > 9 ? '9+' : data.notification_count}
                        </span>
                      )}
                    </button>

                    {/* Notification Dropdown */}
                    {showNotifications && (
                      <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg py-1 z-10 border border-gray-200">
                        <div className="px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                          <h3 className="text-sm font-medium text-gray-900">{t('notifications.title')}</h3>
                          {data?.notification_count > 0 && (
                            <button
                              onClick={handleMarkAllAsRead}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              {t('notifications.markAllRead')}
                            </button>
                          )}
                        </div>

                        <div className="max-h-96 overflow-y-auto">
                          {loading ? (
                            <div className="px-4 py-2 text-sm text-gray-500">{t('notifications.loading')}</div>
                          ) : data?.notifications?.length > 0 ? (
                            data.notifications.map((notification: any) => (
                              <div
                                key={notification.notificationId}
                                className={`px-4 py-3 hover:bg-gray-50 cursor-pointer ${
                                  !notification.isRead ? 'bg-blue-50' : ''
                                }`}
                                onClick={() => {
                                  handleNotificationClick(notification.notificationId);
                                  if (notification.metadata?.taskId) {
                                    navigateToTask(notification.metadata.taskId);
                                  }
                                }}
                              >
                                <div className="flex justify-between">
                                  <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                                  <p className="text-xs text-gray-500">
                                    {formatDistance(new Date(notification.created_at), new Date(), {
                                      addSuffix: true,
                                      locale: dateLocale,
                                    })}
                                  </p>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                              </div>
                            ))
                          ) : (
                            <div className="px-4 py-2 text-sm text-gray-500">{t('notifications.empty')}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Profile Dropdown */}
                  <div className="relative" ref={profileRef}>
                    <button
                      onClick={() => setShowProfileMenu(!showProfileMenu)}
                      className="flex items-center gap-2 px-2 py-1 rounded-md text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none"
                    >
                      {/* Avatar circle */}
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                        {getInitials(user.email)}
                      </div>
                      <span className="text-sm text-gray-700 max-w-[140px] truncate hidden sm:block">
                        {user.email}
                      </span>
                      <ChevronDownIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    </button>

                    {/* Profile Menu Dropdown */}
                    {showProfileMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 border border-gray-200">
                        {/* Email shown on small screens */}
                        <div className="px-4 py-2 border-b border-gray-100 sm:hidden">
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>

                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            setShowSettings(true);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>
                          {t('profile.settings')}
                        </button>

                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            logout();
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                          </svg>
                          {t('profile.signOut')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <Link
                  href="/auth"
                  className="text-gray-600 hover:text-gray-900"
                >
                  {t('auth.signInLink')}
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Settings Panel (modal) */}
      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
