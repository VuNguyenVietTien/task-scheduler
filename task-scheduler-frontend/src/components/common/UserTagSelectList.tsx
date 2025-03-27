import React from 'react';
import { UserTagSelect } from './UserTagSelect';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  email: string;
  photoURL?: string | null;
}

interface UserTagSelectListProps {
  users: User[];
  selectedUsers: User[];
  onSelect: (user: User) => void;
  onRemove: (user: User) => void;
  className?: string;
}

export const UserTagSelectList: React.FC<UserTagSelectListProps> = ({
  users,
  selectedUsers,
  onSelect,
  onRemove,
  className = ''
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      {selectedUsers.map((user) => (
        <UserTagSelect
          key={user.id}
          id={`user-${user.id}`}
          name={`user-${user.id}`}
          label={user.name}
          users={users}
          selectedUsers={[user]}
          onSelect={onSelect}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}; 