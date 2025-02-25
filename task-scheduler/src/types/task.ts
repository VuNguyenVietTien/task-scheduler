export type TaskStatus = 'todo' | 'doing' | 'pending' | 'complete' | 'done';

// Helper function để nhóm task theo employee
export function groupTasksByEmployee(tasks: Task[]): Record<string, Task[]> {
  return tasks.reduce((acc, task) => {
    if (!acc[task.employee_id]) {
      acc[task.employee_id] = [];
    }
    acc[task.employee_id].push(task);
    return acc;
  }, {} as Record<string, Task[]>);
}

export interface Task {
  task_id: number;
  task_name: string;
  effort: number;
  priority_order: number;
  employee_id: string;
  start_date?: Date;
  end_date?: Date;
  status: TaskStatus;
}

export function getStatusColor(status: TaskStatus): string {
  // Sử dụng màu sáng và hiện đại từ các hệ thống như Asana/Monday
  const colors = {
    todo: '#4573D2',      // Bright Blue
    doing: '#876AF3',     // Vibrant Purple
    pending: '#FF7B4D',   // Coral Orange
    complete: '#3CC881',  // Fresh Green
    done: '#00C2C2'       // Turquoise
  };
  return colors[status];
}
