/**
 * Capacity configuration model (requirement 3/4/6).
 *
 * Persistent per-project member daily hours: weekday default 8h, weekend
 * default 0h; per-date overrides (incl. working weekends); days off at
 * individual / project / group scope.
 *
 * Precedence (total, deterministic — leave always wins):
 *
 *   individual day off > group day off > project day off
 *   > explicit date override > weekday/weekend defaults
 *
 * A day off at ANY scope yields 0 hours — including dates that carry a
 * date override (a later-added project/group leave must never be revived
 * by a stale override). A date override wins only over defaults, e.g. to
 * make a Saturday a working 8h day when no leave covers it.
 */

export interface DayOffRange {
  id: string;
  /** individual | project | group */
  scope: 'individual' | 'project' | 'group';
  /** resource member id (individual scope) */
  memberKey?: string;
  /** group id (group scope) */
  groupId?: string;
  startDate: string; // yyyy-MM-dd inclusive
  endDate: string;   // yyyy-MM-dd inclusive
  reason?: string;
}

export interface CapacityConfig {
  /** Hours per weekday. Default 8. */
  weekdayHours: number;
  /** Hours per weekend day. Default 0. */
  weekendHours: number;
  /** Explicit per-date hours, e.g. { '2026-09-12': 8 } (working Saturday). */
  dateOverrides: Record<string, number>;
}

export const DEFAULT_CAPACITY: CapacityConfig = {
  weekdayHours: 8,
  weekendHours: 0,
  dateOverrides: {},
};

export type CapacityResolver = (date: Date) => number;

function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function inRange(key: string, start: string, end: string): boolean {
  return key >= start && key <= end;
}

/** Days off that apply to a member on a given date key, best (most specific)
 * scope first. Returns null when no day off applies. */
export function findDayOff(
  key: string,
  memberKey: string | undefined,
  memberGroupIds: string[],
  daysOff: DayOffRange[]
): DayOffRange | null {
  const applicable = daysOff.filter((off) => {
    if (!inRange(key, off.startDate, off.endDate)) return false;
    switch (off.scope) {
      case 'individual':
        return !!memberKey && off.memberKey === memberKey;
      case 'group':
        return !!off.groupId && memberGroupIds.includes(off.groupId);
      case 'project':
        return true;
      default:
        return false;
    }
  });
  if (applicable.length === 0) return null;
  const rank = (o: DayOffRange) =>
    o.scope === 'individual' ? 0 : o.scope === 'group' ? 1 : 2;
  return applicable.sort((a, b) => rank(a) - rank(b))[0];
}

export function isDayOff(
  date: Date,
  memberKey: string | undefined,
  memberGroupIds: string[],
  daysOff: DayOffRange[]
): boolean {
  return findDayOff(toKey(date), memberKey, memberGroupIds, daysOff) !== null;
}

/**
 * Effective available hours for one member on a date (before task/commitment
 * usage). Day off at any scope → 0 (leave has precedence over everything,
 * including date overrides). Date override → exact value (can revive a
 * weekend as a working day when no leave covers it). Otherwise weekday /
 * weekend defaults.
 */
export function effectiveHoursForDay(
  date: Date,
  config: CapacityConfig,
  memberKey: string | undefined,
  memberGroupIds: string[],
  daysOff: DayOffRange[]
): number {
  const key = toKey(date);
  if (isDayOff(date, memberKey, memberGroupIds, daysOff)) {
    return 0;
  }
  if (key in config.dateOverrides) {
    return Math.max(0, config.dateOverrides[key]);
  }
  const day = date.getDay();
  const weekend = day === 0 || day === 6;
  return Math.max(0, weekend ? config.weekendHours : config.weekdayHours);
}

/**
 * Build a capacity resolver for one member. Used by the scheduler to replace
 * the hard-coded 8h/weekend-0 rule.
 */
export function buildCapacityResolver(
  config: CapacityConfig,
  memberKey: string | undefined,
  memberGroupIds: string[],
  daysOff: DayOffRange[]
): CapacityResolver {
  return (date: Date) =>
    effectiveHoursForDay(date, config, memberKey, memberGroupIds, daysOff);
}
