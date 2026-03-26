import React from 'react';
import { MemberRole } from '@/types/project';
import { getRoleColor, getRoleIcon, formatRole } from '@/lib/utils';

interface RoleBadgeProps {
  role: MemberRole;
  className?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({
  role,
  className = '',
}) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(role)} ${className}`}
    >
      <span>{getRoleIcon(role)}</span>
      {formatRole(role)}
    </span>
  );
}; 