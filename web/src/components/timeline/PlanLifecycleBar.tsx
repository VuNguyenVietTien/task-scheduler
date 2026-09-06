/**
 * PlanLifecycleBar — explicit saved-plan lifecycle toolbar (herdr-260906).
 *
 * UX contract:
 * - New Plan: builds a DRAFT from current tasks + config. Existing saved
 *   plans are untouched until an explicit Save.
 * - Save Plan (draft mode): persists the snapshot. New-plan drafts create a
 *   new plan; recalculated drafts choose NEW REVISION (append, default) or
 *   SAME REVISION (explicit overwrite of the loaded row only).
 * - Plan select: loads a saved plan → Timeline renders SNAPSHOT bars
 *   (viewport/config independent).
 * - STALE badge + reasons appear when backend config fingerprint drifted;
 *   Recalculate builds a new draft from the saved plan's tasks with CURRENT
 *   config. Nothing changes until the user saves.
 * - ⚠ warnings: zero-capacity/unschedulable tasks (draft) and unscheduled
 *   tasks captured in a saved snapshot; truncated recurring-commitment
 *   expansions.
 */
'use client';

import { useMemo, useState } from 'react';
import { usePlanLifecycle } from '@/hooks/usePlanLifecycle';
import type { PlanSchedulingInputs } from '@/utils/planLifecycle';

export interface PlanLifecycleBarProps {
  projectId: string | undefined;
  scheduling: PlanSchedulingInputs;
  /** Recurring-commitment rule ids whose expansion was truncated. */
  truncatedCommitmentRules: Set<string>;
}

export function PlanLifecycleBar({
  projectId,
  scheduling,
  truncatedCommitmentRules,
}: PlanLifecycleBarProps) {
  const lc = usePlanLifecycle(projectId, scheduling);
  const [name, setName] = useState('');
  const [revisionChoice, setRevisionChoice] = useState<'NEW_REVISION' | 'SAME_REVISION'>(
    'NEW_REVISION'
  );
  const [showRevisionChoice, setShowRevisionChoice] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const unscheduledSaved = useMemo(
    () => Object.values(lc.savedBars).filter((b) => b.unscheduled).length,
    [lc.savedBars]
  );

  const handleSave = () => {
    if (lc.draftSource === 'recalculate') {
      setShowRevisionChoice(true);
      return;
    }
    void lc.savePlan(name || `Plan ${new Date().toISOString().slice(0, 10)}`, 'NEW_REVISION');
  };

  const modeBadge =
    lc.mode === 'live' ? 'Live (current config)' : lc.mode === 'draft' ? `Draft — ${lc.draftSource === 'recalculate' ? 'recalculated' : 'new'} (unsaved)` : `Saved r${lc.loadedPlan?.revision ?? '?'}`;

  return (
    <div
      data-testid="plan-lifecycle-bar"
      className="flex flex-wrap items-center gap-2 px-3 py-2 rounded bg-slate-50 border border-slate-200 text-sm"
    >
      <span data-testid="plan-mode" className="font-medium text-slate-700">
        {modeBadge}
      </span>

      <button
        type="button"
        data-testid="new-plan-btn"
        onClick={lc.newPlan}
        className="px-2 py-1 rounded bg-blue-100 hover:bg-blue-200"
        title="Build a draft from current tasks + current config (nothing is saved yet)"
      >
        New Plan
      </button>

      {lc.mode === 'draft' && (
        <>
          <input
            data-testid="plan-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Plan name"
            className="px-2 py-1 border rounded"
          />
          <button
            type="button"
            data-testid="save-plan-btn"
            onClick={handleSave}
            disabled={lc.saving}
            className="px-2 py-1 rounded bg-green-100 hover:bg-green-200 disabled:opacity-50"
          >
            {lc.saving ? 'Saving…' : 'Save Plan'}
          </button>
        </>
      )}

      {showRevisionChoice && lc.draftSource === 'recalculate' && (
        <span className="flex items-center gap-1" data-testid="revision-choice">
          <button
            type="button"
            data-testid="save-new-revision-btn"
            onClick={async () => {
              await lc.savePlan(name || (lc.loadedPlan?.name ?? 'Plan'), 'NEW_REVISION');
              setShowRevisionChoice(false);
            }}
            className="px-2 py-1 rounded bg-green-100 hover:bg-green-200"
            title="Append revision N+1 — the previous snapshot is kept"
          >
            Save as New Revision
          </button>
          <button
            type="button"
            data-testid="save-same-revision-btn"
            onClick={async () => {
              await lc.savePlan(name || (lc.loadedPlan?.name ?? 'Plan'), 'SAME_REVISION');
              setShowRevisionChoice(false);
            }}
            className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200"
            title="Overwrite THIS plan row's snapshot only (explicit choice)"
          >
            Overwrite Same Revision
          </button>
          <button
            type="button"
            data-testid="cancel-revision-btn"
            onClick={() => setShowRevisionChoice(false)}
            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200"
          >
            Cancel
          </button>
        </span>
      )}

      <select
        data-testid="plan-select"
        value={lc.loadedPlan?.plan_id ?? ''}
        onChange={(e) => {
          if (!e.target.value) {
            lc.backToLive();
            return;
          }
          setLoadError(null);
          void lc.loadPlan(e.target.value);
        }}
        className="px-2 py-1 border rounded"
        aria-label="Load saved plan"
      >
        <option value="">— Live view —</option>
        {lc.plans.map((p) => (
          <option key={p.plan_id} value={p.plan_id}>
            {p.name} (r{p.revision}){p.stale ? ' ⚠ stale' : ''}
          </option>
        ))}
      </select>

      {lc.mode === 'saved' && lc.loadedPlan?.stale && (
        <span className="flex items-center gap-1">
          <span
            data-testid="stale-badge"
            className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium"
          >
            Stale — config changed since save
          </span>
          <button
            type="button"
            data-testid="recalculate-btn"
            onClick={() => void lc.recalculate()}
            className="px-2 py-1 rounded bg-blue-100 hover:bg-blue-200"
            title="Rebuild a draft from THIS plan's tasks with CURRENT capacity/leave/groups/meetings"
          >
            Recalculate
          </button>
        </span>
      )}
      {lc.mode === 'saved' && !lc.loadedPlan?.stale && lc.loadedPlan && (
        <button
          type="button"
          data-testid="recalculate-btn"
          onClick={() => void lc.recalculate()}
          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200"
          title="Rebuild a draft from this plan's tasks with current config"
        >
          Recalculate
        </button>
      )}
      {lc.mode === 'saved' && lc.loadedPlan?.stale_reasons?.length ? (
        <ul data-testid="stale-reasons" className="text-xs text-amber-700 list-disc ml-4">
          {lc.loadedPlan.stale_reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}

      {lc.mode === 'draft' && lc.exhaustedTaskIds.length > 0 && (
        <span
          data-testid="exhausted-warning"
          className="px-2 py-0.5 rounded bg-red-100 text-red-800"
          title={`Tasks: ${lc.exhaustedTaskIds.join(', ')}`}
        >
          ⚠ {lc.exhaustedTaskIds.length} task(s) unschedulable with current capacity
        </span>
      )}
      {lc.mode === 'saved' && unscheduledSaved > 0 && (
        <span data-testid="unscheduled-warning" className="px-2 py-0.5 rounded bg-red-100 text-red-800">
          ⚠ {unscheduledSaved} task(s) had zero capacity when this plan was saved
        </span>
      )}
      {truncatedCommitmentRules.size > 0 && (
        <span
          data-testid="commitment-truncation-warning"
          className="px-2 py-0.5 rounded bg-amber-100 text-amber-800"
          title={`Rules: ${Array.from(truncatedCommitmentRules).join(', ')}`}
        >
          ⚠ recurring schedule truncated ({truncatedCommitmentRules.size} rule(s)) — bars may be incomplete
        </span>
      )}

      {(lc.error || loadError) && (
        <span data-testid="plan-error" className="text-red-600 text-xs">
          {lc.error ?? loadError}
        </span>
      )}
    </div>
  );
}
