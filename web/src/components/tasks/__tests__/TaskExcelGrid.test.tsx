/**
 * Requirement 7 — Excel mode staged bulk editing: drag cell selection,
 * Enter-fill with validation, TSV paste, explicit Save that keeps failed
 * rows staged (nothing lost), clone callback wiring.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/** jsdom has no ClipboardEvent ctor with clipboardData — build one manually. */
function pasteEvent(text: string) {
  const ev = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'clipboardData', { value: { getData: () => text } });
  return ev;
}
import '@testing-library/jest-dom';
import { TaskExcelGrid, validateCellValue, parseTsv } from '../TaskExcelGrid';
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

describe('validateCellValue', () => {
  it('accepts numeric effort with optional h suffix', () => {
    expect(validateCellValue('effort', '10h')).toEqual({ ok: true, value: '10' });
    expect(validateCellValue('effort', '2.5')).toEqual({ ok: true, value: '2.5' });
  });
  it('rejects invalid effort/status/priority/date', () => {
    expect(validateCellValue('effort', 'abc').ok).toBe(false);
    expect(validateCellValue('effort', '-1').ok).toBe(false);
    expect(validateCellValue('status', 'WIP').ok).toBe(false);
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

function renderGrid(onSaveEdit = jest.fn(), onCloneTask = jest.fn()) {
  return {
    onSaveEdit,
    onCloneTask,
    ...render(
      <TaskExcelGrid tasks={tasks} onSaveEdit={onSaveEdit} onCloneTask={onCloneTask} />
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

  it('Enter fill with invalid value reports errors and stages nothing', () => {
    renderGrid();
    fireEvent.mouseDown(screen.getByTestId('excel-cell-0-1')); // status col
    fireEvent.change(screen.getByTestId('excel-typing-input'), { target: { value: 'WIP' } });
    fireEvent.keyDown(screen.getByTestId('excel-typing-input'), { key: 'Enter' });

    expect(screen.getByTestId('excel-errors')).toBeInTheDocument();
    expect(screen.queryByTestId('excel-dirty-count')).not.toBeInTheDocument();
    expect(screen.getByTestId('excel-cell-0-1').textContent).toBe('TODO');
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

  it('clone button calls onCloneTask for the row', () => {
    const onCloneTask = jest.fn();
    renderGrid(jest.fn().mockResolvedValue(undefined), onCloneTask);
    fireEvent.click(screen.getByTestId('excel-clone-t1'));
    expect(onCloneTask).toHaveBeenCalledWith('t1');
  });
});
