import React from 'react';
import { UserTagSelect } from './UserTagSelect';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  email: string;
  photoURL?: string | null;
}

interface UserTagSelectMultipleProps {
  id: string;
  name: string;
  label: string;
  users: User[];
  selectedUsers: User[];
  onSelect: (user: User) => void;
  onRemove: (user: User) => void;
  required?: boolean;
  error?: string;
  className?: string;
}

export const UserTagSelectMultiple: React.FC<UserTagSelectMultipleProps> = ({
  id,
  name,
  label,
  users,
  selectedUsers,
  onSelect,
  onRemove,
  required = false,
  error,
  className = ''
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="space-y-2">
        {selectedUsers.map((user) => (
          <UserTagSelect
            key={user.id}
            id={`${id}-${user.id}`}
            name={`${name}-${user.id}`}
            label=""
            users={users}
            selectedUsers={[user]}
            onSelect={onSelect}
            onRemove={onRemove}
          />
        ))}

        <UserTagSelect
          id={`${id}-new`}
          name={`${name}-new`}
          label=""
          users={users.filter(
            (user) => !selectedUsers.some((selected) => selected.id === user.id)
          )}
          selectedUsers={[]}
          onSelect={onSelect}
          onRemove={onRemove}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}; 