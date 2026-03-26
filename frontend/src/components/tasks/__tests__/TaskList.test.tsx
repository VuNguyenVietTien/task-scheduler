import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { TaskList } from '../TaskList';
import { TaskStatus, Priority } from '@/types/task';

const mockTasks = [
  {
    id: '1',
    title: 'Implement authentication',
    description: 'Add JWT authentication to the backend',
    status: TaskStatus.IN_PROGRESS,
    priority: Priority.HIGH,
    effortHours: 8,
    startDate: '2025-02-25T09:00:00Z',
    deadline: '2025-02-26T17:00:00Z',
    assignees: [
      { id: '1', name: 'John Doe', email: 'john@example.com' }
    ],
    createdBy: {
      id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com'
    },
    createdAt: '2025-02-24T10:00:00Z',
    updatedAt: '2025-02-25T11:00:00Z'
  },
  {
    id: '2',
    title: 'Design system implementation',
    description: 'Create reusable components',
    status: TaskStatus.PLANNED,
    priority: Priority.MEDIUM,
    effortHours: 16,
    startDate: '2025-02-27T09:00:00Z',
    deadline: '2025-03-05T17:00:00Z',
    assignees: [
      { id: '3', name: 'Alice Johnson', email: 'alice@example.com' }
    ],
    createdBy: {
      id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com'
    },
    createdAt: '2025-02-24T11:00:00Z',
    updatedAt: '2025-02-24T11:00:00Z'
  }
];

const mockOnTaskClick = jest.fn();
const mockOnTaskStatusChange = jest.fn();
const mockOnFilterChange = jest.fn();
const mockOnSortChange = jest.fn();

describe('TaskList Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all tasks correctly', () => {
    render(
      <TaskList
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
        onTaskStatusChange={mockOnTaskStatusChange}
        onFilterChange={mockOnFilterChange}
        onSortChange={mockOnSortChange}
      />
    );

    expect(screen.getByText('Implement authentication')).toBeInTheDocument();
    expect(screen.getByText('Design system implementation')).toBeInTheDocument();
  });

  it('handles task click correctly', () => {
    render(
      <TaskList
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
        onTaskStatusChange={mockOnTaskStatusChange}
        onFilterChange={mockOnFilterChange}
        onSortChange={mockOnSortChange}
      />
    );

    fireEvent.click(screen.getByText('Implement authentication'));
    expect(mockOnTaskClick).toHaveBeenCalledWith('1');
  });

  it('displays task status filters', () => {
    render(
      <TaskList
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
        onTaskStatusChange={mockOnTaskStatusChange}
        onFilterChange={mockOnFilterChange}
        onSortChange={mockOnSortChange}
      />
    );

    const filterSection = screen.getByRole('group', { name: /filter by status/i });
    expect(filterSection).toBeInTheDocument();
    expect(within(filterSection).getByText('In Progress')).toBeInTheDocument();
    expect(within(filterSection).getByText('Planned')).toBeInTheDocument();
  });

  it('displays task priority filters', () => {
    render(
      <TaskList
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
        onTaskStatusChange={mockOnTaskStatusChange}
        onFilterChange={mockOnFilterChange}
        onSortChange={mockOnSortChange}
      />
    );

    const filterSection = screen.getByRole('group', { name: /filter by priority/i });
    expect(filterSection).toBeInTheDocument();
    expect(within(filterSection).getByText('High')).toBeInTheDocument();
    expect(within(filterSection).getByText('Medium')).toBeInTheDocument();
  });

  it('handles filter changes correctly', () => {
    render(
      <TaskList
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
        onTaskStatusChange={mockOnTaskStatusChange}
        onFilterChange={mockOnFilterChange}
        onSortChange={mockOnSortChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /in progress/i }));
    expect(mockOnFilterChange).toHaveBeenCalledWith({ status: TaskStatus.IN_PROGRESS });
  });

  it('handles sort changes correctly', () => {
    render(
      <TaskList
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
        onTaskStatusChange={mockOnTaskStatusChange}
        onFilterChange={mockOnFilterChange}
        onSortChange={mockOnSortChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /sort by deadline/i }));
    expect(mockOnSortChange).toHaveBeenCalledWith({ field: 'deadline', direction: 'asc' });
  });

  it('displays empty state when no tasks are provided', () => {
    render(
      <TaskList
        tasks={[]}
        onTaskClick={mockOnTaskClick}
        onTaskStatusChange={mockOnTaskStatusChange}
        onFilterChange={mockOnFilterChange}
        onSortChange={mockOnSortChange}
      />
    );

    expect(screen.getByText(/no tasks found/i)).toBeInTheDocument();
  });

  it('shows loading state when loading prop is true', () => {
    render(
      <TaskList
        tasks={mockTasks}
        loading={true}
        onTaskClick={mockOnTaskClick}
        onTaskStatusChange={mockOnTaskStatusChange}
        onFilterChange={mockOnFilterChange}
        onSortChange={mockOnSortChange}
      />
    );

    expect(screen.getByTestId('task-list-loading')).toBeInTheDocument();
  });

  it('groups tasks by status when groupByStatus is true', () => {
    render(
      <TaskList
        tasks={mockTasks}
        groupByStatus={true}
        onTaskClick={mockOnTaskClick}
        onTaskStatusChange={mockOnTaskStatusChange}
        onFilterChange={mockOnFilterChange}
        onSortChange={mockOnSortChange}
      />
    );

    expect(screen.getByRole('region', { name: /in progress/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /planned/i })).toBeInTheDocument();
  });
});
