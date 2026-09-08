import { updateTaskApi } from '../useTasks';

const mutate = jest.fn();

jest.mock('@/lib/apollo-client', () => ({
  client: { mutate: (...args: unknown[]) => mutate(...args) },
}));

beforeEach(() => {
  mutate.mockReset();
  mutate.mockImplementation(async ({ variables: { input } }) => ({
    data: { update_task: {
      task_id: 'task-1', project_id: 'project-1', title: input.title ?? 'Task',
      priority_order: 1, status: 'TODO', priority: 'MEDIUM', created_by: 'owner',
      ...input,
    } },
  }));
});

test('sends and retains an explicit null start date', async () => {
  const result = await updateTaskApi('task-1', { start_date: null } as any);

  expect(mutate).toHaveBeenCalledWith(expect.objectContaining({
    variables: { input: { task_id: 'task-1', start_date: null } },
  }));
  expect(result.start_date).toBeNull();
});

test('omits start date when an unrelated sparse field is updated', async () => {
  await updateTaskApi('task-1', { title: 'Renamed' });

  const input = mutate.mock.calls[0][0].variables.input;
  expect(input).toEqual({ task_id: 'task-1', title: 'Renamed' });
  expect(input).not.toHaveProperty('start_date');
});
