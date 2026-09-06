/**
 * Recurring project/group commitments (requirement 6).
 *
 * Finite personal tasks live in the normal task list; recurring commitments
 * (daily standup, weekly sync, monthly review, …) have a fixed start time and
 * duration and are expanded — with a hard bound — into concrete occurrences
 * so attendee capacity can be reserved BEFORE finite priority tasks are
 * scheduled.
 *
 * Overlap handling: occurrences that overlap in one day are merged (union of
 * time intervals) so overlapping meetings never double-subtract capacity; the
 * per-day reservation is capped at the day's capacity.
 */

export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface RecurringCommitment {
  id: string;
  projectId: string;
  title: string;
  /** PROJECT applies to every project member; GROUP only to group members. */
  scope: 'PROJECT' | 'GROUP';
  groupId?: string | null;
  frequency: RecurrenceFrequency;
  /** Every `interval` periods (1 = every day/week/month). Default 1. */
  interval?: number;
  /** 0=Sun … 6=Sat — required for WEEKLY. */
  weekday?: number | null;
  /** Day of month 1..31 — required for MONTHLY; skipped on short months. */
  monthDay?: number | null;
  /** Inclusive first occurrence date (yyyy-MM-dd). */
  startDate: string;
  /** Inclusive last occurrence date; null = unbounded (horizon caps it). */
  endDate?: string | null;
  /** Fixed hour of day the commitment starts (0..23). */
  startHour: number;
  /** Duration in hours (0 < d <= 24). */
  durationHours: number;
}

export interface CommitmentOccurrence {
  commitmentId: string;
  title: string;
  date: string; // yyyy-MM-dd
  startHour: number;
  endHour: number; // capped at 24
}

/** Hard bound on expansion so unbounded rules can never explode. */
export const MAX_OCCURRENCES = 500;

function toDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Start of the calendar week (Sunday) containing `date`. */
function sundayOf(date: Date): Date {
  return addDays(date, -date.getDay());
}

/** Whole days between two dates (b - a). */
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export interface CommitmentExpansion {
  occurrences: CommitmentOccurrence[];
  /** True when `maxOccurrences` cut the expansion while more occurrences
   * still existed inside the horizon — the result is INCOMPLETE and callers
   * must not treat the rule as fully applied. False = complete for [from,to]. */
  truncated: boolean;
}

/** Expand one commitment into occurrences within [from, to].
 *
 * Bounded by the EXPLICIT scheduling horizon [from, to] and the result cap
 * `maxOccurrences` — never by an internal day-scan budget, so sparse rules
 * (weekly/monthly over long horizons) are not silently lost. Truncation is
 * reported via the detailed variant below. */
export function expandCommitment(
  c: RecurringCommitment,
  from: string,
  to: string,
  maxOccurrences = MAX_OCCURRENCES
): CommitmentOccurrence[] {
  return expandCommitmentDetailed(c, from, to, maxOccurrences).occurrences;
}

export function expandCommitmentDetailed(
  c: RecurringCommitment,
  from: string,
  to: string,
  maxOccurrences = MAX_OCCURRENCES
): CommitmentExpansion {
  if (c.durationHours <= 0 || c.startHour < 0 || c.startHour > 23) {
    return { occurrences: [], truncated: false };
  }
  const fromDate = toDate(from);
  const untilDate = toDate(to);
  const ruleStart = toDate(c.startDate);
  const ruleEnd = c.endDate ? toDate(c.endDate) : null;
  const interval = Math.max(1, c.interval ?? 1);

  const occurrences: CommitmentOccurrence[] = [];
  let truncated = false;
  let cursor = fromDate;
  if (ruleStart > cursor) cursor = ruleStart;

  // Scan day by day across the horizon; the ONLY bounds are the horizon and
  // the result cap. cursor strictly advances, so the loop terminates.
  for (; cursor <= untilDate; cursor = addDays(cursor, 1)) {
    if (ruleEnd && cursor > ruleEnd) break;
    const key = toKey(cursor);
    let matches = false;
    if (c.frequency === 'DAILY') {
      // Days elapsed since rule start, in whole days.
      const elapsed = daysBetween(ruleStart, cursor);
      matches = elapsed >= 0 && elapsed % interval === 0;
    } else if (c.frequency === 'WEEKLY') {
      // Occurrences are the selected weekday inside every `interval`-th week,
      // with weeks ANCHORED to the rule start's calendar week (Sunday start).
      // A Monday start with Wednesday selected therefore DOES produce
      // Wednesday occurrences (in week 0, 0+interval, …), never zero.
      const wd = c.weekday ?? ruleStart.getDay();
      if (cursor.getDay() === wd) {
        const weekIndex = Math.floor(daysBetween(sundayOf(ruleStart), sundayOf(cursor)) / 7);
        matches = weekIndex >= 0 && weekIndex % interval === 0;
      }
    } else if (c.frequency === 'MONTHLY') {
      const target = c.monthDay ?? ruleStart.getDate();
      matches = cursor.getDate() === target;
      if (matches && interval > 1) {
        const monthDiff =
          (cursor.getFullYear() - ruleStart.getFullYear()) * 12 +
          (cursor.getMonth() - ruleStart.getMonth());
        matches = monthDiff % interval === 0;
      }
    }
    if (matches) {
      if (occurrences.length >= maxOccurrences) {
        // One more match exists inside the horizon: report truncation.
        truncated = true;
        break;
      }
      occurrences.push({
        commitmentId: c.id,
        title: c.title,
        date: key,
        startHour: c.startHour,
        endHour: Math.min(24, c.startHour + c.durationHours),
      });
    }
  }
  return { occurrences, truncated };
}

export function expandCommitments(
  commitments: RecurringCommitment[],
  from: string,
  to: string,
  maxOccurrences = MAX_OCCURRENCES
): CommitmentOccurrence[] {
  return expandCommitmentsDetailed(commitments, from, to, maxOccurrences).occurrences;
}

/** Aggregate expansion with per-rule truncation flags (see
 * `expandCommitmentDetailed`). */
export function expandCommitmentsDetailed(
  commitments: RecurringCommitment[],
  from: string,
  to: string,
  maxOccurrences = MAX_OCCURRENCES
): CommitmentExpansion & { truncatedRules: string[] } {
  const truncatedRules: string[] = [];
  const all: CommitmentOccurrence[] = [];
  for (const c of commitments) {
    const r = expandCommitmentDetailed(c, from, to, maxOccurrences);
    all.push(...r.occurrences);
    if (r.truncated) truncatedRules.push(c.id);
  }
  all.sort((a, b) =>
    a.date === b.date ? a.startHour - b.startHour : a.date < b.date ? -1 : 1
  );
  return { occurrences: all, truncated: truncatedRules.length > 0, truncatedRules };
}

/** Does a commitment reserve capacity for this member? */
export function commitmentAppliesToMember(
  c: RecurringCommitment,
  memberKey: string | undefined,
  memberGroupIds: string[]
): boolean {
  if (c.scope === 'PROJECT') return true;
  return !!c.groupId && memberGroupIds.includes(c.groupId);
}

/**
 * Reserved hours per date for one member, merging overlapping occurrence
 * intervals (union) so overlaps never double-subtract. Result feeds the
 * scheduler's WorkSchedule as pre-consumed hours.
 */
export function reservedHoursByDate(
  occurrences: CommitmentOccurrence[],
  dayCapacity: (date: string) => number
): Record<string, number> {
  const byDate: Record<string, CommitmentOccurrence[]> = {};
  for (const o of occurrences) {
    (byDate[o.date] ??= []).push(o);
  }
  const reserved: Record<string, number> = {};
  for (const [date, list] of Object.entries(byDate)) {
    const intervals = list
      .map((o) => [o.startHour, o.endHour] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    let total = 0;
    let curStart = intervals[0][0];
    let curEnd = intervals[0][1];
    for (const [s, e] of intervals.slice(1)) {
      if (s <= curEnd) {
        curEnd = Math.max(curEnd, e); // merge overlap / adjacency
      } else {
        total += curEnd - curStart;
        curStart = s;
        curEnd = e;
      }
    }
    total += curEnd - curStart;
    const cap = dayCapacity(date);
    reserved[date] = Math.max(0, Math.min(total, cap)); // cap at capacity
  }
  return reserved;
}

/**
 * Convert reserved hours (per date) into a WorkSchedule-compatible map of
 * REMAINING hours (capacity - reserved), for dates inside [from, to] where
 * capacity > 0. Feeds `calculateTaskSchedule` / `processTasksAndUpdateStore`
 * so commitments are subtracted before finite priority tasks.
 */
export function remainingScheduleFromReserved(
  reserved: Record<string, number>,
  capacity: (date: Date) => number,
  from: string,
  to: string
): Record<string, number> {
  const schedule: Record<string, number> = {};
  const start = toDate(from);
  const end = toDate(to);
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    const k = toKey(d);
    if (k in reserved) {
      schedule[k] = Math.max(0, capacity(d) - reserved[k]);
    }
  }
  return schedule;
}
