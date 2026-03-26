import React from 'react';
import { UserTag } from './UserTag';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  email: string;
  photoURL?: string | null;
}

interface UserTagListProps {
  users: User[];
  onRemove?: (user: User) => void;
  className?: string;
}

export const UserTagList: React.FC<UserTagListProps> = ({
  users,
  onRemove,
  className = ''
}) => {
  if (users.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {users.map((user) => (
        <UserTag
          key={user.id}
          user={user}
          onRemove={onRemove ? () => onRemove(user) : undefined}
        />
      ))}
    </div>
  );
}; 