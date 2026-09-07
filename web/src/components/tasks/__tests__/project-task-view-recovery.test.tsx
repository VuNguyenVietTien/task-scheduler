import React from 'react';
import { act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import tasksReducer, { fetchProjectTasks } from '../../../redux/features/tasksSlice';
import { ProjectDetailView } from '../../projects/ProjectDetailView';
import { client } from '@/lib/apollo-client';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Task } from '@/types/task';

const cloneMutation = jest.fn();
const refetch = jest.fn();

let treeQuery: Record<string, unknown>;

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('@/hooks/useTaskFieldMutations', () => ({
  useUpdateTaskStatus: () => ({ updateStatus: jest.fn(), isUpdating: false }),
  useUpdateTaskPriority: () => ({ updatePriority: jest.fn(), isUpdating: false }),
  useUpdateTaskEffort: () => ({ updateEffort: jest.fn(), isUpdating: false }),
  useUpdateTaskDueDate: () => ({ updateDueDate: jest.fn(), isUpdating: false }),
  useUpdateTaskAssignee: () => ({ updateAssignee: jest.fn(), isUpdating: false }),
}));
jest.mock('@/hooks/useTasks', () => ({
  useUpdateTaskPriorityOrder: () => jest.fn(),
  useUpdateTask: () => ({ updateTask: jest.fn() }),
}));
jest.mock('@/hooks/useProjectTaxonomies', () => ({
  useProjectTaxonomies: () => ({
    phases: [], loading: false, ensureDefaultPhases: jest.fn(), createPhase: jest.fn(),
    updatePhase: jest.fn(), archivePhase: jest.fn(), setTaskPhase: jest.fn(),
  }),
}));
jest.mock('@/components/projects/phase-controls', () => ({
  PhaseFilterSelect: () => null, TaskPhaseSelect: () => null, applyPhaseFilter: (tasks: Task[]) => tasks,
}));
jest.mock('@/components/projects/PhaseSettingsPanel', () => ({ PhaseSettingsPanel: () => null }));
jest.mock('@/components/common/UserAvatar', () => ({ UserAvatar: () => null }));
jest.mock('../TaskDetail', () => ({ TaskDetail: () => null }));
jest.mock('@/components/ui/Dialog', () => ({
  Dialog: ({ open, title, children }: { open: boolean; title: string; children: React.ReactNode }) =>
    open ? <div role="dialog" aria-label={title}>{children}</div> : null,
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/apollo-client', () => ({ client: { query: jest.fn(), mutate: jest.fn() } }));
jest.mock('@apollo/client', () => ({
  gql: (strings: TemplateStringsArray) => strings.join(''),
  useQuery: (_document: unknown, options: { variables?: { only_assignable?: boolean } }) => (
    options.variables?.only_assignable
      ? { data: { resource_members: [] }, loading: false }
      : treeQuery
  ),
  useMutation: () => [cloneMutation, { loading: false }],
}), { virtual: true });

const root: Task = {
  task_id: 'root', project_id: 'project-1', title: 'Root task', priority_order: 1,
  status: 'TODO', priority: 'MEDIUM', created_by: 'owner', child_tasks: [],
};

function submitClone() {
  fireEvent.click(screen.getByRole('button', { name: 'Create 1 copy (1 task)' }));
}

beforeEach(() => {
  jest.clearAllMocks();
  treeQuery = { data: { task_tree_rows: [root] }, loading: false, error: undefined, refetch };
  refetch.mockResolvedValue({ data: { task_tree_rows: [root] } });
});


jest.mock('@/hooks/useUsers',()=>({useUsers:()=>({data:[],loading:false})}));
jest.mock('@/hooks/useProject',()=>({useProject:()=>({data:{project:{user_role:'manager'}},refetch:jest.fn()})}));
// Stateful boundary sentinel; real Gantt content is a separate combined-artifact gate.
jest.mock('@/components/timeline/Timeline',()=>({Timeline: function TimelineSentinel() {
  const [selection, setSelection] = React.useState('live');
  return <select aria-label="Saved history" value={selection} onChange={(event) => setSelection(event.target.value)}>
    <option value="live">Live</option><option value="saved">Saved revision</option>
  </select>;
}}));
jest.mock('@/components/tasks/KanbanBoard',()=>({KanbanBoard:()=>null}));
jest.mock('@/components/projects/MembersView',()=>({MembersView:()=>null}));
jest.mock('@/components/reports/ProjectReportView',()=>({ProjectReportView:()=>null}));
jest.mock('@/components/projects/DocumentsTab',()=>({DocumentsTab:()=>null}));
jest.mock('@/app/projects/[id]/timesheet/page',()=>({__esModule:true,default:()=>null}));
jest.mock('@/redux/features/membersSlice',()=>({fetchProjectMembers:()=>({type:'test/members',payload:[]})}));
jest.mock('@/redux/features/plansSlice',()=>({fetchProjectPlans:()=>({type:'test/plans',payload:[]}),fetchLatestProjectPlan:()=>({type:'test/latest',payload:null}),selectPlans:()=>[]}));
jest.mock('@/utils/taskScheduler',()=>({processTasksAndUpdateStore:jest.fn(),processTasksBasedOnPlan:jest.fn()}));
jest.mock('@/redux/features/taskOrderStore',()=>({updateAutoSort:()=>({type:'test/sort'})}));

let projectView: ReturnType<typeof render>;
function projectElement(store: any, projectId = 'project-1', initialTab = 'list') {
  return <Provider store={store}><ProjectDetailView project={{id:projectId,name:'Test project'} as any} initialTab={initialTab} /></Provider>;
}

async function mountActualProject() {
  (client.query as jest.Mock).mockResolvedValue({data:{tasks:[root]}});
  const store=configureStore({reducer:{tasks:tasksReducer,members:(state={members:[],loading:false})=>state,plans:(state={plans:[]})=>state}});
  projectView = render(projectElement(store));
  await waitFor(()=>expect(screen.getByTestId('clone-task-root')).toBeInTheDocument());
  return store;
}

test('actual ProjectDetailView must retain committed-refresh-failure recovery across task refetch', async()=>{
  await mountActualProject();
  let completeQuery!: (response:any)=>void;
  (client.query as jest.Mock).mockImplementation(()=>new Promise(resolve=>{completeQuery=resolve;}));
  cloneMutation.mockResolvedValue({data:{clone_task_subtree:{created_task_ids:['created-root'],root_task_ids:['created-root']}}});
  refetch.mockRejectedValue(new Error('flat tree offline'));
  fireEvent.click(screen.getByTestId('clone-task-root'));
  submitClone();
  await waitFor(()=>expect(client.query).toHaveBeenCalledTimes(2));
  await act(async()=>{completeQuery({data:{tasks:[root]}});});
  await waitFor(()=>expect(screen.getByTestId('clone-task-root')).toBeInTheDocument());
  // Reopening must not discard unresolved committed state.
  fireEvent.click(screen.getByTestId('clone-task-root'));
  expect(cloneMutation).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button',{name:'Create 1 copy (1 task)'})).toBeDisabled();
});

test('actual parent forwards the selected 3-of-6 quantity-3 contract in one mutation', async()=>{
  await mountActualProject();
  treeQuery={data:{task_tree_rows:[root,...Array.from({length:6},(_,i)=>({task_id:'c'+i,parent_task_id:'root',title:'Child '+i}))]},loading:false,refetch};
  cloneMutation.mockResolvedValue({data:{clone_task_subtree:{created_task_ids:Array.from({length:12},(_,i)=>'copy-'+i),root_task_ids:['copy-0','copy-4','copy-8']}}});
  fireEvent.click(screen.getByTestId('clone-task-root'));
  for(const i of [1,3,5])fireEvent.click(screen.getByRole('checkbox',{name:'Child '+i}));
  fireEvent.change(screen.getByRole('spinbutton',{name:'Number of copies'}),{target:{value:'3'}});
  fireEvent.click(screen.getByRole('button',{name:'Create 3 copies (12 tasks)'}));
  await waitFor(()=>expect(cloneMutation).toHaveBeenCalledTimes(1));
  expect(cloneMutation).toHaveBeenCalledWith({variables:{input:{source_task_id:'root',selected_descendant_ids:['c0','c2','c4'],quantity:3}}});
  await waitFor(()=>expect(refetch).toHaveBeenCalled());
});

test.each(['committed', 'unknown'] as const)('%s recovery survives each refresh failure, close/reopen, tab unmount and explicit retry', async (outcome) => {
  for (const failure of ['tree', 'redux']) {
    const store = await mountActualProject();
    cloneMutation.mockClear();
    if (outcome === 'committed') cloneMutation.mockResolvedValue({ data: { clone_task_subtree: { created_task_ids: ['new'], root_task_ids: ['new'] } } });
    else cloneMutation.mockRejectedValue({ networkError: new Error('connection lost') });
    refetch.mockImplementation(async () => { if (failure === 'tree') throw new Error('tree offline'); return { data: { task_tree_rows: [root] } }; });
    (client.query as jest.Mock).mockImplementation(async () => { if (failure === 'redux') throw new Error('redux offline'); return { data: { tasks: [root] } }; });
    fireEvent.click(screen.getByTestId('clone-task-root'));
    submitClone();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh task list' })).toBeEnabled());
    const truth = outcome === 'committed' ? 'Created 1 copies' : 'Could not confirm clone';
    expect(screen.getByRole('dialog')).toHaveTextContent(truth);
    expect(screen.getByRole('button', { name: 'Create 1 copy (1 task)' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByTestId('clone-task-root'));
    expect(screen.getByRole('dialog')).toHaveTextContent(truth);
    expect(screen.getByRole('button', { name: 'Create 1 copy (1 task)' })).toBeDisabled();
    // Real List unmount: recovery remains in the actual project parent.
    projectView.rerender(projectElement(store, 'project-1', 'members'));
    projectView.rerender(projectElement(store));
    fireEvent.click(await screen.findByTestId('clone-task-root'));
    expect(screen.getByRole('dialog')).toHaveTextContent(truth);
    expect(screen.getByRole('button', { name: 'Create 1 copy (1 task)' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh task list' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh task list' })).toBeEnabled());
    expect(screen.getByRole('dialog')).toHaveTextContent(truth);
    expect(screen.getByRole('button', { name: 'Create 1 copy (1 task)' })).toBeDisabled();
    refetch.mockResolvedValue({ data: { task_tree_rows: [root] } });
    (client.query as jest.Mock).mockResolvedValue({ data: { tasks: [root] } });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh task list' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByTestId('clone-task-root'));
    expect(screen.getByRole('button', { name: 'Create 1 copy (1 task)' })).toBeEnabled();
    expect(cloneMutation).toHaveBeenCalledTimes(1);
    projectView.unmount();
  }
});

test('project-scoped recovery does not lock an unrelated project and is retained when returning', async () => {
  const store = await mountActualProject();
  cloneMutation.mockRejectedValue({ networkError: new Error('lost') });
  refetch.mockRejectedValue(new Error('tree offline'));
  fireEvent.click(screen.getByTestId('clone-task-root'));
  submitClone();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh task list' })).toBeEnabled());
  const other = { ...root, task_id: 'other', project_id: 'project-2' };
  (client.query as jest.Mock).mockResolvedValue({ data: { tasks: [other] } });
  treeQuery = { data: { task_tree_rows: [other] }, loading: false, refetch };
  projectView.rerender(projectElement(store, 'project-2'));
  fireEvent.click(await screen.findByTestId('clone-task-other'));
  expect(screen.getByRole('button', { name: 'Create 1 copy (1 task)' })).toBeEnabled();
  (client.query as jest.Mock).mockResolvedValue({ data: { tasks: [root] } });
  treeQuery = { data: { task_tree_rows: [root] }, loading: false, refetch };
  projectView.rerender(projectElement(store));
  fireEvent.click(await screen.findByTestId('clone-task-root'));
  expect(screen.getByRole('dialog')).toHaveTextContent('Could not confirm clone');
  expect(screen.getByRole('button', { name: 'Create 1 copy (1 task)' })).toBeDisabled();
  expect(cloneMutation).toHaveBeenCalledTimes(1);
});

test('in-flight clone guard survives tab unmount and cannot be unlocked by a premature refresh', async () => {
  const store = await mountActualProject();
  let complete!: (value: any) => void;
  cloneMutation.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  fireEvent.click(screen.getByTestId('clone-task-root'));
  submitClone();
  projectView.rerender(projectElement(store, 'project-1', 'members'));
  projectView.rerender(projectElement(store));
  fireEvent.click(await screen.findByTestId('clone-task-root'));
  expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Refresh task list' })).toBeDisabled();
  await act(async () => complete({ data: { clone_task_subtree: { created_task_ids: ['new'] } } }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Creating…' })).not.toBeInTheDocument());
  expect(cloneMutation).toHaveBeenCalledTimes(1);
});

test('Gantt mounts for empty live tasks and preserves selected history during pending/failed background refresh', async () => {
  let finishInitial!: (value: any) => void;
  (client.query as jest.Mock).mockImplementation(() => new Promise(resolve => { finishInitial = resolve; }));
  const store = configureStore({ reducer: { tasks: tasksReducer, members: (state={members:[],loading:false})=>state, plans: (state={plans:[]})=>state } });
  projectView = render(projectElement(store, 'project-1', 'gantt'));
  expect(screen.queryByRole('combobox', { name: 'Saved history' })).not.toBeInTheDocument();
  await act(async () => finishInitial({ data: { tasks: [] } }));
  const selector = await screen.findByRole('combobox', { name: 'Saved history' });
  fireEvent.change(selector, { target: { value: 'saved' } });
  let rejectRefresh!: (reason: Error) => void;
  (client.query as jest.Mock).mockImplementation(() => new Promise((_resolve, reject) => { rejectRefresh = reject; }));
  let refresh: any;
  act(() => { refresh = store.dispatch(fetchProjectTasks('project-1')); });
  expect(screen.getByRole('combobox', { name: 'Saved history' })).toBe(selector);
  expect(selector).toHaveValue('saved');
  await act(async () => { rejectRefresh(new Error('refresh offline')); await refresh; });
  expect(screen.getByRole('alert')).toHaveTextContent('refresh offline');
  expect(screen.getByRole('combobox', { name: 'Saved history' })).toBe(selector);
  expect(selector).toHaveValue('saved');
  (client.query as jest.Mock).mockResolvedValue({ data: { tasks: [] } });
  await act(async () => { await store.dispatch(fetchProjectTasks('project-1')); });
  expect(selector).toHaveValue('saved');
  projectView.rerender(projectElement(store));
  expect(screen.getByText('No tasks found')).toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: 'Saved history' })).not.toBeInTheDocument();
});

test('actual parent counts every descendant once without flattening or paginating a subtree as roots', async () => {
  const store = await mountActualProject();
  const grandchild: Task = { ...root, task_id: 'grandchild', parent_task_id: 'child-0', title: 'Grandchild task', status: 'DONE' };
  const children: Task[] = Array.from({ length: 11 }, (_, index) => ({
    ...root, task_id: `child-${index}`, parent_task_id: 'root', title: `Count child ${index}`,
    status: index === 0 ? 'DOING' : 'TODO', child_tasks: index === 0 ? [grandchild] : [],
  }));
  const tree = { ...root, child_tasks: children };
  (client.query as jest.Mock).mockResolvedValue({ data: { tasks: [tree] } });
  treeQuery = { data: { task_tree_rows: [root, children[0], grandchild, ...children.slice(1)] }, loading: false, refetch };
  await act(async () => { await store.dispatch(fetchProjectTasks('project-1')); });
  expect(screen.getByTestId('total-task-count')).toHaveTextContent('Total tasks: 13 (including descendants)');
  expect(screen.getByTestId('displayed-root-count')).toHaveTextContent('Displayed roots: 1');
  expect(screen.getByTestId('task-status-count-TODO')).toHaveTextContent(': 11');
  expect(screen.getByTestId('task-status-count-DOING')).toHaveTextContent(': 1');
  expect(screen.getByTestId('task-status-count-DONE')).toHaveTextContent(': 1');
  expect(screen.queryByRole('button', { name: 'Trang 2' })).not.toBeInTheDocument();
  expect(screen.queryByText('Grandchild task')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Mở rộng task con' }));
  fireEvent.click(screen.getByRole('button', { name: 'Mở rộng task con' }));
  expect(screen.getAllByText('Grandchild task')).toHaveLength(1);
  expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(14); // header + 13 identities
  fireEvent.click(screen.getByTestId('mode-excel-btn'));
  expect(screen.getByTestId('total-task-count')).toHaveTextContent('Total tasks: 13');
  expect(screen.getByTestId('displayed-root-count')).toHaveTextContent('Displayed roots: 1');
  const cells = screen.getAllByTestId(/^excel-cell-\d+-0$/);
  expect(cells).toHaveLength(13);
  expect(new Set(cells.map((cell) => cell.getAttribute('data-task-id'))).size).toBe(13);
  fireEvent.click(screen.getByTestId('mode-normal-btn'));
  expect(screen.getByTestId('total-task-count')).toHaveTextContent('Total tasks: 13');
  expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(14);
});

test('actual parent labels root-based pagination separately from all-task totals', async () => {
  const store = await mountActualProject();
  const child: Task = { ...root, task_id: 'nested', parent_task_id: 'root-0', title: 'Nested task' };
  const roots = Array.from({ length: 11 }, (_, index) => ({
    ...root, task_id: `root-${index}`, title: `Count root ${index}`, child_tasks: index === 0 ? [child] : [],
  }));
  (client.query as jest.Mock).mockResolvedValue({ data: { tasks: roots } });
  await act(async () => { await store.dispatch(fetchProjectTasks('project-1')); });
  expect(screen.getByTestId('total-task-count')).toHaveTextContent('Total tasks: 12 (including descendants)');
  expect(screen.getByTestId('displayed-root-count')).toHaveTextContent('Displayed roots: 11');
  const pagination = screen.getByLabelText('Parent task pagination');
  expect(pagination).toHaveTextContent('Pages count parent tasks only');
  expect(pagination).toHaveTextContent(/11\s+công việc/);
  expect(within(pagination).getByRole('button', { name: 'Trang 2' })).toBeInTheDocument();
});
