import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubtaskForm } from '../SubtaskForm';
import { TaskStatus, Priority } from '@/types/task';

const mockUsers = [
  { id: '1', name: 'John Doe', email: 'john@example.com' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com' }
];

const mockSubtask = {
  id: 'sub1',
  title: 'Test Subtask',
  description: 'Test Description',
  status: TaskStatus.PLANNED,
  priority: Priority.MEDIUM,
  effortHours: 2,
  startDate: '2025-03-01T00:00:00Z',
  deadline: '2025-03-02T00:00:00Z',
  assignees: [mockUsers[0]],
  createdBy: mockUsers[1],
  createdAt: '2025-02-25T00:00:00Z',
  updatedAt: '2025-02-25T00:00:00Z'
};

const mockOnSubmit = jest.fn();
const mockOnCancel = jest.fn();

describe('SubtaskForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders empty form correctly', () => {
    render(
      <SubtaskForm
        users={mockUsers}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/effort hours/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/assignees/i)).toBeInTheDocument();
  });

  it('renders form with existing subtask data', () => {
    render(
      <SubtaskForm
        subtask={mockSubtask}
        users={mockUsers}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByLabelText(/title/i)).toHaveValue(mockSubtask.title);
    expect(screen.getByLabelText(/description/i)).toHaveValue(mockSubtask.description);
    expect(screen.getByLabelText(/effort hours/i)).toHaveValue(mockSubtask.effortHours);
    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(
      <SubtaskForm
        users={mockUsers}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('handles form submission correctly', async () => {
    render(
      <SubtaskForm
        users={mockUsers}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    await userEvent.type(screen.getByLabelText(/title/i), 'New Subtask');
    await userEvent.type(screen.getByLabelText(/description/i), 'New Description');
    await userEvent.type(screen.getByLabelText(/effort hours/i), '3');
    await userEvent.selectOptions(screen.getByLabelText(/assignees/i), ['1']);

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        title: 'New Subtask',
        description: 'New Description',
        effortHours: 3,
        assigneeIds: ['1'],
        status: TaskStatus.PLANNED
      });
    });
  });

  it('handles cancellation correctly', () => {
    render(
      <SubtaskForm
        users={mockUsers}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('validates effort hours to be positive', async () => {
    render(
      <SubtaskForm
        users={mockUsers}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    await userEvent.type(screen.getByLabelText(/effort hours/i), '-1');
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/effort hours must be positive/i)).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('shows submitting state when isSubmitting is true', () => {
    render(
      <SubtaskForm
        users={mockUsers}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isSubmitting={true}
      />
    );

    expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
  });
});
