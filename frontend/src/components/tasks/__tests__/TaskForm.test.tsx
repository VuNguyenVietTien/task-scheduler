import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskForm } from '../TaskForm';
import { TaskStatus, Priority } from '@/types/task';

const mockTask = {
  id: '1',
  title: 'Test Task',
  description: 'Test Description',
  status: TaskStatus.PLANNED,
  priority: Priority.MEDIUM,
  effortHours: 4,
  startDate: '2025-03-01T00:00:00Z',
  deadline: '2025-03-15T00:00:00Z',
  assignees: [
    { id: '1', name: 'John Doe', email: 'john@example.com' }
  ],
  createdBy: {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com'
  },
  createdAt: '2025-02-25T00:00:00Z',
  updatedAt: '2025-02-25T00:00:00Z'
};

const mockUsers = [
  { id: '1', name: 'John Doe', email: 'john@example.com' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
  { id: '3', name: 'Alice Johnson', email: 'alice@example.com' }
];

const mockOnSubmit = jest.fn();
const mockOnCancel = jest.fn();

describe('TaskForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders empty form correctly', () => {
    render(
      <TaskForm
        users={mockUsers}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/priority/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/effort hours/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/deadline/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/assignees/i)).toBeInTheDocument();
  });

  it('renders form with existing task data', () => {
    render(
      <TaskForm
        task={mockTask}
        users={mockUsers}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByLabelText(/title/i)).toHaveValue(mockTask.title);
    expect(screen.getByLabelText(/description/i)).toHaveValue(mockTask.description);
    expect(screen.getByLabelText(/status/i)).toHaveValue(mockTask.status);
    expect(screen.getByLabelText(/priority/i)).toHaveValue(mockTask.priority);
    expect(screen.getByLabelText(/effort hours/i)).toHaveValue(mockTask.effortHours);
    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(
      <TaskForm
        users={mockUsers}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      expect(screen.getByText(/status is required/i)).toBeInTheDocument();
      expect(screen.getByText(/priority is required/i)).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('handles form submission correctly', async () => {
    render(
      <TaskForm
        users={mockUsers}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    await userEvent.type(screen.getByLabelText(/title/i), 'New Task');
    await userEvent.type(screen.getByLabelText(/description/i), 'New Description');
    await userEvent.selectOptions(screen.getByLabelText(/status/i), TaskStatus.PLANNED);
    await userEvent.selectOptions(screen.getByLabelText(/priority/i), Priority.HIGH);
    await userEvent.type(screen.getByLabelText(/effort hours/i), '8');
    
    const startDate = screen.getByLabelText(/start date/i);
    const deadline = screen.getByLabelText(/deadline/i);
    
    fireEvent.change(startDate, { target: { value: '2025-03-01' } });
    fireEvent.change(deadline, { target: { value: '2025-03-15' } });

    await userEvent.selectOptions(screen.getByLabelText(/assignees/i), ['1', '2']);

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        title: 'New Task',
        description: 'New Description',
        status: TaskStatus.PLANNED,
        priority: Priority.HIGH,
        effortHours: 8,
        startDate: '2025-03-01T00:00:00.000Z',
        deadline: '2025-03-15T00:00:00.000Z',
        assigneeIds: ['1', '2']
      });
    });
  });

  it('handles cancellation correctly', () => {
    render(
      <TaskForm
        users={mockUsers}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('shows error message when end date is before start date', async () => {
    render(
      <TaskForm
        users={mockUsers}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const startDate = screen.getByLabelText(/start date/i);
    const deadline = screen.getByLabelText(/deadline/i);
    
    fireEvent.change(startDate, { target: { value: '2025-03-15' } });
    fireEvent.change(deadline, { target: { value: '2025-03-01' } });

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/deadline must be after start date/i)).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('validates effort hours to be positive', async () => {
    render(
      <TaskForm
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
});
