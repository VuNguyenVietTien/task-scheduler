#!/bin/bash

# Đường dẫn tuyệt đối đến thư mục dự án
PROJECT_ROOT="/Users/TienVNV/Desktop/ProjectManager"

# Chức năng để hiển thị thông báo có màu sắc
function echo_color() {
  local color=$1
  local message=$2
  
  case $color in
    "red") echo -e "\033[0;31m$message\033[0m" ;;
    "green") echo -e "\033[0;32m$message\033[0m" ;;
    "yellow") echo -e "\033[0;33m$message\033[0m" ;;
    "blue") echo -e "\033[0;34m$message\033[0m" ;;
    *) echo "$message" ;;
  esac
}

# Hiển thị thông báo chào mừng
echo_color "blue" "=== Khởi động Task Scheduler System ==="

# Kiểm tra xem thư mục dự án có tồn tại không
if [ ! -d "$PROJECT_ROOT" ]; then
  echo_color "red" "Lỗi: Thư mục dự án không tồn tại: $PROJECT_ROOT"
  exit 1
fi

# Di chuyển đến thư mục gốc của dự án
cd "$PROJECT_ROOT"

# Khởi động backend
echo_color "yellow" "Khởi động Backend Server..."
cd task-scheduler-backend
# Sử dụng osascript cho macOS
osascript -e 'tell application "Terminal" to do script "cd '"$PROJECT_ROOT"'/task-scheduler-backend && cargo run"'

# Chờ backend khởi động
echo_color "yellow" "Đợi backend khởi động (5 giây)..."
sleep 5

# Khởi động frontend
echo_color "yellow" "Khởi động Frontend Server..."
cd ../task-scheduler-frontend
osascript -e 'tell application "Terminal" to do script "cd '"$PROJECT_ROOT"'/task-scheduler-frontend && npm run dev"'

echo_color "green" "Các máy chủ đang khởi động! Truy cập frontend tại http://localhost:3000" 