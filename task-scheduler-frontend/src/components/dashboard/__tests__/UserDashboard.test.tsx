import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserDashboard } from '../UserDashboard';
import { TaskStatus, Priority } from '@/types/task';

const mockTasks = [
  {
    id: '1',
    title: 'Urgent Task',
    description: 'High priority task',
    status: TaskStatus.IN_PROGRESS,
    priority: Priority.HIGH,
    effortHours: 4,
    startDate: '2025-03-01T00:00:00Z',
    deadline: '2025-03-02T00:00:00Z',
    assignees: [{ id: '1', name: 'John Doe', email: 'john@example.com' }],
    createdBy: { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
    createdAt: '2025-02-25T00:00:00Z',
    updatedAt: '2025-02-25T00:00:00Z'
  },
  {
    id: '2',
    title: 'Completed Task',
    description: 'Already done',
    status: TaskStatus.DONE,
    priority: Priority.MEDIUM,
    effortHours: 2,
    startDate: '2025-02-20T00:00:00Z',
    deadline: '2025-02-25T00:00:00Z',
    assignees: [{ id: '1', name: 'John Doe', email: 'john@example.com' }],
    createdBy: { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
    createdAt: '2025-02-20T00:00:00Z',
    updatedAt: '2025-02-25T00:00:00Z'
  }
];

const mockStats = {
  totalTasks: 10,
  completedTasks: 4,
  urgentTasks: 2,
  upcomingDeadlines: 3,
  averageCompletionTime: 2.5, // days
  tasksByStatus: {
    [TaskStatus.PLANNED]: 3,
    [TaskStatus.IN_PROGRESS]: 3,
    [TaskStatus.DONE]: 4
  }
};

const mockOnTaskClick = jest.fn();
const mockOnFilter = jest.fn();

describe('UserDashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dashboard with stats overview', () => {
    render(
      <UserDashboard
        tasks={mockTasks}
        stats={mockStats}
        onTaskClick={mockOnTaskClick}
        onFilter={mockOnFilter}
      />
    );

    expect(screen.getByText(/total tasks/i)).toHaveTextContent('10');
    expect(screen.getByText(/completed/i)).toHaveTextContent('4');
    expect(screen.getByText(/urgent/i)).toHaveTextContent('2');
    expect(screen.getByText(/upcoming deadlines/i)).toHaveTextContent('3');
  });

  it('displays task completion progress', () => {
    render(
      <UserDashboard
        tasks={mockTasks}
        stats={mockStats}
        onTaskClick={mockOnTaskClick}
        onFilter={mockOnFilter}
      />
    );

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '40'); // 4/10 * 100
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
  });

  it('renders recent tasks section', () => {
    render(
      <UserDashboard
        tasks={mockTasks}
        stats={mockStats}
        onTaskClick={mockOnTaskClick}
        onFilter={mockOnFilter}
      />
    );

    expect(screen.getByText('Urgent Task')).toBeInTheDocument();
    expect(screen.getByText('Completed Task')).toBeInTheDocument();
  });

  it('handles task click', () => {
    render(
      <UserDashboard
        tasks={mockTasks}
        stats={mockStats}
        onTaskClick={mockOnTaskClick}
        onFilter={mockOnFilter}
      />
    );

    fireEvent.click(screen.getByText('Urgent Task'));
    expect(mockOnTaskClick).toHaveBeenCalledWith('1');
  });

  it('filters tasks by status', () => {
    render(
      <UserDashboard
        tasks={mockTasks}
        stats={mockStats}
        onTaskClick={mockOnTaskClick}
        onFilter={mockOnFilter}
      />
    );

    fireEvent.click(screen.getByText(/in progress/i));
    expect(mockOnFilter).toHaveBeenCalledWith({ status: TaskStatus.IN_PROGRESS });
  });

  it('displays task status distribution chart', () => {
    render(
      <UserDashboard
        tasks={mockTasks}
        stats={mockStats}
        onTaskClick={mockOnTaskClick}
        onFilter={mockOnFilter}
      />
    );

    expect(screen.getByTestId('status-chart')).toBeInTheDocument();
    expect(screen.getByText('Task Distribution')).toBeInTheDocument();
  });

  it('shows average completion time', () => {
    render(
      <UserDashboard
        tasks={mockTasks}
        stats={mockStats}
        onTaskClick={mockOnTaskClick}
        onFilter={mockOnFilter}
      />
    );

    expect(screen.getByText(/2\.5 days/)).toBeInTheDocument();
  });

  it('displays upcoming deadlines section', () => {
    render(
      <UserDashboard
        tasks={mockTasks}
        stats={mockStats}
        onTaskClick={mockOnTaskClick}
        onFilter={mockOnFilter}
      />
    );

    expect(screen.getByText(/upcoming deadlines/i)).toBeInTheDocument();
    expect(screen.getByTestId('deadlines-list')).toBeInTheDocument();
  });

  it('handles empty task list', () => {
    render(
      <UserDashboard
        tasks={[]}
        stats={{ ...mockStats, totalTasks: 0, completedTasks: 0 }}
        onTaskClick={mockOnTaskClick}
        onFilter={mockOnFilter}
      />
    );

    expect(screen.getByText(/no tasks/i)).toBeInTheDocument();
  });
});
