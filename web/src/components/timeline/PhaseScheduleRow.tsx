'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { MasterPhaseRow } from '@/types/schedule-projection';

export interface PhaseScheduleRowProps {
  group: MasterPhaseRow;
  className?: string;
}

function formatHours(hours?: number): string {
  return hours === undefined ? '—' : `${Math.round(hours * 10) / 10}h`;
}

/** Read-only, phase-only Master Schedule row. */
export function PhaseScheduleRow({ group, className = '' }: PhaseScheduleRowProps) {
  const { t } = useTranslation();

  return (
    <div
      data-row-id={group.phase_id ? `phase:${group.phase_id}` : 'phase:unclassified'}
      data-phase-summary="true"
      data-nondraggable="true"
      role="row"
      aria-label={`${t('scheduling.phase')}: ${group.name}`}
      className={`flex items-center h-10 gap-3 border-b border-gray-100 bg-gray-50 px-3 text-sm select-none ${className}`}
    >
      <span className="font-semibold text-gray-800 flex-1 truncate">{group.name}</span>
      <span className="w-14 text-right text-gray-500" title="Allocated task count">{group.task_count}</span>
      <span className="w-16 text-right text-gray-500" title="Known allocated hours">{formatHours(group.total_hours)}</span>
      <span className="w-24 text-right text-gray-500" title="Start">{group.start ?? '—'}</span>
      <span className="w-24 text-right text-gray-500" title="End">{group.end ?? '—'}</span>
      {group.history_incomplete && (
        <span data-testid="master-history-incomplete" role="status" className="text-xs text-amber-700" title="Saved history is incomplete">⚠</span>
      )}
    </div>
  );
}

export default PhaseScheduleRow;
