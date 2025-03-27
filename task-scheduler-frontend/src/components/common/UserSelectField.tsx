import React from 'react';
import { UserSelect } from './UserSelect';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  email: string;
  photoURL?: string | null;
}

interface UserSelectFieldProps {
  id: string;
  name: string;
  label: string;
  users: User[];
  selectedUser: User | null;
  onSelect: (user: User) => void;
  required?: boolean;
  error?: string;
  className?: string;
}

export const UserSelectField: React.FC<UserSelectFieldProps> = ({
  id,
  name,
  label,
  users,
  selectedUser,
  onSelect,
  required = false,
  error,
  className = ''
}) => {
  return (
    <div className={cn('space-y-1', className)}>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <UserSelect
        users={users}
        selectedUser={selectedUser}
        onSelect={onSelect}
        placeholder="Chọn người dùng..."
      />
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}; 