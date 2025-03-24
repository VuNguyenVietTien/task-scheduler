import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MemberRole, getRoleDisplayName, getRolePermissions } from '@/types/project';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { InfoIcon } from 'lucide-react';

interface MemberRoleSelectProps {
  value: MemberRole;
  onChange: (value: MemberRole) => void;
  disabled?: boolean;
  className?: string;
}

export const MemberRoleSelect: React.FC<MemberRoleSelectProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
}) => {
  const roles: MemberRole[] = ['ADMIN', 'MEMBER', 'VIEWER'];
  const permissions = getRolePermissions(value);

  return (
    <div className="flex items-center gap-2">
      <Select
        value={value}
        onValueChange={(newValue) => onChange(newValue as MemberRole)}
        disabled={disabled}
      >
        <SelectTrigger className={`w-[180px] ${className}`}>
          <SelectValue placeholder="Chọn vai trò" />
        </SelectTrigger>
        <SelectContent>
          {roles.map((role) => (
            <SelectItem key={role} value={role}>
              {getRoleDisplayName(role)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <InfoIcon className="h-4 w-4 text-gray-500 cursor-help" />
          </TooltipTrigger>
          <TooltipContent className="max-w-[300px]">
            <div className="space-y-2">
              <p className="font-medium">Quyền hạn:</p>
              <ul className="list-disc list-inside space-y-1">
                {permissions.map((permission, index) => (
                  <li key={index} className="text-sm">{permission}</li>
                ))}
              </ul>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}; 