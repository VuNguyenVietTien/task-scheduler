export interface DailyEffortMember {
  resourceMemberId: string;
  displayName: string;
  userId?: string | null;
}

export interface DisplayedTaskEffort {
  taskId: string;
  assigneeResourceMemberId?: string | null;
  assigneeUserId?: string | null;
  hoursPerDay: Record<string, number>;
  unknownSpan?: { start: string; end: string };
  /** Summary rows are never task effort. */
  kind?: 'TASK' | 'HEADING' | 'PHASE';
}

export interface MemberDailyEffortRow extends DailyEffortMember {
  hoursByDate: Record<string, number>;
  unknownDates: string[];
  isDiagnostic?: boolean;
}

const emptyHours = (dates: readonly string[]) =>
  Object.fromEntries(dates.map((date) => [date, 0])) as Record<string, number>;

/**
 * Projects displayed plan allocations onto members without rolling parent
 * summaries into child work. Duplicate task ids are ignored after first use.
 */
export function buildMemberDailyEffort(
  members: readonly DailyEffortMember[],
  dates: readonly string[],
  taskEfforts: readonly DisplayedTaskEffort[]
): MemberDailyEffortRow[] {
  const rowByResourceId = new Map<string, MemberDailyEffortRow>();
  const rows: MemberDailyEffortRow[] = [];
  for (const member of members) {
    if (rowByResourceId.has(member.resourceMemberId)) continue;
    const row: MemberDailyEffortRow = { ...member, hoursByDate: emptyHours(dates), unknownDates: [] };
    rowByResourceId.set(member.resourceMemberId, row);
    rows.push(row);
  }
  const resourceIdByUserId = new Map(
    members.filter((member) => member.userId).map((member) => [member.userId!, member.resourceMemberId])
  );
  const seenTaskIds = new Set<string>();

  for (const task of taskEfforts) {
    if (!task.taskId || task.kind && task.kind !== 'TASK' || seenTaskIds.has(task.taskId)) continue;
    seenTaskIds.add(task.taskId);

    // A concrete resource id wins, even when it no longer resolves. Only a
    // legacy user-only assignment may map through the canonical user relation.
    const resourceId = typeof task.assigneeResourceMemberId === 'string'
      ? task.assigneeResourceMemberId
      : task.assigneeUserId ? resourceIdByUserId.get(task.assigneeUserId) : undefined;
    let row = resourceId ? rowByResourceId.get(resourceId) : undefined;
    const assignedHours = Object.entries(task.hoursPerDay).filter(
      ([date, hours]) => dates.includes(date) && Number.isFinite(hours) && hours > 0
    );
    const unknownDates = task.unknownSpan ? dates.filter(date => date >= task.unknownSpan!.start && date <= task.unknownSpan!.end) : [];
    if (!row && assignedHours.length === 0 && unknownDates.length === 0) continue;

    if (!row) {
      const diagnosticId = resourceId || task.assigneeUserId || 'unassigned';
      const rowKey = `diagnostic:${diagnosticId}`;
      row = rowByResourceId.get(rowKey);
      if (!row) {
        row = {
          resourceMemberId: rowKey,
          displayName: `Unresolved assignment (${diagnosticId})`,
          hoursByDate: emptyHours(dates),
          unknownDates: [],
          isDiagnostic: true,
        };
        rowByResourceId.set(rowKey, row);
        rows.push(row);
      }
    }

    row.unknownDates = Array.from(new Set([...row.unknownDates, ...unknownDates]));
    for (const [date, hours] of assignedHours) {
      row.hoursByDate[date] += hours;
    }
  }

  return rows;
}
