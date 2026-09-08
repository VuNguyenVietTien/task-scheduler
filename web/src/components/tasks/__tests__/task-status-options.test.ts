import fs from 'node:fs';
import path from 'node:path';
import { EDITABLE_TASK_STATUSES, TaskStatuses } from '@/types/task';
import { statusOptions } from '@/schemas/taskForm';
import { TASK_STATUS_OPTIONS } from '../NewTaskForm';
import { validateCellValue } from '../TaskExcelGrid';
import { KANBAN_COLUMNS } from '../kanban-tasks';

const source = (file: string) => fs.readFileSync(path.join(process.cwd(), 'src', file), 'utf8');

describe('task status choices', () => {
  it('keeps REJECTED historical but excludes it from every shared editor/create contract', () => {
    expect(TaskStatuses.REJECTED).toBe('REJECTED');
    expect(EDITABLE_TASK_STATUSES).not.toContain('REJECTED');
    expect(statusOptions).not.toContain('REJECTED');
    expect(TASK_STATUS_OPTIONS.map(({ value }) => value)).not.toContain('REJECTED');
    expect(validateCellValue('status', 'REJECTED').ok).toBe(false);

    [
      'components/tasks/TaskListView.tsx',
      'components/tasks/TaskDetail.tsx',
      'components/tasks/TaskDetailPage.tsx',
      'components/tasks/details/TaskDetailsPanel.tsx',
      'components/tasks/tabs/DetailsTab.tsx',
      'components/tasks/TaskBulkActions.tsx',
      'components/tasks/TaskForm.tsx',
    ].forEach((file) => expect(source(file)).toContain('EDITABLE_TASK_STATUSES'));
  });

  it('retains explicit historical filters while making REJECTED Kanban read-only', () => {
    expect(KANBAN_COLUMNS.map(({ id }) => id)).toContain('REJECTED');
    expect(source('components/tasks/TaskFilterBar.tsx')).toContain('Object.values(TaskStatuses)');
    expect(source('components/tasks/TaskFilterModal.tsx')).toContain('Object.values(TaskStatuses)');
    expect(source('components/timeline/gantt-filter-bar.tsx')).toContain('Object.values(TaskStatuses)');
    expect(source('components/tasks/KanbanBoard.tsx')).toContain('isDropDisabled={column.id === TaskStatuses.REJECTED}');
  });
});
