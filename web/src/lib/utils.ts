import { format } from 'date-fns';
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { MemberRole } from "@/types/project"
import { MemberRole as MemberRoleType } from "@/types/members"

// Trả về mảng các ngày từ startDate đến endDate (bao gồm cả 2 ngày này)
export function getDatesBetween(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const currentDate = new Date(startDate);

  // Đảm bảo sao chép ngày để không thay đổi tham số gốc
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Điều chỉnh thời gian về 00:00:00 để so sánh chính xác
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  currentDate.setHours(0, 0, 0, 0);

  // Thêm ngày bắt đầu
  dates.push(new Date(currentDate));
  
  // Thêm các ngày ở giữa
  while (currentDate < end) {
    currentDate.setDate(currentDate.getDate() + 1);
    dates.push(new Date(currentDate));
  }

  return dates;
}

// Hiển thị khoảng thời gian giữa 2 ngày
export function formatDateRange(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) return 'No dates set';
  if (!startDate) return `Due ${format(new Date(endDate!), 'dd/MM/yyyy')}`;
  if (!endDate) return `From ${format(new Date(startDate), 'dd/MM/yyyy')}`;

  const start = format(new Date(startDate), 'dd/MM/yyyy');
  const end = format(new Date(endDate), 'dd/MM/yyyy');

  return `${start} - ${end}`;
}

// Kết hợp các class name
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Chuyển đổi ngày về định dạng YYYY-MM-DD với múi giờ Việt Nam
export function formatDateVN(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Hiển thị ngày dưới định dạng chuẩn để debug
export function debugDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// So sánh 2 ngày (chỉ so sánh ngày, tháng, năm - không quan tâm giờ)
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function normalizeRole(role: string): MemberRole {
  const normalized = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  if (['Manager', 'Leader', 'Member', 'Guest'].includes(normalized)) {
    return normalized as MemberRole;
  }
  // Backward compatibility
  const mapping: Record<string, MemberRole> = {
    'Admin': 'Manager',
    'Viewer': 'Guest',
  };
  if (mapping[normalized]) return mapping[normalized];
  throw new Error(`Invalid role: ${role}`);
}

export function formatRole(role: MemberRole): string {
  switch (role) {
    case 'Manager':
      return 'Manager';
    case 'Leader':
      return 'Leader';
    case 'Member':
      return 'Member';
    case 'Guest':
      return 'Guest';
    default:
      return role;
  }
}

export function getRoleColor(role: MemberRole): string {
  switch (role) {
    case 'Manager':
      return 'bg-red-100 text-red-800';
    case 'Leader':
      return 'bg-purple-100 text-purple-800';
    case 'Member':
      return 'bg-blue-100 text-blue-800';
    case 'Guest':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getRoleIcon(role: MemberRole): string {
  switch (role) {
    case 'Manager':
      return '👑';
    case 'Leader':
      return '⭐';
    case 'Member':
      return '👤';
    case 'Guest':
      return '👁️';
    default:
      return '👤';
  }
}

export const toBackendRole = (role: MemberRoleType): string => {
  return role.toLowerCase();
};

export const toFrontendRole = (role: string): MemberRoleType => {
  // Map backend role names to frontend
  const mapping: Record<string, MemberRoleType> = {
    'manager': 'Manager',
    'leader': 'Leader',
    'member': 'Member',
    'guest': 'Guest',
    // Backward compatibility
    'admin': 'Manager',
    'viewer': 'Guest',
  };
  return mapping[role.toLowerCase()] || 'Member';
};
