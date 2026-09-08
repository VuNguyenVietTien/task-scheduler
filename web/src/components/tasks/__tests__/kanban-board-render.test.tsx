import React from 'react';
import { act, render, screen } from '@testing-library/react';
import type { Task } from '@/types/task';
import { KanbanBoard } from '../KanbanBoard';

const mockDispatch = jest.fn();
const mockUpdateTaskStatus = jest.fn((payload) => payload);
let mockDragEnd: (result: unknown) => void;
const mockDraggableDisabled = new Map<string, boolean>();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../../../redux/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: jest.fn(),
}));
jest.mock('react-redux', () => ({
  useSelector: (selector: (state: unknown) => unknown) => selector({
    tasks: { tasks: [], loading: false, error: null },
    members: { members: [] },
  }),
}));
jest.mock('../../../redux/features/tasksSlice', () => ({
  updateTaskStatus: (payload: unknown) => mockUpdateTaskStatus(payload),
}));
jest.mock('@apollo/client', () => ({
  useQuery: () => ({ data: { resource_members: [] }, loading: false }),
}));
jest.mock('../../../graphql/scheduling', () => ({ RESOURCE_MEMBERS_QUERY: {} }));
jest.mock('react-select', () => ({
  __esModule: true,
  default: () => null,
  components: {},
}));
jest.mock('react-select/animated', () => ({ __esModule: true, default: () => ({}) }));
jest.mock('../TaskDetail', () => ({ TaskDetail: () => null }));
jest.mock('@/components/dnd/DragDropProvider', () => {
  const React = require('react');
  return {
    DragDropProvider: ({ children, onDragEnd }: any) => {
      mockDragEnd = onDragEnd;
      return React.createElement(React.Fragment, null, children);
    },
    Droppable: ({ children }: any) => children({ innerRef: jest.fn(), droppableProps: {} }, { isDraggingOver: false }),
    Draggable: ({ children, draggableId, isDragDisabled }: any) => {
      mockDraggableDisabled.set(draggableId, isDragDisabled);
      return children({ innerRef: jest.fn(), draggableProps: {}, dragHandleProps: {} }, { isDragging: false });
    },
  };
});

const task: Task = {
  task_id: 'task-1',
  project_id: 'project-1',
  title: 'Render-safe task',
  status: 'TODO',
  priority: 'MEDIUM',
  priority_order: 1,
  created_by: 'owner',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockDraggableDisabled.clear();
  localStorage.clear();
});

test('renders task cards without referencing the removed mutation hook', () => {
  render(<KanbanBoard tasks={[task]} projectId="project-1" />);

  expect(screen.getByText('Render-safe task')).toBeInTheDocument();
  expect(mockDraggableDisabled.get(task.task_id)).toBe(false);
});

test('disables dragging and marks the task while the Redux status update is pending', async () => {
  let resolveUpdate!: (value: unknown) => void;
  mockDispatch.mockReturnValue({
    unwrap: () => new Promise((resolve) => { resolveUpdate = resolve; }),
  });
  const { container } = render(<KanbanBoard tasks={[task]} projectId="project-1" />);

  act(() => mockDragEnd({
    draggableId: task.task_id,
    source: { droppableId: 'TODO', index: 0 },
    destination: { droppableId: 'DOING', index: 0 },
  }));

  expect(mockUpdateTaskStatus).toHaveBeenCalledWith({ taskId: task.task_id, status: 'DOING' });
  expect(mockDraggableDisabled.get(task.task_id)).toBe(true);
  expect(container.querySelector('[data-task-id="task-1"]')).toHaveClass('animate-pulse');

  await act(async () => resolveUpdate({ task: { ...task, status: 'DOING' } }));
  expect(mockDraggableDisabled.get(task.task_id)).toBe(false);
});
