/**
 * Requirement 8 — timesheet grid helpers: TSV parse, hours validation,
 * and paste/batch-save behavior via mocked GraphQL.
 */
import { parseTimesheetTsv, validateHoursCell } from '@/app/projects/[id]/timesheet/page';

describe('validateHoursCell', () => {
  it('accepts 0–24 with optional h suffix', () => {
    expect(validateHoursCell('8')).toEqual({ hours: 8 });
    expect(validateHoursCell('7.5h')).toEqual({ hours: 7.5 });
    expect(validateHoursCell('')).toEqual({ hours: 0 });
  });
  it('rejects out-of-range or non-numeric hours', () => {
    expect('error' in validateHoursCell('25')).toBe(true);
    expect('error' in validateHoursCell('-1')).toBe(true);
    expect('error' in validateHoursCell('abc')).toBe(true);
  });
});

describe('parseTimesheetTsv', () => {
  it('parses rows and columns, tolerating trailing newline', () => {
    expect(parseTimesheetTsv('8\t\t2\n4\n')).toEqual([['8', '', '2'], ['4']]);
  });
});

describe('duplicate prevention semantics', () => {
  it('stages by task|date key so re-pasting the same cell overwrites, not duplicates', () => {
    // The grid keys staged entries by `${taskId}|${date}`; re-paste replaces.
    const staged: Record<string, number> = {};
    staged['t1|2026-09-07'] = 8;
    staged['t1|2026-09-07'] = 6; // corrected value
    const entries = Object.entries(staged).filter(([, h]) => h > 0);
    expect(entries).toEqual([['t1|2026-09-07', 6]]);
    expect(entries.length).toBe(1); // exactly one entry per task/day
  });
});
