'use client';

import React from 'react';
import type { MasterPhaseRow } from '@/types/schedule-projection';
import { formatDateVN } from '@/lib/utils';

export interface PhaseScheduleRowProps {
  group: MasterPhaseRow;
  days: Date[];
  dayWidth: number;
}

/** One continuous Master span; phase metadata renders in the left table only. */
export function PhaseScheduleRow({ group, days, dayWidth }: PhaseScheduleRowProps) {
  const { start, end } = group;
  if (!start || !end) return null;
  const visible = days
    .map((day, index) => ({ date: formatDateVN(day), index }))
    .filter(({ date }) => date >= start && date <= end);
  if (!visible.length) return null;

  const first = visible[0].index;
  const last = visible[visible.length - 1].index;
  return (
    <div
      data-testid="master-phase-span"
      data-phase-id={group.phase_id ?? 'unclassified'}
      data-start={start}
      data-end={end}
      className="absolute rounded-full border border-indigo-300 bg-indigo-200"
      title={`${start} – ${end}`}
      style={{ left: `${first * dayWidth + 4}px`, top: '10px', width: `${(last - first + 1) * dayWidth - 8}px`, height: '28px' }}
    />
  );
}

export default PhaseScheduleRow;
