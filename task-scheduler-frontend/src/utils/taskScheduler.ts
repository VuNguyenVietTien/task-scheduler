import { Task, TaskStatus } from '@/types/task';

export function calculateTaskDates(tasks: Task[]): Task[] {
  if (!tasks || !Array.isArray(tasks)) {
    return [];
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    // If both tasks have start dates, sort by date
    if (a.startDate && b.startDate) {
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    }
    
    // If neither has a start date, sort by priority order
    if (!a.startDate && !b.startDate) {
      return a.priorityOrder - b.priorityOrder;
    }
    
    // Tasks with start dates come first
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    
    return 0;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const processedTasks: Task[] = [];
  let lastEndDate: Date | null = null;

  sortedTasks.forEach(task => {
    const updatedTask = { ...task };
    const daysNeeded = Math.ceil((task.effortHours || 8) / 8);

    // Case 1: Task has both startDate and deadline
    if (task.startDate && task.deadline) {
      return;
    }

    // Case 2: Task has only deadline
    if (task.deadline && !task.startDate) {
      const endDate = new Date(task.deadline);
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - daysNeeded + 1);
      updatedTask.startDate = startDate.toISOString();
    }
    // Case 3: Task has only startDate
    else if (task.startDate && !task.deadline) {
      const startDate = new Date(task.startDate);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + daysNeeded - 1);
      updatedTask.deadline = endDate.toISOString();
    }
    // Case 4: Task has neither
    else {
      let startDate: Date;
      
      if (lastEndDate) {
        // Start after the previous task
        startDate = new Date(lastEndDate);
        startDate.setDate(startDate.getDate() + 1);
      } else {
        // Start from today
        startDate = new Date(today);
      }

      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + daysNeeded - 1);

      updatedTask.startDate = startDate.toISOString();
      updatedTask.deadline = endDate.toISOString();
      lastEndDate = endDate;
    }

    if (updatedTask.deadline) {
      lastEndDate = new Date(updatedTask.deadline);
    }

    processedTasks.push(updatedTask);
  });

  return processedTasks.sort((a, b) => {
    // Sort by start date if both have it
    if (a.startDate && b.startDate) {
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    }
    
    // Sort by priority order for tasks without dates
    if (!a.startDate && !b.startDate) {
      return a.priorityOrder - b.priorityOrder;
    }
    
    // Tasks with dates come first
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    
    return 0;
  });
}
