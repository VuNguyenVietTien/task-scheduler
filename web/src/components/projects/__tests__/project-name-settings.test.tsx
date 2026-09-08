import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProjectNameSettings } from '../ProjectNameSettings';

const mutate = jest.fn();
let loading = false;
jest.mock('@apollo/client', () => ({
  gql: (strings: TemplateStringsArray) => strings.join(''),
  useMutation: () => [mutate, { loading }],
}));

beforeEach(() => {
  jest.clearAllMocks();
  loading = false;
});

test('renames through backend, refreshes project surfaces, and reports success', async () => {
  const onRenamed = jest.fn();
  mutate.mockResolvedValue({ data: { update_project: 'Renamed project' } });
  render(<ProjectNameSettings projectId="project-1" initialName="Old project" canManage onRenamed={onRenamed} />);
  fireEvent.change(screen.getByLabelText('Project name'), { target: { value: ' Renamed project ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
  await waitFor(() => expect(mutate).toHaveBeenCalledWith(expect.objectContaining({
    variables: { projectId: 'project-1', name: 'Renamed project' },
    awaitRefetchQueries: true,
  })));
  await waitFor(() => expect(onRenamed).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('status')).toHaveTextContent('Project name saved');
  expect(screen.getByLabelText('Project name')).toHaveValue('Renamed project');
});

test('retains edited name and reports backend failure', async () => {
  mutate.mockRejectedValue(new Error('forbidden'));
  render(<ProjectNameSettings projectId="project-1" initialName="Old project" canManage onRenamed={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Wanted name' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('forbidden'));
  expect(screen.getByLabelText('Project name')).toHaveValue('Wanted name');
});
