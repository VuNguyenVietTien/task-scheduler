import { client } from '@/lib/apollo-client';
import { updateTaskApi } from '@/hooks/useTasks';
import { transformTaskFromAPI } from '@/redux/features/tasksSlice';
import { buildCreateTaskInput, type TaskFormInputs } from '../NewTaskForm';

jest.mock('@/lib/apollo-client', () => ({ client: { mutate: jest.fn(), query: jest.fn() } }));

const mutate = client.mutate as jest.Mock;

beforeEach(() => mutate.mockReset());

test('create input writes UUID catalog keys and never localized legacy values', () => {
  const form: TaskFormInputs = {
    title: 'Task', description: 'Description', assignee: 'user', startDate: '', dueDate: '2030-01-01',
    categoryCatalogItemId: 'category-uuid', taskTypeCatalogItemId: 'type-uuid', progressCatalogItemId: 'progress-uuid',
    tags: [], status: 'TODO', priority: 'MEDIUM', priorityOrder: 0,
  };
  const input = buildCreateTaskInput(form, 'project');
  expect(input).toEqual(expect.objectContaining({
    category_catalog_item_id: 'category-uuid', task_type_catalog_item_id: 'type-uuid', progress_catalog_item_id: 'progress-uuid',
  }));
  expect(input).not.toHaveProperty('category');
  expect(input).not.toHaveProperty('type_');
  expect(input).not.toHaveProperty('progress_type');
});

test('update maps UUID set and explicit clear, requiring a complete successful result', async () => {
  mutate.mockResolvedValueOnce({ data: { update_task: {
    task_id: 'task', project_id: 'project', progress_catalog_item_id: 'progress-uuid', category_catalog_item_id: null, task_type_catalog_item_id: 'type-uuid',
  } } });
  const result = await updateTaskApi('task', { progressCatalogItemId: 'progress-uuid', categoryCatalogItemId: null, taskTypeCatalogItemId: 'type-uuid' });
  expect(mutate.mock.calls[0][0].variables.input).toEqual({
    task_id: 'task', progress_catalog_item_id: 'progress-uuid', category_catalog_item_id: null, task_type_catalog_item_id: 'type-uuid',
  });
  expect(result).toEqual(expect.objectContaining({ progressCatalogItemId: 'progress-uuid', categoryCatalogItemId: null, taskTypeCatalogItemId: 'type-uuid' }));

  mutate.mockResolvedValueOnce({ data: { update_task: { task_id: 'task' } }, errors: [{ message: 'rejected' }] });
  await expect(updateTaskApi('task', { progressCatalogItemId: null })).rejects.toThrow('rejected');
});

test('normalizer preserves null versus undefined through a depth-three tree', () => {
  const root = transformTaskFromAPI({
    task_id: 'root', project_id: 'project', title: 'root', status: 'TODO', priority: 'MEDIUM', priority_order: 0, created_by: 'u',
    progress_catalog_item_id: null,
    child_tasks: [{
      task_id: 'child', project_id: 'project', title: 'child', status: 'TODO', priority: 'MEDIUM', priority_order: 0, created_by: 'u',
      progress_catalog_item_id: 'progress-uuid', category_catalog_item_id: null,
      child_tasks: [{ task_id: 'grandchild', project_id: 'project', title: 'grandchild', status: 'TODO', priority: 'MEDIUM', priority_order: 0, created_by: 'u', task_type_catalog_item_id: 'type-uuid' }],
    }],
  }) as any;
  expect(root.progressCatalogItemId).toBeNull();
  expect(root.categoryCatalogItemId).toBeUndefined();
  expect(root.child_tasks[0].progressCatalogItemId).toBe('progress-uuid');
  expect(root.child_tasks[0].categoryCatalogItemId).toBeNull();
  expect(root.child_tasks[0].child_tasks[0].taskTypeCatalogItemId).toBe('type-uuid');
});
