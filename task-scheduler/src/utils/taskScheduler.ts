import { Task, groupTasksByEmployee } from '@/types/task';

export function calculateTaskDates(tasks: Task[]): Task[] {
  // Nhóm tasks theo employee_id
  const tasksByEmployee = groupTasksByEmployee(tasks);
  const updatedTasks: Task[] = [];
  
  // Xử lý từng nhóm task của mỗi employee
  Object.values(tasksByEmployee).forEach(employeeTasks => {
    // Sắp xếp tasks theo thứ tự trong list (priority_order)
    const sortedTasks = [...employeeTasks].sort((a, b) => a.priority_order - b.priority_order);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let currentDate = new Date(today);
    
    // Xử lý từng task theo thứ tự
    sortedTasks.forEach(task => {
      const updatedTask = { ...task };
      
      if (task.start_date) {
        // Nếu task đã có start_date thì giữ nguyên
        updatedTask.start_date = new Date(task.start_date);
        const daysNeeded = Math.ceil(task.effort / 8);
        const endDate = new Date(task.start_date);
        endDate.setDate(endDate.getDate() + daysNeeded - 1);
        updatedTask.end_date = endDate;
        
        // Cập nhật ngày bắt đầu cho task tiếp theo
        currentDate = new Date(endDate);
        currentDate.setDate(currentDate.getDate() + 1);
      } else {
        // Nếu là task đầu tiên không có start_date, bắt đầu từ ngày hiện tại
        // Nếu không phải task đầu tiên, bắt đầu từ ngày sau khi task trước kết thúc
        updatedTask.start_date = new Date(currentDate);
        
        // Tính số ngày cần để hoàn thành task (1 ngày = 8 giờ)
        const daysNeeded = Math.ceil(task.effort / 8);
        
        // Tính ngày kết thúc
        const endDate = new Date(currentDate);
        endDate.setDate(endDate.getDate() + daysNeeded - 1);
        updatedTask.end_date = endDate;
        
        // Cập nhật ngày bắt đầu cho task tiếp theo
        currentDate = new Date(endDate);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      updatedTasks.push(updatedTask);
    });
  });
  
  // Sắp xếp lại theo thứ tự ưu tiên để trả về
  return updatedTasks.sort((a, b) => a.priority_order - b.priority_order);
}
