import React from 'react';
import { UserTag } from './UserTag';
import { UserSelect } from './UserSelect';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  email: string;
  photoURL?: string | null;
}

interface UserTagInputProps {
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

export const UserTagInput: React.FC<UserTagInputProps> = ({
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
  const availableUsers = users.filter(
    (user) => !selectedUsers.some((selected) => selected.id === user.id)
  );

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
        <div className="flex flex-wrap gap-2">
          {selectedUsers.map((user) => (
            <UserTag
              key={user.id}
              user={user}
              onRemove={() => onRemove(user)}
            />
          ))}
        </div>

        <UserSelect
          users={availableUsers}
          selectedUser={null}
          onSelect={onSelect}
          placeholder="Thêm người dùng..."
        />
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}; 