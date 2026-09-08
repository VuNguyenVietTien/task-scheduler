import { act, renderHook, waitFor } from '@testing-library/react';
import { usePlanLifecycle } from '../usePlanLifecycle';
import { SAVED_PLAN_QUERY, PLAN_RECALC_METADATA_QUERY } from '@/graphql/scheduling';
import { DELETE_PLAN, SET_PLAN_ACTIVE } from '@/graphql/mutations/plans';

const mockQuery = jest.fn();
const mockMutate = jest.fn();
const mockSave = jest.fn();
const mockRefetch = jest.fn().mockResolvedValue({ data: {} });
const mockClient = { query: mockQuery, mutate: mockMutate };
let mockPlans: ReturnType<typeof plan>[] = [];
jest.mock('@apollo/client', () => ({
  ...jest.requireActual('@apollo/client'),
  useApolloClient: () => mockClient,
  useMutation: () => [mockSave],
  useQuery: () => ({ data: { saved_plans: mockPlans }, loading: false, refetch: mockRefetch }),
}));
const scheduling = {
  tasks: [{ task_id: 'a', title: 'Task A', priority_order: 1, effort: 8 }],
  config: { capacityFor: () => () => 8, reservedFor: () => ({}), memberKeyFor: () => 'rm' },
  today: new Date(2026, 8, 7), horizon: { from: '2026-09-07', to: '2026-10-07' },
};
function plan(id: string, project = 'p') {
  return { plan_id: id, project_id: project, name: id, revision: 1, is_active: false, stale: false, stale_reasons: [],
    plan_data: { version: 2, tasks: [{ taskId: 'a', startDate: '2026-09-07', endDate: '2026-09-07', hoursPerDay: { '2026-09-07': 8 }, priorityOrder: 1 }], meta: { savedAt: '' } } };
}
function corruptPlan(id: string) {
  return { ...plan(id), plan_data: { version: 2, tasks: [{ taskId: 'a', startDate: '2026-09-07', endDate: '2026-09-07', priorityOrder: 1, hoursPerDay: 'bad' }], meta: {} } };
}
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const setup = () => renderHook(({ project, inputs }) => usePlanLifecycle(project, inputs), { initialProps: { project: 'p', inputs: scheduling } });
beforeEach(() => {
  jest.clearAllMocks();
  mockPlans = [];
  mockRefetch.mockImplementation(() => Promise.resolve({ data: { saved_plans: mockPlans } }));
  mockQuery.mockImplementation(({ query, variables }) => Promise.resolve(query === SAVED_PLAN_QUERY ? { data: { saved_plan: plan(variables.plan_id) } } : { data: { plan_recalc_metadata: { task_ids: ['a'] } } }));
});

test('R3 slow load cannot replace a newer New Plan intent', async () => {
  const slow = deferred<any>(); mockQuery.mockReturnValueOnce(slow.promise);
  const { result } = setup(); let pending!: Promise<void>;
  act(() => { pending = result.current.loadPlan('A'); result.current.newPlan(); });
  await act(async () => { slow.resolve({ data: { saved_plan: plan('A') } }); await pending; });
  expect(result.current.mode).toBe('draft'); expect(result.current.draftSource).toBe('new-plan');
});
test.each(['new', 'live', 'project', 'reorder'])('R3 save completion/error/finally cannot replace newer %s intent', async intent => {
  const slow = deferred<any>(); mockSave.mockReturnValueOnce(slow.promise);
  const { result, rerender } = setup(); act(() => result.current.newPlan());
  let pending!: ReturnType<typeof result.current.savePlan>;
  act(() => { pending = result.current.savePlan('A', 'NEW_REVISION'); });
  act(() => {
    if (intent === 'new') result.current.newPlan();
    if (intent === 'live') result.current.backToLive();
    if (intent === 'reorder') result.current.reorderDraft(['a']);
  });
  if (intent === 'project') rerender({ project: 'other', inputs: scheduling });
  await act(async () => { slow.resolve({ data: { save_plan_snapshot: plan('A') } }); await pending; });
  expect(result.current.mode).toBe(intent === 'live' || intent === 'project' ? 'live' : 'draft');
  expect(result.current.loadedPlan).toBeNull(); expect(result.current.saving).toBe(false);
});
test.each(['select', 'live', 'project'])('R3 recalculate cannot replace newer %s intent', async intent => {
  const { result, rerender } = setup(); await act(async () => result.current.loadPlan('A'));
  const slow = deferred<any>(); mockQuery.mockReturnValueOnce(slow.promise); let pending!: Promise<void>;
  act(() => { pending = result.current.recalculate(); });
  if (intent === 'select') await act(async () => result.current.loadPlan('B'));
  if (intent === 'live') act(() => result.current.backToLive());
  if (intent === 'project') rerender({ project: 'other', inputs: scheduling });
  await act(async () => { slow.resolve({ data: { plan_recalc_metadata: { task_ids: ['a'] } } }); await pending; });
  expect(result.current.mode).toBe(intent === 'select' ? 'saved' : 'live');
  if (intent === 'select') expect(result.current.loadedPlan?.plan_id).toBe('B');
});
test('R3 stale failure preserves newer view without installing an error', async () => {
  const slow = deferred<any>(); mockSave.mockReturnValueOnce(slow.promise);
  const { result } = setup(); act(() => result.current.newPlan()); let pending!: any;
  act(() => { pending = result.current.savePlan('A', 'NEW_REVISION'); result.current.backToLive(); });
  await act(async () => { slow.reject(new Error('old failure')); await pending; });
  expect(result.current.error).toBeNull();
});
test('R10 unavailable config refuses authoritative drafts and recalculation, then valid availability unblocks', async () => {
  const { result, rerender } = setup();
  rerender({ project: 'p', inputs: { ...scheduling, unavailableReason: 'Loading member capacity data' } as any });
  act(() => result.current.newPlan()); expect(result.current.mode).toBe('live'); expect(result.current.error).toMatch(/Loading/);
  await act(async () => result.current.loadPlan('A'));
  await act(async () => result.current.recalculate()); expect(result.current.mode).toBe('saved');
  rerender({ project: 'p', inputs: scheduling });
  act(() => result.current.newPlan()); expect(result.current.mode).toBe('draft');
});
test('defaults once to the newest plan and keeps an explicit No plan selection', async () => {
  mockPlans = [plan('newest'), plan('older')];
  const { result, rerender } = setup();
  await waitFor(() => expect(result.current.loadedPlan?.plan_id).toBe('newest'));
  expect(mockQuery).not.toHaveBeenCalled();

  act(() => result.current.backToLive());
  mockPlans = [plan('newer'), ...mockPlans];
  rerender({ project: 'p', inputs: { ...scheduling } });
  await act(async () => Promise.resolve());
  expect(result.current.mode).toBe('live');
  expect(mockQuery).not.toHaveBeenCalled();
});

test('a corrupt newest plan stays identifiable and can be deleted before selecting the next revision', async () => {
  mockPlans = [corruptPlan('corrupt'), plan('older')];
  const { result } = setup();
  await waitFor(() => expect(result.current.defaultPlanFallback).toBe(true));
  expect(result.current.mode).toBe('live');
  expect(result.current.loadedPlan?.plan_id).toBe('corrupt');
  expect(result.current.loadedSnapshot).toBeNull();
  expect(result.current.error).toBeNull();
  expect(mockQuery).not.toHaveBeenCalled();

  mockMutate.mockRejectedValueOnce(new Error('delete failed'));
  await act(async () => result.current.deletePlan());
  expect(result.current.loadedPlan?.plan_id).toBe('corrupt');
  expect(result.current.defaultPlanFallback).toBe(true);

  mockMutate.mockResolvedValueOnce({ data: { deletePlan: true } });
  mockRefetch.mockResolvedValueOnce({ data: { saved_plans: [plan('older')] } });
  await act(async () => result.current.deletePlan());
  expect(mockMutate).toHaveBeenLastCalledWith(expect.objectContaining({ mutation: DELETE_PLAN, variables: { id: 'corrupt' } }));
  expect(result.current.loadedPlan?.plan_id).toBe('older');
  expect(result.current.mode).toBe('saved');
});

test('a corrupt manual selection uses current scheduling and explicit No plan clears its identity', async () => {
  mockQuery.mockResolvedValueOnce({ data: { saved_plan: corruptPlan('corrupt') } });
  const { result } = setup();
  await act(async () => result.current.loadPlan('corrupt'));
  expect(result.current.mode).toBe('live');
  expect(result.current.loadedPlan?.plan_id).toBe('corrupt');
  expect(result.current.defaultPlanFallback).toBe(true);
  expect(result.current.error).toBeNull();

  act(() => result.current.backToLive());
  expect(result.current.loadedPlan).toBeNull();
  expect(result.current.defaultPlanFallback).toBe(false);
  expect(result.current.error).toBeNull();
});

test('a refreshed list clears a failed selection removed externally', async () => {
  mockQuery.mockResolvedValueOnce({ data: { saved_plan: corruptPlan('corrupt') } });
  const { result, rerender } = setup();
  await act(async () => result.current.loadPlan('corrupt'));
  expect(result.current.loadedPlan?.plan_id).toBe('corrupt');

  mockPlans = [];
  rerender({ project: 'p', inputs: { ...scheduling } });
  await waitFor(() => expect(result.current.loadedPlan).toBeNull());
  expect(result.current.defaultPlanFallback).toBe(false);
  expect(result.current.error).toBeNull();
});

test('R4 delete/set-active explicitly mutate displayed B, then selects the newest remaining legacy plan', async () => {
  const { result } = setup(); await act(async () => result.current.loadPlan('B'));
  mockMutate.mockResolvedValueOnce({ data: { setPlanActive: { id: 'B' } } });
  await act(async () => result.current.setActivePlan());
  expect(mockMutate).toHaveBeenLastCalledWith(expect.objectContaining({ mutation: SET_PLAN_ACTIVE, variables: { id: 'B' } }));
  expect(result.current.loadedPlan?.is_active).toBe(true);
  const legacy = { ...plan('A'), plan_data: { version: 2, tasks: [{ taskId: 'a', startDate: '2026-09-07', endDate: '2026-09-07', priorityOrder: 1 }], meta: {} } };
  mockMutate.mockResolvedValueOnce({ data: { deletePlan: true } });
  mockRefetch.mockResolvedValueOnce({ data: { saved_plans: [legacy] } });
  await act(async () => result.current.deletePlan());
  expect(mockMutate).toHaveBeenLastCalledWith(expect.objectContaining({ mutation: DELETE_PLAN, variables: { id: 'B' } }));
  expect(result.current.loadedPlan?.plan_id).toBe('A');
  expect(result.current.loadedSnapshot?.meta.legacyHoursMissing).toBe(true);
  expect(result.current.error).toBeNull();
});

test('deleting the final plan transitions to No plan', async () => {
  const { result } = setup(); await act(async () => result.current.loadPlan('B'));
  mockMutate.mockResolvedValueOnce({ data: { deletePlan: true } });
  mockRefetch.mockResolvedValueOnce({ data: { saved_plans: [] } });
  await act(async () => result.current.deletePlan());
  expect(result.current.mode).toBe('live');
  expect(result.current.loadedPlan).toBeNull();
});
test('save serializes actual selected snapshot and explicit revision mode, returned bytes become authority', async () => {
  const { result } = setup(); await act(async () => result.current.loadPlan('A'));
  await act(async () => result.current.recalculate());
  const snapshot = result.current.draft!.snapshot;
  mockSave.mockResolvedValueOnce({ data: { save_plan_snapshot: { ...plan('A2'), plan_data: snapshot } } });
  await act(async () => result.current.savePlan('Revision', 'NEW_REVISION'));
  expect(mockSave).toHaveBeenCalledWith({ variables: { input: { project_id: 'p', name: 'Revision', revision_mode: 'NEW_REVISION', plan_id: 'A', snapshot } } });
  expect(result.current.loadedSnapshot).toEqual(snapshot); expect(result.current.mode).toBe('saved');
});
