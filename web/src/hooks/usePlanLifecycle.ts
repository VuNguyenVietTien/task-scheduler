/**
 * usePlanLifecycle — saved-plan lifecycle state machine (herdr-260906).
 *
 * Modes:
 * - 'live': Timeline computes bars from current tasks/config (default).
 * - 'draft': a client-side draft (New Plan or Recalculate) is displayed but
 *   NOT persisted — nothing overwrites a saved plan until Save Plan.
 * - 'saved': bars come from the loaded plan's snapshot ONLY (viewport and
 *   current-config independent) until an explicit Recalculate.
 *
 * Staleness: the backend computes it from the stored config fingerprint;
 * `loadedPlan.stale` + `staleReasons` drive the Recalculate UX. Saving a
 * recalculated draft defaults to NEW_REVISION (append; old snapshot kept) —
 * SAME_REVISION requires an explicit user choice.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useApolloClient, useMutation, useQuery } from '@apollo/client';
import {
  PLAN_RECALC_METADATA_QUERY,
  SAVE_PLAN_SNAPSHOT_MUTATION,
  SAVED_PLANS_QUERY,
  SAVED_PLAN_QUERY,
} from '@/graphql/scheduling';
import {
  draftFromCurrentTasks,
  draftFromSavedPlanTasks,
  parsePlanSnapshot,
  snapshotToBars,
  type PlanBar,
  type PlanDraft,
  type PlanSnapshot,
  type PlanSchedulingInputs,
} from '@/utils/planLifecycle';
import type { TaskAllocation } from '@/utils/taskAllocations';

export interface SavedPlanPayload {
  plan_id: string;
  project_id: string;
  name: string;
  revision: number;
  is_active: boolean;
  stale: boolean;
  stale_reasons: string[];
  config_fingerprint?: string | null;
  parent_plan_id?: string | null;
  plan_data: unknown;
  created_at?: string;
  updated_at?: string;
}

export type PlanLifecycleMode = 'live' | 'draft' | 'saved';

export interface UsePlanLifecycleResult {
  mode: PlanLifecycleMode;
  /** Draft (unpersisted) produced by New Plan / Recalculate. */
  draft: PlanDraft | null;
  /** Where the current draft came from. */
  draftSource: 'new-plan' | 'recalculate' | null;
  /** Plan a recalculated draft is based on (for revision saves). */
  basePlanId: string | null;
  loadedPlan: SavedPlanPayload | null;
  savedBars: Record<string, PlanBar>;
  /** Bars the Timeline should render instead of computing (null = live). */
  overrideBars: Record<string, { start: string; end: string; hoursPerDay: Record<string, number> }> | null;
  /** Snapshot bytes of the loaded plan (stable across config changes). */
  loadedSnapshot: PlanSnapshot | null;
  plans: SavedPlanPayload[];
  plansLoading: boolean;
  saving: boolean;
  error: string | null;
  /** Task ids that could NOT be scheduled in the active draft (⚠ warning). */
  exhaustedTaskIds: string[];
  newPlan: () => void;
  recalculate: () => Promise<void>;
  loadPlan: (planId: string) => Promise<void>;
  savePlan: (name: string, revisionMode: 'NEW_REVISION' | 'SAME_REVISION') => Promise<SavedPlanPayload | null>;
  backToLive: () => void;
}

export function usePlanLifecycle(
  projectId: string | undefined,
  scheduling: PlanSchedulingInputs
): UsePlanLifecycleResult {
  const client = useApolloClient();
  const [mode, setMode] = useState<PlanLifecycleMode>('live');
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [draftSource, setDraftSource] = useState<'new-plan' | 'recalculate' | null>(null);
  const [basePlanId, setBasePlanId] = useState<string | null>(null);
  const [loadedPlan, setLoadedPlan] = useState<SavedPlanPayload | null>(null);
  const [savedBars, setSavedBars] = useState<Record<string, PlanBar>>({});
  const [loadedSnapshot, setLoadedSnapshot] = useState<PlanSnapshot | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plansQ = useQuery(SAVED_PLANS_QUERY, {
    variables: { project_id: projectId },
    skip: !projectId,
    fetchPolicy: 'cache-and-network',
  });
  const [saveMutation] = useMutation(SAVE_PLAN_SNAPSHOT_MUTATION);

  // Keep the latest scheduling inputs for callbacks without re-creating them.
  const schedRef = useRef(scheduling);
  schedRef.current = scheduling;

  const newPlan = useCallback(() => {
    setError(null);
    const d = draftFromCurrentTasks(schedRef.current);
    setDraft(d);
    setDraftSource('new-plan');
    setBasePlanId(null);
    setMode('draft');
  }, []);

  const recalculate = useCallback(async () => {
    if (!loadedSnapshot || !loadedPlan) {
      setError('Recalculate needs a loaded saved plan');
      return;
    }
    setError(null);
    try {
      const meta = await client.query({
        query: PLAN_RECALC_METADATA_QUERY,
        variables: { plan_id: loadedPlan.plan_id },
      });
      const metaTaskIds: string[] = meta.data?.plan_recalc_metadata?.task_ids ?? [];
      // Saved priority order (snapshot order) wins; metadata ids are the
      // authoritative filter (drops deleted tasks server-side).
      const idSet = new Set(metaTaskIds);
      const savedTasks = loadedSnapshot.tasks.filter((t) => idSet.has(t.taskId));
      const d = draftFromSavedPlanTasks(savedTasks, schedRef.current);
      setDraft(d);
      setDraftSource('recalculate');
      setBasePlanId(loadedPlan.plan_id);
      setMode('draft');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [client, loadedPlan, loadedSnapshot]);

  const loadPlan = useCallback(
    async (planId: string) => {
      setError(null);
      try {
        const res = await client.query({
          query: SAVED_PLAN_QUERY,
          variables: { plan_id: planId },
        });
        const plan: SavedPlanPayload | null = res.data?.saved_plan ?? null;
        if (!plan) throw new Error('plan not found');
        const snap = parsePlanSnapshot(plan.plan_data);
        setLoadedPlan(plan);
        setLoadedSnapshot(snap);
        setSavedBars(snapshotToBars(snap));
        setDraft(null);
        setDraftSource(null);
        setBasePlanId(plan.plan_id);
        setMode('saved');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [client]
  );

  const savePlan = useCallback(
    async (name: string, revisionMode: 'NEW_REVISION' | 'SAME_REVISION') => {
      if (!projectId) {
        setError('no project');
        return null;
      }
      if (!draft) {
        setError('nothing to save — create a draft first (New Plan or Recalculate)');
        return null;
      }
      if (!name.trim()) {
        setError('plan name is required');
        return null;
      }
      setSaving(true);
      setError(null);
      try {
        const res = await saveMutation({
          variables: {
            input: {
              project_id: projectId,
              name: name.trim(),
              revision_mode: revisionMode,
              plan_id: draftSource === 'recalculate' ? basePlanId : null,
              snapshot: draft.snapshot,
            },
          },
        });
        const saved: SavedPlanPayload | null = res.data?.save_plan_snapshot ?? null;
        if (!saved) throw new Error('save returned no plan');
        const snap = parsePlanSnapshot(saved.plan_data);
        setLoadedPlan(saved);
        setLoadedSnapshot(snap);
        setSavedBars(snapshotToBars(snap));
        setDraft(null);
        setDraftSource(null);
        setBasePlanId(saved.plan_id);
        setMode('saved');
        void plansQ.refetch();
        return saved;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setSaving(false);
      }
    },
    [basePlanId, draft, draftSource, projectId, saveMutation, plansQ]
  );

  const backToLive = useCallback(() => {
    setMode('live');
    setDraft(null);
    setDraftSource(null);
  }, []);

  const overrideBars = useMemo(() => {
    if (mode === 'saved' && loadedSnapshot) {
      return Object.fromEntries(
        Object.entries(snapshotToBars(loadedSnapshot)).map(([id, b]) => [
          id,
          { start: b.start, end: b.end, hoursPerDay: b.hoursPerDay },
        ])
      );
    }
    if (mode === 'draft' && draft) {
      return Object.fromEntries(
        Object.entries(draft.allocations as Record<string, TaskAllocation>).map(([id, a]) => [
          id,
          {
            start: a.start.toISOString().slice(0, 10),
            end: a.end.toISOString().slice(0, 10),
            hoursPerDay: a.hoursPerDay,
          },
        ])
      );
    }
    return null;
  }, [mode, loadedSnapshot, draft]);

  const exhaustedTaskIds = mode === 'draft' && draft ? draft.exhaustedTaskIds : [];

  const plans: SavedPlanPayload[] = plansQ.data?.saved_plans ?? [];

  return {
    mode,
    draft,
    draftSource,
    basePlanId,
    loadedPlan,
    savedBars,
    overrideBars,
    loadedSnapshot,
    plans,
    plansLoading: plansQ.loading,
    saving,
    error,
    exhaustedTaskIds,
    newPlan,
    recalculate,
    loadPlan,
    savePlan,
    backToLive,
  };
}
