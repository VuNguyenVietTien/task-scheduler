'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ScheduleDisplayMode } from '@/types/taxonomy';

export interface ScheduleModeControlProps {
  /** Currently active schedule display mode. */
  mode: ScheduleDisplayMode;
  /** Called with the newly selected mode; performs no writes itself. */
  onModeChange: (mode: ScheduleDisplayMode) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Presentation-only toggle between WBS Detail and Master Schedule modes.
 * Switching modes changes presentation only — no task, phase, plan,
 * dependency, assignment, or schedule writes happen here.
 */
export function ScheduleModeControl({
  mode,
  onModeChange,
  disabled = false,
  className = '',
}: ScheduleModeControlProps) {
  const { t } = useTranslation();
  const modes: ScheduleDisplayMode[] = ['WBS_DETAIL', 'MASTER_SCHEDULE'];

  return (
    <div
      role="group"
      aria-label={t('scheduling.modeLabel')}
      className={`inline-flex items-center rounded-md border border-gray-200 bg-white p-0.5 ${className}`}
      data-testid="schedule-mode-control"
    >
      {modes.map((m) => {
        const active = m === mode;
        return (
          <button
            key={m}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            data-testid={`schedule-mode-${m.toLowerCase()}`}
            title={m === 'WBS_DETAIL' ? t('scheduling.modeWbsTitle') : t('scheduling.modeMasterTitle')}
            onClick={() => onModeChange(m)}
            className={`px-3 py-1 text-sm font-medium rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              active ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {m === 'WBS_DETAIL' ? t('scheduling.modeWbs') : t('scheduling.modeMaster')}
          </button>
        );
      })}
    </div>
  );
}

export default ScheduleModeControl;
