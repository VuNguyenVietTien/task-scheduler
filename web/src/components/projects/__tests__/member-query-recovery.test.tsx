import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MembersView } from '../MembersView';

const query = jest.fn();
const mutate = jest.fn();
const refetch = jest.fn();
jest.mock('@apollo/client', () => ({
  gql: (strings: TemplateStringsArray) => strings.join(''),
  useQuery: (document: any, ...args: unknown[]) => query(document.loc?.source.body ?? document, ...args),
  useMutation: (document: any) => [(options: unknown) => mutate(document.loc?.source.body ?? document, options)],
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const member = { member_id: 'member-1', resource_member_id: 'resource-1', display_name: 'Name Only', user_id: null, email: null, member_kind: 'MEMBER', access_role: null };
function mount() { return render(<MembersView projectId="project-1" currentUserRole="manager" members={[]} refetch={jest.fn()} />); }
beforeEach(() => {
  jest.clearAllMocks();
  refetch.mockResolvedValue({ data: { resource_members: [member] } });
  mutate.mockResolvedValue({ data: {} });
  query.mockImplementation((document: string) => ({
    data: document.includes('query ResourceMembers(') ? { resource_members: [member] } : {},
    loading: false, error: undefined, refetch,
  }));
});

test('one canonical form: name-only create and later email link send no role grant', async () => {
  mount();
  expect(screen.getAllByTestId('create-resource-member-btn')).toHaveLength(1);
  fireEvent.change(screen.getByLabelText('New member display name'), { target: { value: ' Fresh Name ' } });
  fireEvent.click(screen.getByTestId('create-resource-member-btn'));
  await waitFor(() => expect(mutate).toHaveBeenCalledWith(expect.stringContaining('mutation CreateResourceMember'), {
    variables: { input: { project_id: 'project-1', display_name: 'Fresh Name', email: null } },
  }));
  fireEvent.change(screen.getByLabelText('Link user for Name Only'), { target: { value: ' existing@example.test ' } });
  fireEvent.click(screen.getByTestId('link-member-btn-resource-1'));
  await waitFor(() => expect(mutate).toHaveBeenCalledWith(expect.stringContaining('mutation LinkResourceMemberByEmail'), {
    variables: { resource_member_id: 'resource-1', email: 'existing@example.test' },
  }));
  expect(mutate.mock.calls.some(([document]) => document.includes('mutation SetProjectMemberAccess'))).toBe(false);
  expect(refetch).toHaveBeenCalledTimes(2);
});

test('canonical member query failure must not present a successful empty member list', () => {
  query.mockImplementation((document: string) => ({
    data: document.includes('query ResourceMembers(') ? undefined : {},
    loading: false, error: document.includes('query ResourceMembers(') ? new Error('members offline') : undefined, refetch,
  }));
  mount();
  expect(screen.queryByText('No resource members yet')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('members offline');
});

test('loading is not empty; confirmed empty and failed-query retry are explicit', async () => {
  let state: any = { loading: true, refetch };
  query.mockImplementation((document: string) => document.includes('query ResourceMembers(') ? state : { data: {}, loading: false, refetch });
  const view = mount();
  expect(screen.getByRole('status')).toHaveTextContent('Loading project members');
  expect(screen.queryByText('No resource members yet')).not.toBeInTheDocument();
  state = { data: { resource_members: [] }, loading: false, refetch };
  view.rerender(<MembersView projectId="project-1" currentUserRole="manager" members={[]} refetch={jest.fn()} />);
  expect(screen.getByText('No resource members yet')).toBeInTheDocument();
  state = { loading: false, error: new Error('offline'), refetch };
  view.rerender(<MembersView projectId="project-1" currentUserRole="manager" members={[]} refetch={jest.fn()} />);
  expect(screen.queryByText('No resource members yet')).not.toBeInTheDocument();
  refetch.mockRejectedValueOnce(new Error('retry offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Retry members' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('retry offline'));
  refetch.mockImplementationOnce(async () => {
    state = { data: { resource_members: [] }, loading: false, refetch };
    return state;
  });
  fireEvent.click(screen.getByRole('button', { name: 'Retry members' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(screen.getByText('No resource members yet')).toBeInTheDocument();
});

test.each(['create', 'link', 'access'])('%s awaits and catches post-write refresh failure without claiming rollback; retry does not repeat mutation', async (action) => {
  let rejectRefresh!: (error: Error) => void;
  refetch.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRefresh = reject; }));
  mount();
  if (action === 'create') {
    fireEvent.change(screen.getByLabelText('New member display name'), { target: { value: 'Fresh Name' } });
    fireEvent.click(screen.getByTestId('create-resource-member-btn'));
  } else if (action === 'link') {
    fireEvent.change(screen.getByLabelText('Link user for Name Only'), { target: { value: 'existing@example.test' } });
    fireEvent.click(screen.getByTestId('link-member-btn-resource-1'));
  } else {
    fireEvent.change(screen.getByLabelText('Access role for Name Only'), { target: { value: 'member' } });
  }
  await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('status')).toHaveTextContent('Loading project members');
  rejectRefresh(new Error('refresh offline'));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Member change saved, but refresh failed: refresh offline'));
  expect(screen.getByTestId('resource-members-table')).toHaveTextContent('Name Only');
  if (action === 'create') {
    expect(screen.getByLabelText('New member display name')).toHaveValue('');
    expect(screen.getByLabelText('New member email')).toHaveValue('');
    expect(screen.getByTestId('create-resource-member-btn')).toBeDisabled();
  }
  if (action === 'link') expect(screen.getByLabelText('Link user for Name Only')).toHaveValue('');
  expect(screen.queryByText('No resource members yet')).not.toBeInTheDocument();
  refetch.mockResolvedValue({ data: { resource_members: [member] } });
  fireEvent.click(screen.getByRole('button', { name: 'Retry members' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(mutate).toHaveBeenCalledTimes(1);
});

test('confirmed member result remains visible after failed refresh instead of reverting to placeholder', async () => {
  let data = { resource_members: [member] };
  query.mockImplementation((document: string) => ({
    data: document.includes('query ResourceMembers(') ? data : {}, loading: false, refetch,
    updateQuery: (update: (current: typeof data) => typeof data) => { data = update(data); },
  }));
  mutate.mockResolvedValue({ data: { link_resource_member_by_email: { ...member, user_id: 'linked-user', email: 'existing@example.test' } } });
  refetch.mockRejectedValue(new Error('refresh offline'));
  mount();
  fireEvent.change(screen.getByLabelText('Link user for Name Only'), { target: { value: 'existing@example.test' } });
  fireEvent.click(screen.getByTestId('link-member-btn-resource-1'));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Member change saved, but refresh failed'));
  expect(screen.getByTestId('linked-resource-1')).toBeInTheDocument();
  expect(screen.queryByLabelText('Link user for Name Only')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Access role for Name Only')).toHaveValue('');
});

test('partial GraphQL refresh errors are not confirmed member data', async () => {
  refetch.mockResolvedValue({ data: { resource_members: [member] }, errors: [{ message: 'access lookup failed' }] });
  mount();
  fireEvent.change(screen.getByLabelText('Access role for Name Only'), { target: { value: 'member' } });
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Member change saved, but refresh failed: access lookup failed'));
  expect(screen.getByRole('button', { name: 'Retry members' })).toBeEnabled();
});

test.each([null, 'linked-user'])('confirmed remove sends canonical member_id for unlinked or linked row (%s)', async (userId) => {
  const row = { ...member, user_id: userId };
  query.mockImplementation((document: string) => ({
    data: document.includes('query ResourceMembers(') ? { resource_members: [row] } : {},
    loading: false, error: undefined, refetch,
    updateQuery: jest.fn(),
  }));
  mutate.mockImplementation((document: string) => Promise.resolve({
    data: document.includes('mutation RemoveResourceMember') ? { remove_resource_member: true } : {},
  }));
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Remove Name Only' }));
  await waitFor(() => expect(mutate).toHaveBeenCalledWith(expect.stringContaining('mutation RemoveResourceMember'), {
    variables: { project_id: 'project-1', member_id: 'member-1' },
  }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Name Only removed'));
});
