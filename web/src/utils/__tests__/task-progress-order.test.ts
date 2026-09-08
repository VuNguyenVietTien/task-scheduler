import type { Task } from '@/types/task';
import { orderFlatTaskChildrenByProgress, orderNestedTaskChildrenByProgress } from '../task-progress-order';

const task = (task_id: string, parent_task_id: string | null, priority_order: number, progressCatalogItemId?: string): Task => ({
  task_id, parent_task_id, priority_order, progressCatalogItemId,
} as Task);

const order = new Map([['review', 0], ['design', 1]]);

describe('task progress display grouping', () => {
  it('groups nested children at every depth without reordering roots and puts missing progress last', () => {
    const roots = [
      { ...task('root-b', null, 2), child_tasks: [
        { ...task('design', 'root-b', 2, 'design'), child_tasks: [
          task('nested-design', 'design', 1, 'design'),
          task('nested-review', 'design', 9, 'review'),
        ] },
        task('unset', 'root-b', 1),
        task('review', 'root-b', 8, 'review'),
      ] },
      task('root-a', null, 1, 'review'),
    ];

    const grouped = orderNestedTaskChildrenByProgress(roots, order);
    expect(grouped.map((item) => item.task_id)).toEqual(['root-b', 'root-a']);
    expect(grouped[0].child_tasks?.map((item) => item.task_id)).toEqual(['review', 'design', 'unset']);
    expect(grouped[0].child_tasks?.[1].child_tasks?.map((item) => item.task_id)).toEqual(['nested-review', 'nested-design']);
  });

  it('uses changed catalog display order and appends a new high-order child inside its own group', () => {
    const rows = [
      task('root', null, 1),
      task('review-old', 'root', 4, 'review'),
      task('design-old', 'root', 2, 'design'),
      task('design-new', 'root', 12, 'design'),
      task('unset', 'root', 3),
      task('next-root', null, 0),
    ];

    expect(orderFlatTaskChildrenByProgress(rows, order).map((item) => item.task_id)).toEqual([
      'root', 'review-old', 'design-old', 'design-new', 'unset', 'next-root',
    ]);
    const changedOrder = new Map([['design', 0], ['review', 1]]);
    expect(orderFlatTaskChildrenByProgress(rows, changedOrder).map((item) => item.task_id)).toEqual([
      'root', 'design-old', 'design-new', 'review-old', 'unset', 'next-root',
    ]);
  });
});
