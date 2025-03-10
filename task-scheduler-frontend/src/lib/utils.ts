import { format } from 'date-fns';

export function getDatesBetween(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const currentDate = new Date(startDate);

  // Điều chỉnh thời gian về 00:00:00
  currentDate.setHours(0, 0, 0, 0);
  const endDateTime = new Date(endDate);
  endDateTime.setHours(0, 0, 0, 0);

  while (currentDate <= endDateTime) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
}

export function formatDateRange(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) return 'No dates set';
  if (!startDate) return `Due ${format(new Date(endDate!), 'dd/MM/yyyy')}`;
  if (!endDate) return `From ${format(new Date(startDate), 'dd/MM/yyyy')}`;

  const start = format(new Date(startDate), 'dd/MM/yyyy');
  const end = format(new Date(endDate), 'dd/MM/yyyy');

  return `${start} - ${end}`;
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
