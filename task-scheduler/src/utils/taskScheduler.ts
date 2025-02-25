import { Task } from '@/types/task';

function groupTasksByEmployee(tasks: Task[]): Record<string, Task[]> {
  if (!tasks || !Array.isArray(tasks)) {
    return {};
  }
  
  return tasks.reduce((groups, task) => {
    task.assignees?.forEach(assignee => {
      if (assignee && assignee.id) {
        groups[assignee.id] = groups[assignee.id] || [];
        groups[assignee.id].push(task);
      } 
    });
    return groups;
  }, {} as Record<string, Task[]>);
}

export function calculateTaskDates(tasks: Task[]): Task[] {
  // Nhóm tasks theo employee_id
  if (!tasks || !Array.isArray(tasks)) {
    return [];
  }
  
  const tasksByEmployee = groupTasksByEmployee(tasks);
  const updatedTasks: Task[] = [];
  
  // Xử lý từng nhóm task của mỗi employee
  Object.values(tasksByEmployee).forEach(employeeTasks => {
    // Sắp xếp tasks theo thứ tự trong list (priority_order)
    const sortedTasks = [...employeeTasks].sort((a, b) => a.priority.localeCompare(b.priority));
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let currentDate = new Date(today);
    
    // Xử lý từng task theo thứ tự
    sortedTasks.forEach(task => {
      const updatedTask = { ...task };
      
      if (task.startDate) {
        // Nếu task đã có start_date thì giữ nguyên
        updatedTask.startDate = new Date(task.startDate).toISOString();
        const daysNeeded = Math.ceil((task.effortHours || 8) / 8);
        const endDate = new Date(task.startDate);
        endDate.setDate(endDate.getDate() + daysNeeded - 1);
        updatedTask.deadline = endDate.toISOString();
        
        // Cập nhật ngày bắt đầu cho task tiếp theo 
        currentDate = new Date(endDate);
        currentDate.setDate(currentDate.getDate() + 1);
      } else {
        // Nếu là task đầu tiên không có start_date, bắt đầu từ ngày hiện tại
        // Nếu không phải task đầu tiên, bắt đầu từ ngày sau khi task trước kết thúc
        updatedTask.startDate = new Date(currentDate).toISOString();
        
        // Tính số ngày cần để hoàn thành task (1 ngày = 8 giờ)
        const daysNeeded = Math.ceil((task.effortHours || 8) / 8);
        
        // Tính ngày kết thúc
        const endDate = new Date(currentDate);
        endDate.setDate(endDate.getDate() + daysNeeded - 1);
        updatedTask.deadline = endDate.toISOString();
        
        // Cập nhật ngày bắt đầu cho task tiếp theo
        currentDate = new Date(endDate);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      updatedTasks.push(updatedTask);
    });
  });
  
  // Sắp xếp lại theo thứ tự ưu tiên để trả về
  return updatedTasks.sort((a, b) => a.priority.localeCompare(b.priority));
}
