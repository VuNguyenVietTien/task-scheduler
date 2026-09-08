import { buildInlineSubtaskInput, newInlineSubtaskDraft } from '../inline-subtask';

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

  it('maps optional fields and an unlinked resource member', () => {
    const draft = {
      ...newInlineSubtaskDraft('draft', 'parent'), title: 'Optional', assigneeKey: 'resource:2',
      startDate: '2030-01-02', progressCatalogItemId: 'progress-id',
      categoryCatalogItemId: 'category-id', taskTypeCatalogItemId: 'type-id',
      effort: '3.5', progress: '40', tags: 'one, two',
    };
    expect(buildInlineSubtaskInput(draft, 'project', assignees)).toMatchObject({
      assignee_id: null, assignee_resource_member_id: 'resource-2', effort: 3.5,
      progress: 40, tags: ['one', 'two'], progress_catalog_item_id: 'progress-id',
      category_catalog_item_id: 'category-id', task_type_catalog_item_id: 'type-id',
    });
  });
});
