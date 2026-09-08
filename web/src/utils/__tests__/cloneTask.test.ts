import {
  buildCloneTree,
  createCloneSelectionInput,
  defaultCloneSelection,
  getCloneCheckboxState,
  getClonePreview,
  getSelectedCloneRootIds,
  parseCloneQuantity,
  updateCloneSelection,
  type CloneTreeNode,
} from '@/utils/cloneTask';

const N = (task_id: string, parent_task_id: string | null, title = task_id): CloneTreeNode => ({
  task_id,
  parent_task_id,
  title,
});

describe('clone selection helpers', () => {
  it('projects one nested active subtree without duplicates, orphans, unrelated roots, or cycle hangs', () => {
    const tree = buildCloneTree([
      N('root', 'cycle-back'),
      N('child', 'root'),
      N('grandchild', 'child'),
      N('other', null),
      N('orphan', 'missing'),
      N('child', 'other', 'duplicate'),
      N('cycle-back', 'grandchild'),
      { ...N('deleted', 'root'), is_deleted: true },
      N('under-deleted', 'deleted'),
    ], 'root');

    expect(tree.items.map(({ node, depth }) => [node.task_id, depth])).toEqual([
      ['root', 0], ['child', 1], ['grandchild', 2], ['cycle-back', 3],
    ]);
  });

  it('removes an unchecked branch, restores ancestors, and reports partial state', () => {
    const tree = buildCloneTree([
      N('root', null), N('branch', 'root'), N('leaf-a', 'branch'), N('leaf-b', 'branch'),
    ], 'root');
    let selected = updateCloneSelection(tree, defaultCloneSelection(tree), 'branch', false);
    expect(Array.from(selected)).toEqual(['root']);
    selected = updateCloneSelection(tree, selected, 'leaf-a', true);

    expect(selected).toEqual(new Set(['root', 'branch', 'leaf-a']));
    expect(getCloneCheckboxState(tree, selected, 'branch')).toEqual({ checked: true, indeterminate: true });
    selected = updateCloneSelection(tree, selected, 'root', false);
    expect(selected.has('root')).toBe(false);
    expect(getSelectedCloneRootIds(tree, selected)).toEqual(['branch']);
    expect(createCloneSelectionInput(tree, selected, 2, { withoutParent: true })).toEqual({
      source_task_id: 'root', selected_descendant_ids: ['branch', 'leaf-a'], quantity: 2, clone_without_parent: true,
    });
  });

  it('builds exact payload and 3-parent/9-child/12-task preview', () => {
    const tree = buildCloneTree([
      N('root', null), ...Array.from({ length: 6 }, (_, index) => N(`child-${index + 1}`, 'root')),
    ], 'root');
    const selected = new Set(['root', 'child-1', 'child-3', 'child-6']);

    expect(createCloneSelectionInput(tree, selected, 3)).toEqual({
      source_task_id: 'root', selected_descendant_ids: ['child-1', 'child-3', 'child-6'], quantity: 3,
    });
    expect(getClonePreview(selected.size, 3)).toEqual({ parentCount: 3, childCount: 9, totalCount: 12 });
  });

  it.each([['', null], ['0', null], ['-1', null], ['1.5', null], ['NaN', null],
    [String(Number.MAX_SAFE_INTEGER + 1), null], ['1', 1]])('validates quantity %p', (value, expected) => {
    expect(parseCloneQuantity(value)).toBe(expected);
  });
});
