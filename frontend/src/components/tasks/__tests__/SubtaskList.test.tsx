import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubtaskList } from '../SubtaskList';
import { TaskStatus, Priority } from '@/types/task';

const mockSubtasks = [
  {
    id: 'sub1',
    title: 'Implement API endpoint',
    description: 'Create the REST API endpoint',
    status: TaskStatus.IN_PROGRESS,
    priority: Priority.HIGH,
    effortHours: 2,
    startDate: '2025-03-01T00:00:00Z',
    deadline: '2025-03-02T00:00:00Z',
    assignees: [
      { id: '1', name: 'John Doe', email: 'john@example.com' }
    ],
    createdBy: {
      id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com'
    },
    createdAt: '2025-02-25T00:00:00Z',
    updatedAt: '2025-02-25T00:00:00Z',
  },
  {
    id: 'sub2',
    title: 'Write unit tests',
    description: 'Add comprehensive test coverage',
    status: TaskStatus.PLANNED,
    priority: Priority.MEDIUM,
    effortHours: 3,
    startDate: '2025-03-02T00:00:00Z',
    deadline: '2025-03-03T00:00:00Z',
    assignees: [
      { id: '3', name: 'Alice Johnson', email: 'alice@example.com' }
    ],
    createdBy: {
      id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com'
    },
    createdAt: '2025-02-25T00:00:00Z',
    updatedAt: '2025-02-25T00:00:00Z',
  }
];

const mockOnSubtaskClick = jest.fn();
const mockOnStatusChange = jest.fn();
const mockOnAddSubtask = jest.fn();

describe('SubtaskList Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders subtasks correctly', () => {
    render(
      <SubtaskList
        subtasks={mockSubtasks}
        onSubtaskClick={mockOnSubtaskClick}
        onStatusChange={mockOnStatusChange}
        onAddSubtask={mockOnAddSubtask}
      />
    );

    expect(screen.getByText('Implement API endpoint')).toBeInTheDocument();
    expect(screen.getByText('Write unit tests')).toBeInTheDocument();
    expect(screen.getAllByTestId('subtask-item')).toHaveLength(2);
  });

  it('handles empty subtasks list', () => {
    render(
      <SubtaskList
        subtasks={[]}
        onSubtaskClick={mockOnSubtaskClick}
        onStatusChange={mockOnStatusChange}
        onAddSubtask={mockOnAddSubtask}
      />
    );

    expect(screen.getByText(/no subtasks yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add subtask/i })).toBeInTheDocument();
  });

  it('calls onSubtaskClick when clicking a subtask', () => {
    render(
      <SubtaskList
        subtasks={mockSubtasks}
        onSubtaskClick={mockOnSubtaskClick}
        onStatusChange={mockOnStatusChange}
        onAddSubtask={mockOnAddSubtask}
      />
    );

    fireEvent.click(screen.getByText('Implement API endpoint'));
    expect(mockOnSubtaskClick).toHaveBeenCalledWith('sub1');
  });

  it('handles status change correctly', () => {
    render(
      <SubtaskList
        subtasks={mockSubtasks}
        onSubtaskClick={mockOnSubtaskClick}
        onStatusChange={mockOnStatusChange}
        onAddSubtask={mockOnAddSubtask}
      />
    );

    const subtaskItems = screen.getAllByTestId('subtask-item');
    const statusToggle = subtaskItems[0].querySelector('[data-testid="status-toggle"]');
    
    fireEvent.click(statusToggle as HTMLElement);
    expect(mockOnStatusChange).toHaveBeenCalledWith('sub1', TaskStatus.DONE);
  });

  it('displays add subtask button', () => {
    render(
      <SubtaskList
        subtasks={mockSubtasks}
        onSubtaskClick={mockOnSubtaskClick}
        onStatusChange={mockOnStatusChange}
        onAddSubtask={mockOnAddSubtask}
      />
    );

    const addButton = screen.getByRole('button', { name: /add subtask/i });
    expect(addButton).toBeInTheDocument();

    fireEvent.click(addButton);
    expect(mockOnAddSubtask).toHaveBeenCalled();
  });

  it('groups subtasks by status when groupByStatus is true', () => {
    render(
      <SubtaskList
        subtasks={mockSubtasks}
        onSubtaskClick={mockOnSubtaskClick}
        onStatusChange={mockOnStatusChange}
        onAddSubtask={mockOnAddSubtask}
        groupByStatus
      />
    );

    expect(screen.getByText(/in progress/i)).toBeInTheDocument();
    expect(screen.getByText(/planned/i)).toBeInTheDocument();
    
    const inProgressSection = screen.getByTestId('status-group-IN_PROGRESS');
    const plannedSection = screen.getByTestId('status-group-PLANNED');

    expect(inProgressSection).toContainElement(screen.getByText('Implement API endpoint'));
    expect(plannedSection).toContainElement(screen.getByText('Write unit tests'));
  });

  it('displays total effort hours', () => {
    render(
      <SubtaskList
        subtasks={mockSubtasks}
        onSubtaskClick={mockOnSubtaskClick}
        onStatusChange={mockOnStatusChange}
        onAddSubtask={mockOnAddSubtask}
        showEffortSummary
      />
    );

    expect(screen.getByText(/total effort: 5h/i)).toBeInTheDocument();
  });

  it('shows progress indicator', () => {
    const subtasksWithCompleted = [
      ...mockSubtasks,
      {
        ...mockSubtasks[0],
        id: 'sub3',
        title: 'Completed task',
        status: TaskStatus.DONE
      }
    ];

    render(
      <SubtaskList
        subtasks={subtasksWithCompleted}
        onSubtaskClick={mockOnSubtaskClick}
        onStatusChange={mockOnStatusChange}
        onAddSubtask={mockOnAddSubtask}
        showProgress
      />
    );

    expect(screen.getByText(/33% complete/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33');
  });
});
