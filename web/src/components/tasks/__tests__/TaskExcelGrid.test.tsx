/**
 * Requirement 7 — Excel mode staged bulk editing: drag cell selection,
 * Enter-fill with validation, TSV paste, explicit Save that keeps failed
 * rows staged (nothing lost), clone callback wiring.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/** jsdom has no ClipboardEvent ctor with clipboardData — build one manually. */
function pasteEvent(text: string) {
  const ev = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'clipboardData', { value: { getData: () => text } });
  return ev;
}

function copyEvent(setData: jest.Mock) {
  const ev = new Event('copy', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'clipboardData', { value: { setData } });
  return ev;
}
import '@testing-library/jest-dom';
import { TaskExcelGrid, validateCellValue, parseTsv, taskEffortRollups } from '../TaskExcelGrid';
import type { Task } from '@/types/task';

const task = (id: string, title: string, effort?: number): Task =>
  ({
    task_id: id,
    id,
    project_id: 'p1',
    title,
    status: 'TODO',
    priority: 'MEDIUM',
    priority_order: 1,
    effort,
  }) as Task;

const tasks = [task('t1', 'Alpha', 8), task('t2', 'Beta', 4)];
const catalogOptions = {
  progressType: [{ key: 'progress-create', label: 'Creation' }],
  category: [{ key: 'category-ui', label: 'UI' }],
  taskType: [{ key: 'type-feature', label: 'Feature' }],
};

describe('validateCellValue', () => {
  it('accepts numeric effort with optional h suffix and a complete clear', () => {
    expect(validateCellValue('effort', '10h')).toEqual({ ok: true, value: '10' });
    expect(validateCellValue('effort', '2.5')).toEqual({ ok: true, value: '2.5' });
    expect(validateCellValue('effort', '')).toEqual({ ok: true, value: '' });
  });
  it('rejects invalid effort/status/priority/date', () => {
    expect(validateCellValue('effort', 'abc').ok).toBe(false);
    expect(validateCellValue('effort', '-1').ok).toBe(false);
    expect(validateCellValue('status', 'WIP').ok).toBe(false);
    expect(validateCellValue('status', 'CANCELLED').ok).toBe(false);
    expect(validateCellValue('priority', 'TOP').ok).toBe(false);
    expect(validateCellValue('due_date', '07/09/2026').ok).toBe(false);
  });
  it('accepts valid enums normalized to upper case', () => {
    expect(validateCellValue('status', 'doing')).toEqual({ ok: true, value: 'DOING' });
    expect(validateCellValue('priority', 'high')).toEqual({ ok: true, value: 'HIGH' });
  });
});

describe('parseTsv', () => {
  it('splits rows and tab-separated columns, tolerating trailing newline', () => {
    expect(parseTsv('a\tb\nc\td\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('taskEffortRollups', () => {
  it('sums descendant leaves once and ignores nested parent effort', () => {
    const leafA = task('leaf-a', 'Leaf A', 3);
    const leafB = task('leaf-b', 'Leaf B', 4);
    const branch = { ...task('branch', 'Branch', 50), child_tasks: [leafA] };
    const root = { ...task('root', 'Root', 100), child_tasks: [branch, leafB] };

    expect(Object.fromEntries(taskEffortRollups([root]))).toEqual({ branch: 3, root: 7 });
  });
});

function renderGrid(onSaveEdit = jest.fn(), onCloneTask = jest.fn()) {
  return {
    onSaveEdit,
    onCloneTask,
    ...render(
      <TaskExcelGrid tasks={tasks} onSaveEdit={onSaveEdit} onCloneTask={onCloneTask} catalogOptions={catalogOptions} />
    ),
  };
}

describe('TaskExcelGrid interactions', () => {
  it('renders staged-value cells after Enter fill over a selection', () => {
    renderGrid();
    // anchor (0,3)=effort of t1, extend to (1,3)
    fireEvent.mouseDown(screen.getByTestId('excel-cell-0-3'));
    fireEvent.mouseOver(screen.getByTestId('excel-cell-1-3'));
    const input = screen.getByTestId('excel-typing-input');
    fireEvent.change(input, { target: { value: '6h' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByTestId('excel-cell-0-3').textContent).toBe('6');
    expect(screen.getByTestId('excel-cell-1-3').textContent).toBe('6');
    expect(screen.getByTestId('excel-dirty-count').textContent).toBe('2 unsaved');
  });

  it('Enter fill rejects invalid enum and accepts project catalog labels', () => {
    renderGrid();
    fireEvent.mouseDown(screen.getByTestId('excel-cell-0-1')); // status col
    fireEvent.change(screen.getByTestId('excel-typing-input'), { target: { value: 'WIP' } });
    fireEvent.keyDown(screen.getByTestId('excel-typing-input'), { key: 'Enter' });

    expect(screen.getByTestId('excel-errors')).toBeInTheDocument();
    expect(screen.queryByTestId('excel-dirty-count')).not.toBeInTheDocument();
    expect(screen.getByTestId('excel-cell-0-1').textContent).toBe('TODO');

    fireEvent.mouseDown(screen.getByTestId('excel-cell-0-6'));
    fireEvent.change(screen.getByTestId('excel-typing-input'), { target: { value: 'Creation' } });
    fireEvent.keyDown(screen.getByTestId('excel-typing-input'), { key: 'Enter' });
    expect(screen.getByTestId('excel-cell-0-6')).toHaveTextContent('Creation');
    expect(screen.getByTestId('excel-dirty-count')).toHaveTextContent('1 unsaved');
  });

  it('click restores the real keyboard target; Tab commits and advances; Escape discards typing', async () => {
    const user = userEvent.setup();
    renderGrid();
    const outside = document.body.appendChild(document.createElement('button'));
    outside.focus();

    await user.click(screen.getByTestId('excel-cell-0-0'));
    expect(document.activeElement).toBe(screen.getByTestId('excel-typing-input'));
    await user.keyboard('Renamed{Tab}doing{Enter}draft{Escape}{Enter}');

    expect(screen.getByTestId('excel-cell-0-0')).toHaveTextContent('Renamed');
    expect(screen.getByTestId('excel-cell-0-1')).toHaveTextContent('DOING');
    expect(screen.getByTestId('excel-dirty-count')).toHaveTextContent('2 unsaved');
    outside.remove();
  });

  it('single-click only selects; double-click opens native number and date editors without saving', async () => {
    const user = userEvent.setup();
    const onSaveEdit = jest.fn().mockResolvedValue(undefined);
    renderGrid(onSaveEdit);

    await user.click(screen.getByTestId('excel-cell-0-3'));
    expect(screen.queryByRole('spinbutton', { name: 'Excel effort' })).not.toBeInTheDocument();
    await user.dblClick(screen.getByTestId('excel-cell-0-3'));
    const effort = screen.getByRole('spinbutton', { name: 'Excel effort' });
    fireEvent.change(effort, { target: { value: '6.5' } });
    expect(onSaveEdit).not.toHaveBeenCalled();

    await user.dblClick(screen.getByTestId('excel-cell-0-4'));
    fireEvent.change(screen.getByLabelText('Excel due date'), { target: { value: '2026-09-09' } });
    expect(screen.getByTestId('excel-dirty-count')).toHaveTextContent('2 unsaved');
    expect(onSaveEdit).not.toHaveBeenCalled();
  });

  it('clears effort and commits before arrow/Enter navigation instead of incrementing the number', async () => {
    const user = userEvent.setup();
    const onSaveEdit = jest.fn().mockResolvedValue(undefined);
    renderGrid(onSaveEdit);

    await user.dblClick(screen.getByTestId('excel-cell-0-3'));
    const firstEffort = screen.getByRole('spinbutton', { name: 'Excel effort' });
    fireEvent.change(firstEffort, { target: { value: '' } });
    fireEvent.keyDown(firstEffort, { key: 'ArrowDown' });
    const secondEffort = screen.getByRole('spinbutton', { name: 'Excel effort' });
    expect(secondEffort).toHaveValue(4);
    fireEvent.change(secondEffort, { target: { value: '7' } });
    fireEvent.keyDown(secondEffort, { key: 'ArrowRight' });
    expect(screen.getByLabelText('Excel due date')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByLabelText('Excel due date'), { key: 'Enter' });

    fireEvent.click(screen.getByTestId('excel-save-btn'));
    await waitFor(() => expect(onSaveEdit).toHaveBeenCalledWith({ taskId: 't1', field: 'effort', value: '' }));
    expect(onSaveEdit).toHaveBeenCalledWith({ taskId: 't2', field: 'effort', value: '7' });
  });

  it('double-click catalog selector stages its stable ID and supports clearing', async () => {
    const user = userEvent.setup();
    const onSaveEdit = jest.fn().mockResolvedValue(undefined);
    render(<TaskExcelGrid tasks={[tasks[0], { ...tasks[1], progressCatalogItemId: 'progress-create' }]} onSaveEdit={onSaveEdit} catalogOptions={catalogOptions} catalogValue={(task) => task.progressCatalogItemId ?? ''} />);

    await user.click(screen.getByTestId('excel-cell-0-6'));
    expect(screen.queryByRole('combobox', { name: 'Excel Progress type' })).not.toBeInTheDocument();
    await user.dblClick(screen.getByTestId('excel-cell-0-6'));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Excel Progress type' }), 'progress-create');
    await user.dblClick(screen.getByTestId('excel-cell-1-6'));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Excel Progress type' }), '');
    expect(screen.getByTestId('excel-dirty-count')).toHaveTextContent('2 unsaved');
    fireEvent.click(screen.getByTestId('excel-save-btn'));
    await waitFor(() => expect(onSaveEdit).toHaveBeenCalledWith({ taskId: 't1', field: 'progressType', value: 'progress-create' }));
    expect(onSaveEdit).toHaveBeenCalledWith({ taskId: 't2', field: 'progressType', value: '' });
  });

  it('double-click status and priority dropdowns stage validated values until Save', async () => {
    const user = userEvent.setup();
    const onSaveEdit = jest.fn().mockResolvedValue(undefined);
    renderGrid(onSaveEdit);

    await user.click(screen.getByTestId('excel-cell-0-1'));
    expect(screen.queryByRole('combobox', { name: 'Excel Status' })).not.toBeInTheDocument();
    await user.dblClick(screen.getByTestId('excel-cell-0-1'));
    const status = screen.getByRole('combobox', { name: 'Excel Status' });
    expect(status).not.toHaveTextContent('REJECTED');
    await user.selectOptions(status, 'DOING');
    await user.dblClick(screen.getByTestId('excel-cell-0-2'));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Excel Priority' }), 'HIGH');

    expect(screen.getByTestId('excel-dirty-count')).toHaveTextContent('2 unsaved');
    expect(onSaveEdit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('excel-save-btn'));
    await waitFor(() => expect(onSaveEdit).toHaveBeenCalledWith({ taskId: 't1', field: 'status', value: 'DOING' }));
    expect(onSaveEdit).toHaveBeenCalledWith({ taskId: 't1', field: 'priority', value: 'HIGH' });
  });

  it('double-click Assignee opens canonical member choices and stages the selected unlinked member', async () => {
    const user = userEvent.setup();
    const onSaveEdit = jest.fn().mockResolvedValue(undefined);
    render(<TaskExcelGrid
      tasks={tasks}
      onSaveEdit={onSaveEdit}
      assigneeOptions={[{ key: 'resource:linked', label: 'Linked Member' }, { key: 'resource:unlinked', label: 'Unlinked Member' }]}
    />);

    await user.dblClick(screen.getByTestId('excel-cell-0-5'));
    const assignee = screen.getByRole('combobox', { name: 'Excel assignee' });
    expect(assignee).toHaveTextContent('Linked Member');
    expect(assignee).toHaveTextContent('Unlinked Member');
    await user.selectOptions(assignee, 'resource:unlinked');
    expect(screen.getByTestId('excel-cell-0-5')).toHaveTextContent('Unlinked Member');
    fireEvent.click(screen.getByTestId('excel-save-btn'));
    await waitFor(() => expect(onSaveEdit).toHaveBeenCalledWith({ taskId: 't1', field: 'assignee', value: 'resource:unlinked' }));
  });

  it('copies a rectangular multi-cell selection as row-major CRLF TSV', () => {
    renderGrid();
    fireEvent.mouseDown(screen.getByTestId('excel-cell-0-0'));
    fireEvent.mouseOver(screen.getByTestId('excel-cell-1-2'));
    const setData = jest.fn();
    fireEvent(screen.getByTestId('excel-typing-input'), copyEvent(setData));
    expect(setData).toHaveBeenCalledWith('text/plain', 'Alpha\tTODO\tMEDIUM\r\nBeta\tTODO\tMEDIUM');
  });

  it('broadcasts a single clipboard cell across the selected rectangle', () => {
    renderGrid();
    fireEvent.mouseDown(screen.getByTestId('excel-cell-0-1'));
    fireEvent.mouseOver(screen.getByTestId('excel-cell-1-1'));
    fireEvent(screen.getByTestId('excel-typing-input'), pasteEvent('doing'));

    expect(screen.getByTestId('excel-cell-0-1')).toHaveTextContent('DOING');
    expect(screen.getByTestId('excel-cell-1-1')).toHaveTextContent('DOING');
    expect(screen.getByTestId('excel-dirty-count')).toHaveTextContent('2 unsaved');
  });

  it('reports read-only paste targets without staging or corrupting them', () => {
    renderGrid();
    fireEvent.mouseDown(screen.getByTestId('excel-cell-0-14'));
    fireEvent(screen.getByTestId('excel-typing-input'), pasteEvent('changed'));

    expect(screen.getByTestId('excel-errors')).toHaveTextContent('Created is read-only');
    expect(screen.queryByTestId('excel-dirty-count')).not.toBeInTheDocument();
  });

  it('TSV paste stages a block anchored at the selected cell, clipping overflow', () => {
    renderGrid();
    fireEvent.mouseDown(screen.getByTestId('excel-cell-0-1')); // status col anchor
    fireEvent(screen.getByTestId('excel-typing-input'), pasteEvent('DOING\tHIGH\nREVIEW\t8h'));

    expect(screen.getByTestId('excel-cell-0-1').textContent).toBe('DOING');
    expect(screen.getByTestId('excel-cell-1-1').textContent).toBe('REVIEW');
    expect(screen.getByTestId('excel-cell-0-2').textContent).toBe('HIGH');
    // 3 valid cells staged (priority cell of row 2 rejects "8h")
    expect(screen.getByTestId('excel-dirty-count').textContent).toBe('3 unsaved');
  });

  it('TSV paste maps a 2x3 rectangle from the selected anchor', () => {
    renderGrid();
    fireEvent.mouseDown(screen.getByTestId('excel-cell-0-0'));
    fireEvent(screen.getByTestId('excel-typing-input'), pasteEvent('One\tDOING\tHIGH\r\nTwo\tDONE\tLOW\r\n'));

    expect(screen.getByTestId('excel-cell-0-0')).toHaveTextContent('One');
    expect(screen.getByTestId('excel-cell-0-1')).toHaveTextContent('DOING');
    expect(screen.getByTestId('excel-cell-0-2')).toHaveTextContent('HIGH');
    expect(screen.getByTestId('excel-cell-1-0')).toHaveTextContent('Two');
    expect(screen.getByTestId('excel-cell-1-1')).toHaveTextContent('DONE');
    expect(screen.getByTestId('excel-cell-1-2')).toHaveTextContent('LOW');
    expect(screen.getByTestId('excel-dirty-count')).toHaveTextContent('6 unsaved');
  });

  it('keeps every column width fixed while an editor is open', async () => {
    const user = userEvent.setup();
    renderGrid();
    const table = screen.getByRole('table');
    expect(table).toHaveStyle({ tableLayout: 'fixed' });
    const widthsBefore = Array.from(table.querySelectorAll('col')).map((col) => col.getAttribute('style'));

    await user.dblClick(screen.getByTestId('excel-cell-0-3'));
    expect(screen.getByRole('spinbutton', { name: 'Excel effort' })).toBeInTheDocument();
    expect(Array.from(table.querySelectorAll('col')).map((col) => col.getAttribute('style'))).toEqual(widthsBefore);
  });

  it('TSV paste rejects invalid cells per-cell and keeps valid ones', () => {
    renderGrid();
    fireEvent.mouseDown(screen.getByTestId('excel-cell-0-1'));
    fireEvent(screen.getByTestId('excel-typing-input'), pasteEvent('DOING\tBOGUS'));

    expect(screen.getByTestId('excel-cell-0-1').textContent).toBe('DOING');
    expect(screen.getByTestId('excel-errors')).toHaveTextContent('Invalid priority "BOGUS"');
    expect(screen.getByTestId('excel-dirty-count').textContent).toBe('1 unsaved');
  });

  it('explicit Save persists staged edits and clears them', async () => {
    const onSaveEdit = jest.fn().mockResolvedValue(undefined);
    renderGrid(onSaveEdit);
    fireEvent.mouseDown(screen.getByTestId('excel-cell-0-3'));
    fireEvent.change(screen.getByTestId('excel-typing-input'), { target: { value: '12' } });
    fireEvent.keyDown(screen.getByTestId('excel-typing-input'), { key: 'Enter' });

    fireEvent.click(screen.getByTestId('excel-save-btn'));
    await waitFor(() => {
      expect(onSaveEdit).toHaveBeenCalledWith({
        taskId: 't1',
        field: 'effort',
        value: '12',
      });
    });
    await waitFor(() => {
      expect(screen.queryByTestId('excel-dirty-count')).not.toBeInTheDocument();
    });
  });

  it('failed saves stay staged with errors (batch failure retention)', async () => {
    const onSaveEdit = jest.fn().mockRejectedValue(new Error('network down'));
    renderGrid(onSaveEdit);
    fireEvent.mouseDown(screen.getByTestId('excel-cell-0-3'));
    fireEvent.change(screen.getByTestId('excel-typing-input'), { target: { value: '12' } });
    fireEvent.keyDown(screen.getByTestId('excel-typing-input'), { key: 'Enter' });

    fireEvent.click(screen.getByTestId('excel-save-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('excel-errors')).toHaveTextContent('network down');
    });
    // unsaved state retained — user does not lose the edit
    expect(screen.getByTestId('excel-dirty-count').textContent).toBe('1 unsaved');
    expect(screen.getByTestId('excel-cell-0-3').textContent).toBe('12');
  });


  it('DEFERRED-SAVE RACE: a newer edit made while Save is in-flight is preserved (not discarded)', async () => {
    // Save never resolves until we say so → the grid is mid-save.
    let resolveSave: () => void = () => {};
    const onSaveEdit = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        })
    );
    renderGrid(onSaveEdit);

    // Stage "12" and hit Save (request goes out, unresolved).
    fireEvent.mouseDown(screen.getByTestId('excel-cell-0-3'));
    fireEvent.change(screen.getByTestId('excel-typing-input'), { target: { value: '12' } });
    fireEvent.keyDown(screen.getByTestId('excel-typing-input'), { key: 'Enter' });
    fireEvent.click(screen.getByTestId('excel-save-btn'));
    await waitFor(() => expect(onSaveEdit).toHaveBeenCalledTimes(1));

    // While in-flight, the user re-edits the SAME cell to a newer value.
    fireEvent.mouseDown(screen.getByTestId('excel-cell-0-3'));
    fireEvent.change(screen.getByTestId('excel-typing-input'), { target: { value: '16' } });
    fireEvent.keyDown(screen.getByTestId('excel-typing-input'), { key: 'Enter' });
    expect(screen.getByTestId('excel-cell-0-3').textContent).toBe('16');

    // The first request now completes: the NEWER edit must survive
    // (revision-aware cleanup deletes a key only if its staged value still
    // equals the saved value).
    resolveSave();
    await waitFor(() => {
      expect(screen.getByTestId('excel-cell-0-3').textContent).toBe('16');
    });
    expect(screen.getByTestId('excel-dirty-count').textContent).toBe('1 unsaved');
  });

  it('shows parent leaf totals as read-only and updates them from staged child effort', () => {
    const rows = [
      { ...task('root', 'Root', 99), parent_task_id: undefined },
      { ...task('branch', 'Branch', 50), parent_task_id: 'root' },
      { ...task('leaf-a', 'Leaf A', 3), parent_task_id: 'branch' },
      { ...task('leaf-b', 'Leaf B', 4), parent_task_id: 'root' },
    ];
    render(<TaskExcelGrid tasks={rows} onSaveEdit={jest.fn()} />);

    expect(screen.getByTestId('excel-cell-0-3')).toHaveTextContent('7');
    expect(screen.getByTestId('excel-cell-1-3')).toHaveTextContent('3');
    expect(screen.getByTestId('excel-cell-0-3')).toHaveAttribute('aria-readonly', 'true');
    fireEvent.doubleClick(screen.getByTestId('excel-cell-0-3'));
    expect(screen.queryByRole('spinbutton', { name: 'Excel effort' })).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('excel-cell-2-3'));
    fireEvent.change(screen.getByTestId('excel-typing-input'), { target: { value: '8' } });
    fireEvent.keyDown(screen.getByTestId('excel-typing-input'), { key: 'Enter' });
    expect(screen.getByTestId('excel-cell-1-3')).toHaveTextContent('8');
    expect(screen.getByTestId('excel-cell-0-3')).toHaveTextContent('12');
    expect(screen.getByTestId('excel-dirty-count')).toHaveTextContent('1 unsaved');
  });

  it('keeps descendant task ids and stages edits on the descendant row', async () => {
    const child = { ...task('child', 'Child'), excelDepth: 1 };
    const onSaveEdit = jest.fn().mockResolvedValue(undefined);
    render(<TaskExcelGrid tasks={[task('parent', 'Parent'), child]} onSaveEdit={onSaveEdit} />);
    expect(screen.getByTestId('excel-cell-1-0')).toHaveTextContent('↳ Child');
    expect(screen.getByTestId('excel-cell-1-0')).toHaveAttribute('data-task-id', 'child');
    fireEvent.mouseDown(screen.getByTestId('excel-cell-1-3'));
    fireEvent.change(screen.getByTestId('excel-typing-input'), { target: { value: '3' } });
    fireEvent.keyDown(screen.getByTestId('excel-typing-input'), { key: 'Enter' });
    fireEvent.click(screen.getByTestId('excel-save-btn'));
    await waitFor(() => expect(onSaveEdit).toHaveBeenCalledWith({ taskId: 'child', field: 'effort', value: '3' }));
  });

  it('projects navigation and rectangular paste over visible columns only', async () => {
    const onSaveEdit = jest.fn().mockResolvedValue(undefined);
    render(<TaskExcelGrid tasks={tasks} onSaveEdit={onSaveEdit} visibleColumns={['status', 'effort']} />);

    expect(screen.queryByText('Priority')).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('excel-cell-0-0'));
    fireEvent(screen.getByTestId('excel-typing-input'), pasteEvent('DOING\t6'));
    expect(screen.getByTestId('excel-cell-0-0')).toHaveTextContent('DOING');
    expect(screen.getByTestId('excel-cell-0-1')).toHaveTextContent('6');

    fireEvent.click(screen.getByTestId('excel-save-btn'));
    await waitFor(() => expect(onSaveEdit).toHaveBeenCalledWith({ taskId: 't1', field: 'status', value: 'DOING' }));
    expect(onSaveEdit).toHaveBeenCalledWith({ taskId: 't1', field: 'effort', value: '6' });
  });

  it('keeps staged drafts when columns toggle and saves an explicit Start date clear', async () => {
    const onSaveEdit = jest.fn().mockResolvedValue(undefined);
    const { rerender } = render(<TaskExcelGrid tasks={[{ ...tasks[0], start_date: '2026-09-09' }]} onSaveEdit={onSaveEdit} visibleColumns={['title', 'plannedStart']} />);
    fireEvent.mouseDown(screen.getByTestId('excel-cell-0-0'));
    fireEvent.change(screen.getByTestId('excel-typing-input'), { target: { value: 'Draft title' } });
    fireEvent.keyDown(screen.getByTestId('excel-typing-input'), { key: 'Enter' });

    rerender(<TaskExcelGrid tasks={[{ ...tasks[0], start_date: '2026-09-09' }]} onSaveEdit={onSaveEdit} visibleColumns={['plannedStart']} />);
    expect(screen.getByTestId('excel-dirty-count')).toHaveTextContent('1 unsaved');
    await userEvent.dblClick(screen.getByTestId('excel-cell-0-0'));
    fireEvent.change(screen.getByLabelText('Excel start date'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('excel-save-btn'));

    await waitFor(() => expect(onSaveEdit).toHaveBeenCalledWith({ taskId: 't1', field: 'start_date', value: '' }));
    expect(onSaveEdit).toHaveBeenCalledWith({ taskId: 't1', field: 'title', value: 'Draft title' });
  });

  it('offers inline subtask creation on every Excel row and renders drafts after existing descendants', () => {
    const onAddSubtask = jest.fn();
    const nestedRows = [
      { ...tasks[0], excelDepth: 0 },
      { ...task('child', 'Existing child'), parent_task_id: 't1', excelDepth: 1 },
      { ...tasks[1], excelDepth: 0 },
    ];
    render(<TaskExcelGrid
      tasks={nestedRows}
      onSaveEdit={jest.fn()}
      onAddSubtask={onAddSubtask}
      renderSubtaskRows={(parentId, colSpan) => parentId === 't1' ? <tr data-testid="excel-inline-draft"><td colSpan={colSpan}>Draft</td></tr> : null}
    />);
    fireEvent.click(screen.getByRole('button', { name: 'Add subtask to Alpha' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add subtask to Beta' }));
    expect(onAddSubtask.mock.calls).toEqual([['t1'], ['t2']]);
    expect(screen.getByTestId('excel-inline-draft').previousElementSibling).toContainElement(screen.getByTestId('excel-cell-1-0'));
  });

  it('clone button calls onCloneTask for the row', () => {
    const onCloneTask = jest.fn();
    renderGrid(jest.fn().mockResolvedValue(undefined), onCloneTask);
    fireEvent.click(screen.getByTestId('excel-clone-t1'));
    expect(onCloneTask).toHaveBeenCalledWith('t1');
  });
});
