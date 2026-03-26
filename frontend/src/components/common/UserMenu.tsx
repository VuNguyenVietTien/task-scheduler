import React from 'react';
import { Menu } from '@headlessui/react';
import { UserAvatar } from './UserAvatar';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface UserMenuProps {
  className?: string;
}

export const UserMenu: React.FC<UserMenuProps> = ({ className = '' }) => {
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  const photoURL = user.providerData[0]?.photoURL;
  const displayName = user.name;

  return (
    <Menu as="div" className={cn('relative', className)}>
      <Menu.Button className="flex items-center space-x-2">
        <UserAvatar
          src={photoURL}
          alt={displayName || user.email}
          size="sm"
        />
        <span className="text-sm font-medium text-gray-700">
          {displayName || user.email}
        </span>
      </Menu.Button>

      <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
        <div className="py-1">
          <Menu.Item>
            {({ active }) => (
              <button
                onClick={logout}
                className={cn(
                  'block w-full text-left px-4 py-2 text-sm',
                  active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                )}
              >
                Đăng xuất
              </button>
            )}
          </Menu.Item>
        </div>
      </Menu.Items>
    </Menu>
  );
}; 