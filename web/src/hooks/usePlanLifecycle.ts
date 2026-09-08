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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  reorderPlanSnapshot,
  snapshotToBars,
  type PlanBar,
  type PlanDraft,
  type PlanSnapshot,
  type PlanSchedulingInputs,
} from '@/utils/planLifecycle';
import { fmt, type TaskAllocation } from '@/utils/taskAllocations';
import { DELETE_PLAN, SET_PLAN_ACTIVE } from '@/graphql/mutations/plans';

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
  /** Newest saved plan was corrupt, so current scheduling remains visible. */
  defaultPlanFallback: boolean;
  /** Task ids that could NOT be scheduled in the active draft (⚠ warning). */
  exhaustedTaskIds: string[];
  newPlan: () => void;
  recalculate: () => Promise<void>;
  loadPlan: (planId: string) => Promise<void>;
  savePlan: (name: string, revisionMode: 'NEW_REVISION' | 'SAME_REVISION') => Promise<SavedPlanPayload | null>;
  /** Reorders the current draft only; saved snapshots are never mutated. */
  reorderDraft: (taskIds: readonly string[]) => void;
  backToLive: () => void;
  deletePlan: () => Promise<void>;
  setActivePlan: () => Promise<void>;
  calculationsUnavailable?: string;
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
  const [defaultPlanFallback, setDefaultPlanFallback] = useState(false);
  const requestIdRef = useRef(0);
  const selectionInitializedRef = useRef(false);
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  useEffect(() => {
    requestIdRef.current += 1;
    selectionInitializedRef.current = false;
    setMode('live');
    setDraft(null);
    setDraftSource(null);
    setBasePlanId(null);
    setLoadedPlan(null);
    setSavedBars({});
    setLoadedSnapshot(null);
    setError(null);
    setDefaultPlanFallback(false);
    setSaving(false);
    return () => { requestIdRef.current += 1; };
  }, [projectId]);

  const plansQ = useQuery(SAVED_PLANS_QUERY, {
    variables: { project_id: projectId },
    skip: !projectId,
    fetchPolicy: 'cache-and-network',
  });
  const [saveMutation] = useMutation(SAVE_PLAN_SNAPSHOT_MUTATION);

  // Keep the latest scheduling inputs for callbacks without re-creating them.
  const schedRef = useRef(scheduling);
  schedRef.current = scheduling;

  // Every user intent invalidates every older completion (including failures/finally).
  const beginIntent = useCallback(() => {
    const requestId = ++requestIdRef.current;
    const requestedProject = projectIdRef.current;
    selectionInitializedRef.current = true;
    setError(null);
    setDefaultPlanFallback(false);
    setSaving(false);
    return () => requestId === requestIdRef.current && requestedProject === projectIdRef.current;
  }, []);

  const installPlan = useCallback((plan: SavedPlanPayload) => {
    const snap = parsePlanSnapshot(plan.plan_data);
    setLoadedPlan(plan);
    setLoadedSnapshot(snap);
    setSavedBars(snapshotToBars(snap));
    setDraft(null);
    setDraftSource(null);
    setBasePlanId(plan.plan_id);
    setMode('saved');
  }, []);

  const newPlan = useCallback(() => {
    beginIntent();
    try {
      const d = draftFromCurrentTasks(schedRef.current);
      setDraft(d);
      setDraftSource('new-plan');
      setBasePlanId(null);
      setMode('draft');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [beginIntent]);

  const recalculate = useCallback(async () => {
    const isCurrent = beginIntent();
    if (schedRef.current.unavailableReason) { setError(schedRef.current.unavailableReason); return; }
    if (mode !== 'saved') {
      const d = mode === 'draft' && draft
        ? draftFromSavedPlanTasks(draft.snapshot.tasks, schedRef.current)
        : draftFromCurrentTasks({ ...schedRef.current, selectedTaskIds: undefined });
      setDraft(d);
      if (mode === 'live') { setDraftSource('new-plan'); setBasePlanId(null); }
      setMode('draft');
      return;
    }
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
      if (!isCurrent()) return;
      if (schedRef.current.unavailableReason) throw new Error(schedRef.current.unavailableReason);
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
      if (isCurrent()) setError(e instanceof Error ? e.message : String(e));
    }
  }, [beginIntent, client, loadedPlan, loadedSnapshot, mode, draft]);

  const loadPlan = useCallback(
    async (planId: string) => {
      const isCurrent = beginIntent();
      try {
        const res = await client.query({
          query: SAVED_PLAN_QUERY,
          variables: { plan_id: planId },
        });
        if (!isCurrent()) return;
        const plan: SavedPlanPayload | null = res.data?.saved_plan ?? null;
        if (!plan || plan.project_id !== projectId) throw new Error('plan not found in this project');
        installPlan(plan);
      } catch (e) {
        if (isCurrent()) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    },
    [beginIntent, client, installPlan, projectId]
  );

  useEffect(() => {
    if (!projectId || plansQ.loading || !plansQ.data || selectionInitializedRef.current) return;
    const newest: SavedPlanPayload | undefined = plansQ.data.saved_plans?.[0];
    if (newest && newest.project_id !== projectId) return;
    selectionInitializedRef.current = true;
    if (!newest) return;
    try {
      installPlan(newest);
    } catch (e) {
      setDefaultPlanFallback(true);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [installPlan, plansQ.data, plansQ.loading, projectId]);

  const savePlan = useCallback(
    async (name: string, revisionMode: 'NEW_REVISION' | 'SAME_REVISION') => {
      const isCurrent = beginIntent();
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
        if (!isCurrent()) return null;
        const saved: SavedPlanPayload | null = res.data?.save_plan_snapshot ?? null;
        if (!saved || saved.project_id !== projectId) throw new Error('save returned no plan in this project');
        installPlan(saved);
        void plansQ.refetch().catch((e: Error) => { if (isCurrent()) setError(e.message); });
        return saved;
      } catch (e) {
        if (isCurrent()) setError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        if (isCurrent()) setSaving(false);
      }
    },
    [beginIntent, basePlanId, draft, draftSource, installPlan, projectId, saveMutation, plansQ]
  );

  const reorderDraft = useCallback((taskIds: readonly string[]) => {
    beginIntent();
    setDraft((current) => current
      ? { ...current, snapshot: reorderPlanSnapshot(current.snapshot, taskIds.filter(id => current.snapshot.tasks.some(task => task.taskId === id))) }
      : current);
  }, [beginIntent]);

  const backToLive = useCallback(() => {
    beginIntent();
    setMode('live');
    setDraft(null);
    setDraftSource(null);
    setBasePlanId(null);
    setLoadedPlan(null);
    setLoadedSnapshot(null);
    setSavedBars({});
  }, [beginIntent]);

  const mutateDisplayedPlan = useCallback(async (remove: boolean) => {
    const isCurrent = beginIntent();
    if (mode !== 'saved' || !loadedPlan) { setError('Select a saved plan first'); return; }
    try {
      const res = await client.mutate({ mutation: remove ? DELETE_PLAN : SET_PLAN_ACTIVE, variables: { id: loadedPlan.plan_id } });
      if (!isCurrent()) return;
      if (!(remove ? res.data?.deletePlan : res.data?.setPlanActive)) throw new Error('Plan mutation failed');
      if (!remove) {
        setLoadedPlan({ ...loadedPlan, is_active: true });
        await plansQ.refetch();
        return;
      }
      setMode('live'); setLoadedPlan(null); setLoadedSnapshot(null); setSavedBars({}); setBasePlanId(null);
      const refreshed = await plansQ.refetch();
      if (!isCurrent()) return;
      const newest = (refreshed.data?.saved_plans as SavedPlanPayload[] | undefined)?.find(plan => plan.plan_id !== loadedPlan.plan_id);
      if (newest) {
        try {
          installPlan(newest);
        } catch (e) {
          setDefaultPlanFallback(true);
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    } catch (e) { if (isCurrent()) setError(e instanceof Error ? e.message : String(e)); }
  }, [beginIntent, client, installPlan, loadedPlan, mode, plansQ]);

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
            start: fmt(a.start),
            end: fmt(a.end),
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
    defaultPlanFallback,
    exhaustedTaskIds,
    newPlan,
    recalculate,
    loadPlan,
    savePlan,
    reorderDraft,
    backToLive,
    deletePlan: () => mutateDisplayedPlan(true),
    setActivePlan: () => mutateDisplayedPlan(false),
    calculationsUnavailable: scheduling.unavailableReason,
  };
}
