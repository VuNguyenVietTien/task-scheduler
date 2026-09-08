import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { TaskExcelGrid } from '../TaskExcelGrid';
import type { Task } from '@/types/task';

const task = {
  task_id: 't1', project_id: 'p1', title: 'Task', status: 'TODO', priority: 'MEDIUM',
  priority_order: 1, created_by: 'owner', effort: 1,
} as Task;

function stageEdit() {
  fireEvent.mouseDown(screen.getByTestId('excel-cell-0-3'));
  fireEvent.change(screen.getByTestId('excel-typing-input'), { target: { value: '4' } });
  fireEvent.keyDown(screen.getByTestId('excel-typing-input'), { key: 'Enter' });
}

describe('TaskExcelGrid dirty leave guard', () => {
  it('keeps scroll/focus through staging and installs only dirty navigation guards', () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const view = render(<TaskExcelGrid tasks={[task]} onSaveEdit={jest.fn()} />);
    const grid = screen.getByTestId('task-excel-grid');
    Object.defineProperty(grid, 'scrollTop', { configurable: true, writable: true, value: 120 });
    fireEvent.scroll(grid);

    stageEdit();
    expect(grid.scrollTop).toBe(120);
    expect(document.activeElement).toBe(screen.getByTestId('excel-typing-input'));

    const link = document.body.appendChild(document.createElement('a'));
    link.href = '/projects/p1?tab=gantt';
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(confirm).toHaveBeenCalled();
    expect(click.defaultPrevented).toBe(true);

    const beforeUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);

    view.unmount();
    const afterUnmount = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(afterUnmount);
    expect(afterUnmount.defaultPrevented).toBe(false);
    link.remove();
    confirm.mockRestore();
  });
});
