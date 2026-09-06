'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ProjectPhase } from '@/types/taxonomy';
import type { Task } from '@/types/task';

/**
 * Increment 1 — task phase selector and phase filter controls.
 * Focused, presentation-driven: mutations happen through callbacks so tests
 * and callers stay in control (selector never mutates on its own beyond the
 * provided onSetPhase contract).
 */

/** Filter value: ALL phases | a specific phase id | UNPHASED. */
export type PhaseFilterValue = 'ALL' | 'UNPHASED' | string;

/**
 * Pure phase filter: ALL keeps everything; UNPHASED keeps tasks without a
 * phase; otherwise only tasks assigned to the given phase id. Child tasks are
 * filtered by their own phase_id (callers that render children under parents
 * may pre-filter parents only).
 */
export function applyPhaseFilter(tasks: readonly Task[], value: PhaseFilterValue): Task[] {
  if (value === 'ALL') return [...tasks];
  if (value === 'UNPHASED') return tasks.filter((t) => !t.phase_id);
  return tasks.filter((t) => t.phase_id === value);
}

export interface TaskPhaseSelectProps {
  taskId: string;
  /** Current phase_id of the task; null/undefined = Unphased. */
  value?: string | null;
  /** Active phases (ordered). */
  phases: ProjectPhase[];
  /** Performs set_task_taxonomy(task_id, phase_id | null). NULL = Unphased. */
  onSetPhase: (taskId: string, phaseId: string | null) => Promise<void> | void;
  disabled?: boolean;
  className?: string;
}

/**
 * Per-task phase selector. Selecting the empty option explicitly assigns
 * Unphased (phase_id NULL) per the backend contract.
 */
export function TaskPhaseSelect({
  taskId,
  value,
  phases,
  onSetPhase,
  disabled = false,
  className = '',
}: TaskPhaseSelectProps) {
  const { t } = useTranslation();
  const options = useMemoWithCurrent(phases, value, t);

  return (
    <select
      data-testid="task-phase-select"
      aria-label={t('scheduling.taskPhase')}
      className={`px-1.5 py-0.5 border rounded text-xs bg-white text-slate-700 ${className}`}
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => {
        const next = e.target.value || null;
        void onSetPhase(taskId, next);
      }}
    >
      {options.map((p) => (
        <option key={p.phase_id ?? '__unphased__'} value={p.phase_id ?? ''}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

/** Options: active phases + current value (if archived/unknown) + Unphased. */
function useMemoWithCurrent(
  phases: ProjectPhase[],
  value: string | null | undefined,
  t: (k: string) => string
): Array<{ phase_id: string | null; name: string }> {
  return React.useMemo(() => {
    const options: Array<{ phase_id: string | null; name: string }> = phases.map((p) => ({
      phase_id: p.phase_id,
      name: p.name,
    }));
    if (value && !phases.some((p) => p.phase_id === value)) {
      options.push({ phase_id: value, name: t('scheduling.archivedPhase') });
    }
    options.push({ phase_id: null, name: t('scheduling.filterUnphased') });
    return options;
  }, [phases, value, t]);
}

export interface PhaseFilterSelectProps {
  phases: ProjectPhase[];
  value: PhaseFilterValue;
  onChange: (value: PhaseFilterValue) => void;
  className?: string;
}

/** List-level phase filter: All / each phase / Unphased. Pure callback. */
export function PhaseFilterSelect({ phases, value, onChange, className = '' }: PhaseFilterSelectProps) {
  const { t } = useTranslation();

  return (
    <select
      data-testid="phase-filter-select"
      aria-label={t('scheduling.filterLabel')}
      className={`px-2 py-1 border rounded text-sm bg-white text-slate-700 ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value as PhaseFilterValue)}
    >
      <option value="ALL">{t('scheduling.filterAllPhases')}</option>
      {phases.map((p) => (
        <option key={p.phase_id} value={p.phase_id}>
          {p.name}
        </option>
      ))}
      <option value="UNPHASED">{t('scheduling.filterUnphased')}</option>
    </select>
  );
}
