/**
 * Shared display labels for task enums.
 * Used across all views (Gantt, Kanban, TaskList, TaskDetail) for consistent Vietnamese labels.
 */

// Task status labels
export const STATUS_LABELS: Record<string, string> = {
  todo: 'Cần làm',
  doing: 'Đang làm',
  done: 'Hoàn thành',
  close: 'Đóng',
  pending: 'Chờ xử lý',
  review: 'Đang review',
  blocked: 'Bị chặn',
  rejected: 'Từ chối',
  archived: 'Lưu trữ',
};

// Priority labels
export const PRIORITY_LABELS: Record<string, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  urgent: 'Khẩn cấp',
  critical: 'Nghiêm trọng',
};

// Task type labels
export const TYPE_LABELS: Record<string, string> = {
  Feature: 'Tính năng',
  Bug: 'Lỗi',
  Enhancement: 'Cải tiến',
  Documentation: 'Tài liệu',
};

// Task category labels
export const CATEGORY_LABELS: Record<string, string> = {
  Frontend: 'Giao diện',
  Backend: 'Máy chủ',
  Design: 'Thiết kế',
  Testing: 'Kiểm thử',
  DevOps: 'Vận hành',
};

// Progress type labels
export const PROGRESS_TYPE_LABELS: Record<string, string> = {
  study: 'Nghiên cứu',
  investigate: 'Điều tra',
  code: 'Lập trình',
  test: 'Kiểm thử',
  review_code: 'Review code',
  review_test_report: 'Review báo cáo',
  release: 'Phát hành',
};

/**
 * Get Vietnamese label for any enum value.
 * Falls back to the raw value if no label found, or placeholder if null/undefined.
 */
export function getLabel(map: Record<string, string>, value: string | null | undefined, placeholder = 'Chưa thiết lập'): string {
  if (!value) return placeholder;
  return map[value] || map[value.toLowerCase()] || value;
}
