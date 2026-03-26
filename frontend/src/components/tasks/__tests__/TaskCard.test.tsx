import { render, screen, fireEvent } from '@testing-library/react'
import { TaskCard } from '../TaskCard'
import { TaskStatus, Priority } from '@/types/task'

const mockTask = {
  id: '123',
  title: 'Test Task',
  description: 'Test Description',
  status: TaskStatus.IN_PROGRESS,
  priority: Priority.HIGH,
  effortHours: 4,
  startDate: '2025-03-01T00:00:00Z',
  deadline: '2025-03-15T00:00:00Z',
  assignees: [
    { id: '1', name: 'John Doe', email: 'john@example.com' },
  ],
  createdBy: {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
  },
  createdAt: '2025-02-25T00:00:00Z',
  updatedAt: '2025-02-25T00:00:00Z',
}

const mockOnClick = jest.fn()
const mockOnStatusChange = jest.fn()

describe('TaskCard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders task information correctly', () => {
    render(
      <TaskCard
        task={mockTask}
        onClick={mockOnClick}
        onStatusChange={mockOnStatusChange}
      />
    )

    // Test title and description
    expect(screen.getByText('Test Task')).toBeInTheDocument()
    expect(screen.getByText('Test Description')).toBeInTheDocument()

    // Test status and priority badges
    expect(screen.getByText('IN PROGRESS')).toBeInTheDocument()
    expect(screen.getByText('HIGH')).toBeInTheDocument()

    // Test effort hours
    expect(screen.getByText('4h')).toBeInTheDocument()

    // Test assignee
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    render(
      <TaskCard
        task={mockTask}
        onClick={mockOnClick}
        onStatusChange={mockOnStatusChange}
      />
    )

    fireEvent.click(screen.getByRole('button'))
    expect(mockOnClick).toHaveBeenCalledWith(mockTask.id)
  })

  it('calls onStatusChange when status is changed', () => {
    render(
      <TaskCard
        task={mockTask}
        onClick={mockOnClick}
        onStatusChange={mockOnStatusChange}
      />
    )

    fireEvent.click(screen.getByLabelText('Change status'))
    fireEvent.click(screen.getByText('DONE'))

    expect(mockOnStatusChange).toHaveBeenCalledWith(mockTask.id, TaskStatus.DONE)
  })

  it('shows deadline warning when close to deadline', () => {
    const taskWithCloseDeadline = {
      ...mockTask,
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    }

    render(
      <TaskCard
        task={taskWithCloseDeadline}
        onClick={mockOnClick}
        onStatusChange={mockOnStatusChange}
      />
    )

    expect(screen.getByTestId('deadline-warning')).toBeInTheDocument()
  })

  it('shows overdue status when past deadline', () => {
    const taskWithPastDeadline = {
      ...mockTask,
      deadline: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
    }

    render(
      <TaskCard
        task={taskWithPastDeadline}
        onClick={mockOnClick}
        onStatusChange={mockOnStatusChange}
      />
    )

    expect(screen.getByTestId('overdue-indicator')).toBeInTheDocument()
  })

  it('renders multiple assignees correctly', () => {
    const taskWithMultipleAssignees = {
      ...mockTask,
      assignees: [
        { id: '1', name: 'John Doe', email: 'john@example.com' },
        { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
      ],
    }

    render(
      <TaskCard
        task={taskWithMultipleAssignees}
        onClick={mockOnClick}
        onStatusChange={mockOnStatusChange}
      />
    )

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('displays effort progress correctly', () => {
    render(
      <TaskCard
        task={mockTask}
        onClick={mockOnClick}
        onStatusChange={mockOnStatusChange}
      />
    )

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toBeInTheDocument()
    expect(progressBar).toHaveAttribute('aria-valuenow', '0')
  })

  it('handles missing optional fields gracefully', () => {
    const minimalTask = {
      id: '123',
      title: 'Minimal Task',
      status: TaskStatus.BACKLOG,
      priority: Priority.MEDIUM,
      createdBy: {
        id: '1',
        name: 'Creator',
        email: 'creator@example.com',
      },
      assignees: [],
      createdAt: '2025-02-25T00:00:00Z',
      updatedAt: '2025-02-25T00:00:00Z',
    }

    render(
      <TaskCard
        task={minimalTask}
        onClick={mockOnClick}
        onStatusChange={mockOnStatusChange}
      />
    )

    expect(screen.getByText('Minimal Task')).toBeInTheDocument()
    expect(screen.queryByTestId('effort-hours')).not.toBeInTheDocument()
    expect(screen.queryByTestId('deadline-indicator')).not.toBeInTheDocument()
  })
})
