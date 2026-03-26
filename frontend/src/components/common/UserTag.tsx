import React from 'react';
import { UserAvatar } from './UserAvatar';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  email: string;
  photoURL?: string | null;
}

interface UserTagProps {
  user: User;
  onRemove?: () => void;
  className?: string;
}

export const UserTag: React.FC<UserTagProps> = ({
  user,
  onRemove,
  className = ''
}) => {
  return (
    <div
      className={cn(
        'inline-flex items-center px-2 py-1 rounded-full bg-gray-100',
        className
      )}
    >
      <UserAvatar
        src={user.photoURL}
        alt={user.name}
        size="sm"
        className="mr-2"
      />
      <span className="text-sm font-medium text-gray-900">
        {user.name}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 text-gray-400 hover:text-gray-600"
          aria-label={`Xóa ${user.name}`}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}; 