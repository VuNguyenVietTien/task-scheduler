import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TaskCloneDialog, type TaskCloneDialogProps } from '../TaskCloneDialog';
import type { CloneTreeNode } from '@/utils/cloneTask';

jest.mock('@/components/ui/Dialog', () => ({
  Dialog: ({ open, title, children }: { open: boolean; title: string; children: React.ReactNode }) =>
    open ? <div role="dialog" aria-label={title}>{children}</div> : null,
}));

const nodes: CloneTreeNode[] = [
  { task_id: 'root', parent_task_id: null, title: 'Root task' },
  { task_id: 'branch', parent_task_id: 'root', title: 'Branch task' },
  { task_id: 'leaf-a', parent_task_id: 'branch', title: 'Leaf A' },
  { task_id: 'leaf-b', parent_task_id: 'branch', title: 'Leaf B' },
];

function renderDialog(overrides: Partial<TaskCloneDialogProps> = {}) {
  const props: TaskCloneDialogProps = {
    open: true,
    nodes,
    sourceTaskId: 'root',
    onClose: jest.fn(),
    onSubmit: jest.fn(),
    ...overrides,
  };
  return { ...render(<TaskCloneDialog {...props} />), props };
}

describe('TaskCloneDialog', () => {
  it('shows an accessible nested tree with required root, all descendants selected, and quantity 1', () => {
    const { props } = renderDialog();

    expect(screen.getByRole('dialog', { name: 'Clone task' })).toBeInTheDocument();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(4);
    checkboxes.forEach((checkbox) => expect(checkbox).toBeChecked());
    expect(screen.getByRole('checkbox', { name: /Root task/ })).toBeEnabled();
    expect(screen.getByText('Uncheck to clone selected children elsewhere.')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Number of copies' })).toHaveValue(1);
    expect(screen.getByText('1 parent + 3 children = 4 tasks')).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Create 1 copy (4 tasks)' });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(props.onSubmit).toHaveBeenCalledWith({
      source_task_id: 'root',
      selected_descendant_ids: ['branch', 'leaf-a', 'leaf-b'],
      quantity: 1,
    });
  });

  it('unchecks a branch recursively, then checking a grandchild restores ancestors and partial state', () => {
    renderDialog();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Branch task' }));
    expect(screen.getByRole('checkbox', { name: 'Branch task' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Leaf A' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Leaf B' })).not.toBeChecked();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Leaf A' }));
    expect(screen.getByRole('checkbox', { name: /Root task/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Branch task' })).toBePartiallyChecked();
    expect(screen.getByText('1 parent + 2 children = 3 tasks')).toBeInTheDocument();
  });

  it.each(['', '0', '-1', '1.5', String(Number.MAX_SAFE_INTEGER + 1)])(
    'blocks invalid quantity %p with the exact validation message',
    (value) => {
      renderDialog();
      fireEvent.change(screen.getByRole('spinbutton', { name: 'Number of copies' }), { target: { value } });

      expect(screen.getByText('Enter a whole number greater than 0.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create copies' })).toBeDisabled();
    }
  );

  it('submits only source ID, selected descendant IDs, and quantity with the exact 3/9/12 preview', () => {
    const sixChildren: CloneTreeNode[] = [
      { task_id: 'root', parent_task_id: null, title: 'Root task' },
      ...Array.from({ length: 6 }, (_, index) => ({
        task_id: `child-${index + 1}`,
        parent_task_id: 'root',
        title: `Child ${index + 1}`,
      })),
    ];
    const onSubmit = jest.fn();
    renderDialog({ nodes: sixChildren, onSubmit });

    for (const number of [2, 4, 5]) {
      fireEvent.click(screen.getByRole('checkbox', { name: `Child ${number}` }));
    }
    const quantity = screen.getByRole('spinbutton', { name: 'Number of copies' });
    fireEvent.change(quantity, { target: { value: '3' } });

    expect(screen.getByText('3 parents + 9 children = 12 tasks')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create 3 copies (12 tasks)' }));
    expect(onSubmit).toHaveBeenCalledWith({
      source_task_id: 'root',
      selected_descendant_ids: ['child-1', 'child-3', 'child-6'],
      quantity: 3,
    });
  });

  it('offers exclusive parent/root destinations when the source is unchecked', async () => {
    const onSubmit = jest.fn();
    renderDialog({
      onSubmit,
      nodes: [
        ...nodes.map((node) => ({ ...node, project_id: 'project-1' })),
        { task_id: 'target', project_id: 'project-1', parent_task_id: null, title: 'Target parent' },
        { task_id: 'other-project', project_id: 'project-2', parent_task_id: null, title: 'Wrong project' },
      ],
    });

    fireEvent.click(screen.getByRole('checkbox', { name: /Root task/ }));
    expect(screen.getByRole('group', { name: 'Destination' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Target parent' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Branch task' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Wrong project' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Destination parent' }), { target: { value: 'target' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create 1 copy (3 tasks)' }));
    await waitFor(() => expect(onSubmit).toHaveBeenLastCalledWith({
      source_task_id: 'root',
      selected_descendant_ids: ['branch', 'leaf-a', 'leaf-b'],
      quantity: 1,
      destination_parent_task_id: 'target',
    }));

    fireEvent.click(screen.getByRole('radio', { name: 'Clone without parent' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create 1 copy (3 tasks)' }));
    expect(onSubmit).toHaveBeenLastCalledWith({
      source_task_id: 'root',
      selected_descendant_ids: ['branch', 'leaf-a', 'leaf-b'],
      quantity: 1,
      clone_without_parent: true,
    });
  });

  it('allows parent-only clone', () => {
    const onSubmit = jest.fn();
    renderDialog({ onSubmit });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Branch task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create 1 copy (1 task)' }));
    expect(onSubmit).toHaveBeenCalledWith({
      source_task_id: 'root',
      selected_descendant_ids: [],
      quantity: 1,
    });
  });

  it('prevents duplicate confirmation while pending and preserves selection when an error is shown', () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    const onSubmit = jest.fn(() => pending);
    const view = renderDialog({ onSubmit });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Leaf B' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Number of copies' }), { target: { value: '2' } });
    const confirm = screen.getByRole('button', { name: 'Create 2 copies (6 tasks)' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    view.rerender(
      <TaskCloneDialog
        {...view.props}
        submitting
        serverError="Clone failed. Try again."
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Clone failed. Try again.');
    expect(screen.getByRole('checkbox', { name: 'Leaf B' })).not.toBeChecked();
    expect(screen.getByRole('spinbutton', { name: 'Number of copies' })).toHaveValue(2);
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    finish();
  });

  it('renders loading and unavailable-source states without enabling confirmation', () => {
    const view = renderDialog({ nodes: [], loading: true });
    expect(screen.getByRole('status')).toHaveTextContent('Loading task tree…');
    expect(screen.getByRole('button', { name: 'Create copies' })).toBeDisabled();

    view.rerender(<TaskCloneDialog {...view.props} nodes={[]} loading={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Source task is unavailable.');
    expect(screen.getByRole('button', { name: 'Create copies' })).toBeDisabled();
  });
});
