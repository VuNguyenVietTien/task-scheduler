import { buildInlineSubtaskInput, newInlineSubtaskDraft, nextSiblingPriorityOrder, upsertTaskTreeRow } from '../inline-subtask';
import type { Task } from '@/types/task';

const assignees = [
  { key: 'user:1', userId: 'user-1', resourceMemberId: null },
  { key: 'resource:2', userId: null, resourceMemberId: 'resource-2' },
];

describe('inline subtask input', () => {
  it('requires only a trimmed title and canonical parent', () => {
    const draft = { ...newInlineSubtaskDraft('draft', 'child-parent'), title: '  Nested task  ' };
    expect(buildInlineSubtaskInput(draft, 'project', assignees)).toMatchObject({
      title: 'Nested task', project_id: 'project', parent_task_id: 'child-parent',
      assignee_id: null, assignee_resource_member_id: null, start_date: null,
    });
    expect(() => buildInlineSubtaskInput({ ...draft, title: '   ' }, 'project', assignees)).toThrow();
  });

  it('appends canonical rows after existing descendants and allocates the next sibling order', () => {
    const rows = [
      { task_id: 'parent', priority_order: 10 },
      { task_id: 'child', parent_task_id: 'parent', priority_order: 32 },
      { task_id: 'grandchild', parent_task_id: 'child', priority_order: 33 },
      { task_id: 'next-root', priority_order: 11 },
    ] as Task[];
    expect(nextSiblingPriorityOrder(rows, 'parent')).toBe(33);
    expect(upsertTaskTreeRow(rows, {
      task_id: 'created', parent_task_id: 'parent', priority_order: 33,
    } as Task).map((task) => task.task_id)).toEqual(['parent', 'child', 'grandchild', 'created', 'next-root']);
  });

  it('maps optional fields and an unlinked resource member', () => {
    const draft = {
      ...newInlineSubtaskDraft('draft', 'parent'), title: 'Optional', assigneeKey: 'resource:2',
      startDate: '2030-01-02', progressCatalogItemId: 'progress-id',
      categoryCatalogItemId: 'category-id', taskTypeCatalogItemId: 'type-id',
      effort: '3.5', progress: '40', tags: 'one, two',
    };
    expect(buildInlineSubtaskInput(draft, 'project', assignees, 38)).toMatchObject({
      assignee_id: null, assignee_resource_member_id: 'resource-2', effort: 3.5, priority_order: 38,
      progress: 40, tags: ['one', 'two'], progress_catalog_item_id: 'progress-id',
      category_catalog_item_id: 'category-id', task_type_catalog_item_id: 'type-id',
    });
  });
});
