import { print } from 'graphql';
import { UPDATE_TASK, UPDATE_TASK_EFFORT, UPDATE_TASK_STATUS } from '@/graphql/mutations/tasks';
import { GET_PROJECT_TASKS } from '@/graphql/queries/tasks';
import tasksReducer, { transformTaskFromAPI, upsertTask, upsertTaskInTree } from '../tasksSlice';
import type { Task } from '@/types/task';

const task = (task_id: string, extra: Partial<Task> = {}): Task => ({
  task_id,
  project_id: 'project',
  title: task_id,
  status: 'TODO',
  priority: 'MEDIUM',
  priority_order: 1,
  created_by: 'owner',
  ...extra,
}) as Task;

describe('REALTIME-EXCEL task normalization and upsert', () => {
  it('uses the List task fragment for every task update response', () => {
    const fields = ['task_id', 'project_id', 'parent_task_id', 'assignee_resource_member_id', 'progress_catalog_item_id', 'category_catalog_item_id', 'task_type_catalog_item_id', 'child_tasks'];
    [GET_PROJECT_TASKS, UPDATE_TASK, UPDATE_TASK_STATUS, UPDATE_TASK_EFFORT].forEach((document) => {
      const source = print(document);
      fields.forEach((field) => expect(source).toContain(field));
    });
  });

  it('normalizes assignment/catalog/children once and replaces a deep task without losing hierarchy', () => {
    const grandchild = task('grandchild', { parent_task_id: 'child', effort: 2 });
    const child = task('child', { parent_task_id: 'root', description: 'preserved', child_tasks: [grandchild] });
    const root = task('root', { child_tasks: [child] });
    const returned = transformTaskFromAPI({
      task_id: 'child', project_id: 'project', parent_task_id: 'root', title: 'child',
      status: 'DONE', priority: 'HIGH', priority_order: 1, created_by: 'owner', effort: 9,
      assignee_resource_member_id: 'resource-1',
      assignee: { user_id: 'user-1', username: 'Ada', full_name: 'Ada Lovelace' },
      progress_catalog_item_id: 'progress-1', category_catalog_item_id: 'category-1',
      task_type_catalog_item_id: 'type-1',
    }) as Task;

    const state = tasksReducer({
      tasks: [root], loading: false, error: null,
      pagination: { totalItems: 1, totalPages: 1, currentPage: 1, pageSize: 20 }, filters: {},
    }, upsertTask(returned));
    const saved = state.tasks[0].child_tasks![0];

    expect(saved).toMatchObject({
      task_id: 'child', status: 'DONE', effort: 9,
      assignee_resource_member_id: 'resource-1',
      assignee: { userId: 'user-1', username: 'Ada Lovelace' },
      progressCatalogItemId: 'progress-1', categoryCatalogItemId: 'category-1', taskTypeCatalogItemId: 'type-1',
    });
    expect(saved.child_tasks).toEqual([grandchild]);
  });

  it('uses the returned child list without duplicating task nodes or changing order', () => {
    const first = task('first');
    const second = task('second');
    const root = task('root', { child_tasks: [first, second] });
    const returned = task('root', { title: 'saved root', child_tasks: [task('first', { status: 'DOING' }), second] });

    const updated = upsertTaskInTree([root], returned);
    expect(updated).toHaveLength(1);
    expect(updated[0].child_tasks?.map((item) => item.task_id)).toEqual(['first', 'second']);
    expect(updated[0].child_tasks?.filter((item) => item.task_id === 'first')).toHaveLength(1);
    expect(updated[0].child_tasks?.[0].status).toBe('DOING');
  });
});
