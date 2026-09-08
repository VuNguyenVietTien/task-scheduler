import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { TaskFilterModal } from '../TaskFilterModal';

const assignees = [
  { key: 'resource:linked', label: 'Linked member', userId: 'user-1' },
  { key: 'resource:unlinked', label: 'Name only member' },
];

function renderModal(assigneeId?: string) {
  const onApply = jest.fn();
  render(
    <TaskFilterModal
      isOpen
      onClose={jest.fn()}
      filter={assigneeId ? { assigneeId } : {}}
      onApply={onApply}
      assignees={assignees}
      projects={[]}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Tab người thực hiện' }));
  return onApply;
}

describe('TaskFilterModal canonical member options', () => {
  beforeEach(() => localStorage.clear());

  it('renders unlinked members and applies their stable resource key', () => {
    const onApply = renderModal();
    fireEvent.change(screen.getByRole('combobox', { name: 'Lọc theo người được giao' }), {
      target: { value: 'resource:unlinked' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng bộ lọc' }));

    expect(onApply).toHaveBeenCalledWith({ assigneeId: 'resource:unlinked' });
    expect(screen.getByRole('option', { name: 'Name only member' })).toBeInTheDocument();
  });

  it('shows a legacy user-id filter through its canonical option', () => {
    renderModal('user-1');
    expect(screen.getByRole('combobox', { name: 'Lọc theo người được giao' })).toHaveValue('resource:linked');
  });
});
