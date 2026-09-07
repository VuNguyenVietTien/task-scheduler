'use client';

import { useMemo, useEffect, type RefObject, type UIEventHandler } from 'react';
import { findDayOff } from '@/utils/capacity';
import {
  buildMemberDailyEffort,
  type DisplayedTaskEffort,
} from '@/utils/member-daily-effort';
import type { SchedulingConfig, SchedulingResourceMember } from '@/hooks/useProjectSchedulingConfig';
import { formatDateVN } from '@/lib/utils';

interface MemberDailyEffortMatrixProps {
  members: readonly SchedulingResourceMember[];
  dates: readonly Date[];
  taskEfforts: readonly DisplayedTaskEffort[];
  scheduling: SchedulingConfig;
  /** Saved/draft allocations are frozen; capacity/commitments remain current. */
  snapshotFrozen: boolean;
  dayWidth: number;
  scrollRef?: RefObject<HTMLDivElement>;
  onScroll?: UIEventHandler<HTMLDivElement>;
  scrollLeft?: number;
}

const formatHours = (hours: number) => `${Math.round(hours * 10) / 10}h`;

function loadStatus(assigned: number, taskBudget: number, capacity: number, dayOff: boolean): string {
  if (assigned > taskBudget) return 'over';
  if (dayOff) return 'day-off';
  if (capacity === 0) return 'non-working';
  if (assigned === taskBudget && taskBudget > 0) return 'full';
  if (assigned > 8) return 'over-baseline';
  return 'under';
}

function loadClass(status: string): string {
  switch (status) {
    case 'over': return 'bg-red-100 text-red-800';
    case 'full': return 'bg-emerald-100 text-emerald-800';
    case 'over-baseline': return 'bg-blue-100 text-blue-800';
    case 'day-off': return 'bg-amber-100 text-amber-800';
    case 'non-working': return 'bg-slate-100 text-slate-500';
    default: return 'bg-white text-slate-700';
  }
}

/** Daily finite-task effort from the same displayed allocations that draw bars. */
export function MemberDailyEffortMatrix({
  members,
  dates,
  taskEfforts,
  scheduling,
  snapshotFrozen,
  dayWidth,
  scrollRef,
  onScroll,
  scrollLeft = 0,
}: MemberDailyEffortMatrixProps) {
  const dateKeys = useMemo(() => dates.map(formatDateVN), [dates]);
  const rows = useMemo(
    () => buildMemberDailyEffort(
      members
        .filter((member) => member.member_kind === 'MEMBER')
        .map((member) => ({
          resourceMemberId: member.resource_member_id,
          displayName: member.display_name,
          userId: member.user_id,
        })),
      dateKeys,
      taskEfforts
    ),
    [members, dateKeys, taskEfforts]
  );

  useEffect(() => { if (scrollRef?.current) scrollRef.current.scrollLeft = scrollLeft; }, [scrollRef, scrollLeft, scheduling.loading, scheduling.error]);

  if (scheduling.loading || scheduling.error) {
    return (
      <section className="mt-4 border-t border-slate-200 pt-3 text-sm text-slate-500" data-testid="member-daily-effort-matrix">
        {scheduling.error ? 'Member capacity data is unavailable.' : 'Loading member capacity data…'}
      </section>
    );
  }

  return (
    <section className="mt-4 border-t border-slate-200 pt-3" data-testid="member-daily-effort-matrix">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Daily member effort <span className="font-normal text-slate-500">— all tasks in selected plan; filters/collapse do not change totals{snapshotFrozen ? '; capacity/commitments are current and may be newer than this snapshot' : ''}</span></h3>
      <div className="flex min-w-0">
        <div className="w-96 flex-shrink-0 border border-slate-200 bg-white" data-testid="member-name-column">
          <div className="h-10 border-b border-slate-200 bg-slate-50 px-3 flex items-center text-xs font-medium text-slate-500">
            Member
          </div>
          {rows.map((row) => (
            <div
              key={row.resourceMemberId}
              className={`h-12 border-b border-slate-100 px-3 flex items-center text-xs ${row.isDiagnostic ? 'text-amber-700' : 'text-slate-700'}`}
              data-testid="member-effort-row"
            >
              {row.displayName}
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto" data-testid="matrix-scroll" ref={scrollRef} onScroll={onScroll}>
          <div style={{ width: `${dates.length * dayWidth}px`, minWidth: '100%' }}>
            <div className="grid h-10 bg-slate-50 border-y border-r border-slate-200" style={{ gridTemplateColumns: `repeat(${dates.length}, ${dayWidth}px)` }}>
              {dates.map((date) => (
                <div key={formatDateVN(date)} className="border-r border-slate-200 flex items-center justify-center text-[0.65rem] text-slate-500">
                  {formatDateVN(date).slice(5)}
                </div>
              ))}
            </div>
            {rows.map((row) => (
              <div key={row.resourceMemberId} className="grid h-12" style={{ gridTemplateColumns: `repeat(${dates.length}, ${dayWidth}px)` }}>
                {dates.map((date) => {
                  const dateKey = formatDateVN(date);
                  const assigned = row.hoursByDate[dateKey] ?? 0;
                  const unknown = row.unknownDates.includes(dateKey);
                  const assignedLabel = unknown ? 'unknown/incomplete' : formatHours(assigned);
                  const capacity = row.isDiagnostic ? 0 : scheduling.capacityFor(row.resourceMemberId)(date);
                  const dayOffRecord = row.isDiagnostic ? null : findDayOff(
                    dateKey,
                    row.resourceMemberId,
                    scheduling.groupIdsFor(row.resourceMemberId),
                    scheduling.daysOff
                  );
                  const reserved = row.isDiagnostic
                    ? 0
                    : scheduling.reservedFor(row.resourceMemberId, dateKey, dateKey)[dateKey] ?? 0;
                  const taskBudget = Math.max(0, capacity - reserved);
                  const status = unknown ? 'unknown' : loadStatus(assigned, taskBudget, capacity, Boolean(dayOffRecord));
                  const overBaseline = assigned > 8;
                  const totalLoadOver = assigned + reserved > capacity;
                  const reason = dayOffRecord ? `; day off (${dayOffRecord.reason ?? dayOffRecord.scope})` : '';
                  const details = `${row.displayName}, ${dateKey}: A ${assignedLabel} assigned; baseline 8h; C ${formatHours(capacity)} current capacity; R ${formatHours(reserved)} reserved; B ${formatHours(taskBudget)} task budget${overBaseline ? '; over baseline' : ''}${totalLoadOver ? '; total load overload' : ''}${reason}${snapshotFrozen ? '; allocation is saved, capacity and commitments are current' : ''}`;
                  return (
                    <div
                      key={dateKey}
                      className={`border-r border-b border-slate-200 px-1 flex items-center justify-center text-[0.65rem] ${loadClass(status)}`}
                      data-testid="member-effort-cell"
                      data-member-id={row.resourceMemberId}
                      data-date={dateKey}
                      data-load-status={status}
                      data-over-baseline={overBaseline || undefined}
                      data-total-load-over={totalLoadOver || undefined}
                      title={details}
                      aria-label={details}
                    >
                      A {assignedLabel} · C {formatHours(capacity)} · R {formatHours(reserved)} · B {formatHours(taskBudget)}{overBaseline ? ' · >8h' : ''}{totalLoadOver ? ' · overload' : ''}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
