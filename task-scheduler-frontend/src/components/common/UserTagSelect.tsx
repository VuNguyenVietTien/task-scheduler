import React from 'react';
import { UserTagInput } from './UserTagInput';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  email: string;
  photoURL?: string | null;
}

interface UserTagSelectProps {
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

export const UserTagSelect: React.FC<UserTagSelectProps> = ({
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

      <UserTagInput
        id={id}
        name={name}
        label=""
        users={users}
        selectedUsers={selectedUsers}
        onSelect={onSelect}
        onRemove={onRemove}
      />

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}; 