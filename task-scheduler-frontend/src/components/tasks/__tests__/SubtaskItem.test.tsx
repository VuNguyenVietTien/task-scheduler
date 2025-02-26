import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubtaskItem } from '../SubtaskItem';
import { TaskStatus, Priority } from '@/types/task';

const mockSubtask = {
  id: 'sub1',
  title: 'Test Subtask',
  description: 'Test Description',
  status: TaskStatus.IN_PROGRESS,
  priority: Priority.MEDIUM,
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
  updatedAt: '2025-02-25T00:00:00Z'
};

const mockOnClick = jest.fn();
const mockOnStatusChange = jest.fn();
const mockOnDelete = jest.fn();

describe('SubtaskItem Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders subtask details correctly', () => {
    render(
      <SubtaskItem
        subtask={mockSubtask}
        onClick={mockOnClick}
        onStatusChange={mockOnStatusChange}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText('Test Subtask')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByText('2h')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('handles click event', () => {
    render(
      <SubtaskItem
        subtask={mockSubtask}
        onClick={mockOnClick}
        onStatusChange={mockOnStatusChange}
        onDelete={mockOnDelete}
      />
    );

    fireEvent.click(screen.getByTestId('subtask-item'));
    expect(mockOnClick).toHaveBeenCalledWith(mockSubtask.id);
  });

  it('handles status change correctly', () => {
    render(
      <SubtaskItem
        subtask={mockSubtask}
        onClick={mockOnClick}
        onStatusChange={mockOnStatusChange}
        onDelete={mockOnDelete}
      />
    );

    fireEvent.click(screen.getByTestId('status-toggle'));
    expect(mockOnStatusChange).toHaveBeenCalledWith(mockSubtask.id, TaskStatus.DONE);
  });

  it('handles delete action', () => {
    render(
      <SubtaskItem
        subtask={mockSubtask}
        onClick={mockOnClick}
        onStatusChange={mockOnStatusChange}
        onDelete={mockOnDelete}
      />
    );

    fireEvent.click(screen.getByTestId('delete-button'));
    // Should show confirmation dialog
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(mockOnDelete).toHaveBeenCalledWith(mockSubtask.id);
  });

  it('cancels delete action', () => {
    render(
      <SubtaskItem
        subtask={mockSubtask}
        onClick={mockOnClick}
        onStatusChange={mockOnStatusChange}
        onDelete={mockOnDelete}
      />
    );

    fireEvent.click(screen.getByTestId('delete-button'));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(mockOnDelete).not.toHaveBeenCalled();
    expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
  });

  it('displays different styles based on status', () => {
    const { rerender } = render(
      <SubtaskItem
        subtask={mockSubtask}
        onClick={mockOnClick}
        onStatusChange={mockOnStatusChange}
        onDelete={mockOnDelete}
      />
    );

    // In progress status
    expect(screen.getByTestId('subtask-item')).toHaveClass('border-yellow-200');

    // Done status
    rerender(
      <SubtaskItem
        subtask={{ ...mockSubtask, status: TaskStatus.DONE }}
        onClick={mockOnClick}
        onStatusChange={mockOnStatusChange}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByTestId('subtask-item')).toHaveClass('border-green-200');
  });

  it('shows truncated description with tooltip', () => {
    const longDescription = 'A'.repeat(150); // Create a long description
    render(
      <SubtaskItem
        subtask={{ ...mockSubtask, description: longDescription }}
        onClick={mockOnClick}
        onStatusChange={mockOnStatusChange}
        onDelete={mockOnDelete}
      />
    );

    const description = screen.getByTestId('description');
    expect(description).toHaveAttribute('title', longDescription);
    expect(description.textContent?.length).toBeLessThan(longDescription.length);
  });
});
