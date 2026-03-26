import React from 'react';
import { UserTagSelect } from './UserTagSelect';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  email: string;
  photoURL?: string | null;
}

interface UserTagSelectFieldProps {
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

export const UserTagSelectField: React.FC<UserTagSelectFieldProps> = ({
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
      <UserTagSelect
        id={id}
        name={name}
        label={label}
        users={users}
        selectedUsers={selectedUsers}
        onSelect={onSelect}
        onRemove={onRemove}
        required={required}
        error={error}
      />
    </div>
  );
}; 