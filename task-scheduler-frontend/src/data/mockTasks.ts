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

export const mockTasks: Task[] = [
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
    createdBy: mockUsers[0],
    createdAt: '2025-02-20T09:00:00Z',
    updatedAt: '2025-02-26T09:00:00Z'
  },
  {
    id: '2',
    projectId: 'project-1',
    title: 'User Authentication',
    description: 'Implement OAuth2 authentication flow',
    status: TaskStatus.PLANNED,
    priority: Priority.MEDIUM,
    priorityOrder: 2,
    effortHours: 12,
    startDate: '2025-03-01',
    deadline: '2025-03-10',
    assignees: [mockUsers[1]],
    createdBy: mockUsers[0],
    createdAt: '2025-02-20T09:00:00Z',
    updatedAt: '2025-02-26T09:00:00Z'
  },
  {
    id: '3',
    projectId: 'project-1',
    title: 'Dashboard UI',
    description: 'Design and implement main dashboard interface',
    status: TaskStatus.IN_REVIEW,
    priority: Priority.HIGH,
    priorityOrder: 3,
    effortHours: 16,
    startDate: '2025-02-20',
    deadline: '2025-03-01',
    assignees: [mockUsers[2]],
    createdBy: mockUsers[1],
    createdAt: '2025-02-15T09:00:00Z',
    updatedAt: '2025-02-25T09:00:00Z'
  },
  {
    id: '4',
    projectId: 'project-1',
    title: 'Database Migration',
    description: 'Migrate data to new MongoDB cluster',
    status: TaskStatus.DONE,
    priority: Priority.URGENT,
    priorityOrder: 4,
    effortHours: 6,
    startDate: '2025-02-15',
    deadline: '2025-02-20',
    assignees: [mockUsers[0], mockUsers[2]],
    createdBy: mockUsers[1],
    createdAt: '2025-02-10T09:00:00Z',
    updatedAt: '2025-02-20T09:00:00Z'
  },
  {
    id: '5',
    projectId: 'project-1',
    title: 'Performance Testing',
    description: 'Conduct load testing and optimize performance',
    status: TaskStatus.BACKLOG,
    priority: Priority.LOW,
    priorityOrder: 5,
    effortHours: 8,
    startDate: '2025-03-10',
    deadline: '2025-03-15',
    assignees: [mockUsers[2]],
    createdBy: mockUsers[0],
    createdAt: '2025-02-25T09:00:00Z',
    updatedAt: '2025-02-25T09:00:00Z'
  }
];
