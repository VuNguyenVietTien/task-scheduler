import { Task, TaskStatus, Priority, User } from '@/types/task';

const mockUsers: User[] = [
  {
    id: 'user1',
    name: 'John Doe',
    email: 'john@example.com',
    avatarUrl: 'https://ui-avatars.com/api/?name=John+Doe'
  },
  {
    id: 'user2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    avatarUrl: 'https://ui-avatars.com/api/?name=Jane+Smith'
  },
  {
    id: 'user3',
    name: 'Mike Johnson',
    email: 'mike@example.com',
    avatarUrl: 'https://ui-avatars.com/api/?name=Mike+Johnson'
  }
];

// Tasks for testing Gantt chart functionality and drag & drop ordering
export const mockTasks: Task[] = [
  // Task with explicit dates (High Priority)
  {
    id: '1',
    projectId: 'project-1',
    title: 'API Integration',
    description: 'Integrate payment gateway API with the backend system',
    status: TaskStatus.IN_PROGRESS,
    priority: Priority.HIGH,
    priorityOrder: 1,
    effortHours: 8,
    startDate: '2025-02-26',
    deadline: '2025-03-05',
    assignees: [mockUsers[0], mockUsers[1]],
    createdAt: '2025-02-20T09:00:00Z',
    updatedAt: '2025-02-26T09:00:00Z'
  },
  // Task without start date (High Priority) - should be scheduled after task 1
  {
    id: '2',
    projectId: 'project-1',
    title: 'User Authentication',
    description: 'Implement OAuth2 authentication flow',
    status: TaskStatus.PLANNED,
    priority: Priority.HIGH,
    priorityOrder: 2,
    effortHours: 4,
    deadline: '2025-03-10',
    assignees: [mockUsers[1]],
    createdAt: '2025-02-20T09:00:00Z',
    updatedAt: '2025-02-26T09:00:00Z'
  },
  // Task with explicit dates (Medium Priority)
  {
    id: '3',
    projectId: 'project-1',
    title: 'Dashboard UI',
    description: 'Design and implement main dashboard interface',
    status: TaskStatus.IN_REVIEW,
    priority: Priority.MEDIUM,
    priorityOrder: 3,
    effortHours: 16,
    startDate: '2025-02-28',
    deadline: '2025-03-03',
    assignees: [mockUsers[2]],
    createdAt: '2025-02-15T09:00:00Z',
    updatedAt: '2025-02-25T09:00:00Z'
  },
  // Task without any dates (Medium Priority) - should use effort hours for duration
  {
    id: '4',
    projectId: 'project-1',
    title: 'Database Migration',
    description: 'Migrate data to new MongoDB cluster',
    status: TaskStatus.PLANNED,
    priority: Priority.MEDIUM,
    priorityOrder: 4,
    effortHours: 8, // Should create a 1-day task
    assignees: [mockUsers[0], mockUsers[2]],
    createdAt: '2025-02-10T09:00:00Z',
    updatedAt: '2025-02-20T09:00:00Z'
  },
  // Task with only deadline (Low Priority)
  {
    id: '5',
    projectId: 'project-1',
    title: 'Performance Testing',
    description: 'Conduct load testing and optimize performance',
    status: TaskStatus.BACKLOG,
    priority: Priority.LOW,
    priorityOrder: 5,
    effortHours: 16,
    deadline: '2025-03-15', // Should be scheduled backward from deadline if possible
    assignees: [mockUsers[2]],
    createdAt: '2025-02-25T09:00:00Z',
    updatedAt: '2025-02-25T09:00:00Z'
  },
  // Task with only deadline (High Priority) - should be scheduled before low priority tasks
  {
    id: '6',
    projectId: 'project-1',
    title: 'Security Review',
    description: 'Conduct security audit and implement fixes',
    status: TaskStatus.BACKLOG,
    priority: Priority.HIGH,
    priorityOrder: 6,
    effortHours: 10,
    deadline: '2025-03-20',
    assignees: [mockUsers[0]],
    createdAt: '2025-02-25T09:00:00Z',
    updatedAt: '2025-02-25T09:00:00Z'
  }
];
