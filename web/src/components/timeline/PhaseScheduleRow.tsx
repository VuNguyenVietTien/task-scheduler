'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PhaseRollupSummary } from '@/types/schedule-projection';

export interface PhaseScheduleRowProps {
  group: PhaseRollupSummary;
  className?: string;
}

function formatEffort(hours?: number): string {
  if (hours === undefined) return '—';
  return `${Math.round(hours * 10) / 10}h`;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return iso.slice(0, 10);
}

/**
 * Presentation-only Master Schedule summary row for one phase (or Unphased).
 * Derived, non-editable summary — never a task bar: no drag, resize, or task
 * callbacks; no dependency semantics. Pure display of derived rollups.
 */
export function PhaseScheduleRow({ group, className = '' }: PhaseScheduleRowProps) {
  const { t } = useTranslation();
  const progress =
    group.progress_percent !== undefined
      ? `${Math.round(group.progress_percent)}%`
      : '—';

  return (
    <div
      data-row-id={group.phase_id ? `phase:${group.phase_id}` : 'phase:unphased'}
      data-phase-summary="true"
      data-nondraggable="true"
      role="row"
      aria-label={`${t('scheduling.phase')}: ${group.name}`}
      className={`flex items-center h-10 gap-3 border-b border-gray-100 bg-gray-50 px-3 text-sm select-none ${className}`}
    >
      <span className="font-semibold text-gray-800 flex-1 truncate">
        {group.is_unphased ? t('scheduling.unphased') : group.name}
      </span>
      <span className="w-14 text-right text-gray-500" title="Task count">
        {group.task_count}
      </span>
      <span className="w-16 text-right text-gray-500" title="Total effort">
        {formatEffort(group.total_effort_hours)}
      </span>
      {group.allocated_hours !== undefined && (
        <span className="w-20 text-right text-gray-500" title="Allocated effort">
          {formatEffort(group.allocated_hours)}
        </span>
      )}
      {group.remaining_hours !== undefined && (
        <span className="w-20 text-right text-gray-500" title="Remaining effort">
          {formatEffort(group.remaining_hours)}
        </span>
      )}
      <span className="w-24 text-right text-gray-500" title="Start">
        {formatDate(group.start)}
      </span>
      <span className="w-24 text-right text-gray-500" title="End">
        {formatDate(group.end)}
      </span>
      <span className="w-14 text-right text-gray-500" title="Progress">
        {progress}
      </span>
    </div>
  );
}

export default PhaseScheduleRow;
