import { Task } from '@/types/task';

export const HOURS_PER_DAY = 8;

interface TaskInterval {
  start: Date;
  end: Date;
}

interface ScheduledTask extends Task {
  intervals: TaskInterval[];
}

export const calculateSchedule = (tasks: Task[]): ScheduledTask[] => {
  let currentDate = new Date();
  
  return tasks
    .sort((a, b) => a.priorityOrder - b.priorityOrder)
    .map(task => {
      const days = Math.ceil((task.effortHours || 0) / HOURS_PER_DAY);
      const start = task.startDate ? new Date(task.startDate) : currentDate;
      const end = new Date(start);
      end.setDate(start.getDate() + days);
      
      currentDate = new Date(end);
      
      return {
        ...task,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        intervals: [{ start, end }]
      };
    });
};
