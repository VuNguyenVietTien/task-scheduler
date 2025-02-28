export function getDatesBetween(startDate: Date, endDate: Date): Date[] {
  const dates = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
}

export function cn(...classes: string[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(date: string | Date): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatDateRange(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) return 'No dates set';
  if (!startDate) return `Due ${formatDate(endDate!)}`;
  if (!endDate) return `From ${formatDate(startDate)}`;
  return `${formatDate(startDate)} → ${formatDate(endDate)}`;
}
