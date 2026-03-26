import {
  formatDate,
  cn,
  generateId,
  truncateText,
  calculateTimeLeft,
  isOverdue,
  isNearDeadline,
  getInitials
} from '../utils';

describe('Utils Functions', () => {
  beforeAll(() => {
    // Mock Date.now() for consistent testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-02-25T12:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('formatDate', () => {
    it('formats today\'s date correctly', () => {
      const today = new Date('2025-02-25T15:30:00Z');
      expect(formatDate(today.toISOString())).toContain('Today at');
    });

    it('formats tomorrow\'s date correctly', () => {
      const tomorrow = new Date('2025-02-26T15:30:00Z');
      expect(formatDate(tomorrow.toISOString())).toContain('Tomorrow at');
    });

    it('formats date within 7 days correctly', () => {
      const nextWeek = new Date('2025-02-28T15:30:00Z');
      expect(formatDate(nextWeek.toISOString())).toContain('Friday');
    });

    it('formats date in same year correctly', () => {
      const sameYear = new Date('2025-06-15T15:30:00Z');
      expect(formatDate(sameYear.toISOString())).toContain('Jun');
    });

    it('formats date in different year correctly', () => {
      const differentYear = new Date('2026-02-25T15:30:00Z');
      expect(formatDate(differentYear.toISOString())).toContain('2026');
    });
  });

  describe('cn (classNames)', () => {
    it('combines class names correctly', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2');
      expect(cn('class1', undefined, 'class2')).toBe('class1 class2');
      expect(cn('class1', null, false, 'class2')).toBe('class1 class2');
    });

    it('handles empty inputs', () => {
      expect(cn()).toBe('');
      expect(cn(undefined, null, false)).toBe('');
    });
  });

  describe('generateId', () => {
    it('generates unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('generates string IDs', () => {
      expect(typeof generateId()).toBe('string');
    });
  });

  describe('truncateText', () => {
    it('truncates text when longer than maxLength', () => {
      expect(truncateText('Hello World', 5)).toBe('Hello...');
    });

    it('does not truncate text when shorter than maxLength', () => {
      expect(truncateText('Hello', 10)).toBe('Hello');
    });

    it('handles exact length', () => {
      expect(truncateText('Hello', 5)).toBe('Hello');
    });
  });

  describe('calculateTimeLeft', () => {
    it('calculates time left correctly', () => {
      const future = new Date('2025-02-26T12:00:00Z'); // 24 hours ahead
      const timeLeft = calculateTimeLeft(future.toISOString());
      expect(timeLeft.days).toBe(1);
      expect(timeLeft.hours).toBe(0);
    });

    it('handles past dates', () => {
      const past = new Date('2025-02-24T12:00:00Z');
      const timeLeft = calculateTimeLeft(past.toISOString());
      expect(timeLeft.days).toBeLessThan(0);
    });
  });

  describe('isOverdue', () => {
    it('returns true for past dates', () => {
      const past = new Date('2025-02-24T12:00:00Z');
      expect(isOverdue(past.toISOString())).toBe(true);
    });

    it('returns false for future dates', () => {
      const future = new Date('2025-02-26T12:00:00Z');
      expect(isOverdue(future.toISOString())).toBe(false);
    });
  });

  describe('isNearDeadline', () => {
    it('returns true for deadlines within threshold', () => {
      const nearDeadline = new Date('2025-02-25T18:00:00Z'); // 6 hours from now
      expect(isNearDeadline(nearDeadline.toISOString())).toBe(true);
    });

    it('returns false for deadlines beyond threshold', () => {
      const farDeadline = new Date('2025-02-27T12:00:00Z');
      expect(isNearDeadline(farDeadline.toISOString())).toBe(false);
    });

    it('returns false for past deadlines', () => {
      const pastDeadline = new Date('2025-02-24T12:00:00Z');
      expect(isNearDeadline(pastDeadline.toISOString())).toBe(false);
    });
  });

  describe('getInitials', () => {
    it('gets initials from full name', () => {
      expect(getInitials('John Doe')).toBe('JD');
    });

    it('handles single word names', () => {
      expect(getInitials('John')).toBe('J');
    });

    it('handles multiple word names', () => {
      expect(getInitials('John Middle Doe')).toBe('JM');
    });

    it('handles empty string', () => {
      expect(getInitials('')).toBe('');
    });
  });
});
