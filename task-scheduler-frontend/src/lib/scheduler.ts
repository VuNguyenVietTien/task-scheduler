import { Task } from '@/types/task';

export const HOURS_PER_DAY = 8;

export const calculateSchedule = (tasks: Task[]): Task[] => {
  let currentDate = new Date();
  
  return tasks
    .sort((a, b) => a.priority_order - b.priority_order)
    .map(task => {
      const days = Math.ceil(task.effort / HOURS_PER_DAY);
      const start = task.start_date || currentDate;
      const end = new Date(start);
      end.setDate(start.getDate() + days);
      
      currentDate = new Date(end);
      
      return {
        ...task,
        start_date: start,
        end_date: end,
        intervals: task.intervals || [{ start, end }]
      };
    });
};
