import { Task, TaskStatus, Priority, User } from '@/types/task';

export const mockUsers: User[] = [
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
  // Parent task with child tasks
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
    updatedAt: '2025-02-26T09:00:00Z',
    childTasks: [
      {
        id: '1-1',
        projectId: 'project-1',
        title: 'API Documentation Review',
        description: 'Review payment gateway API documentation',
        status: TaskStatus.DONE,
        priority: Priority.MEDIUM,
        priorityOrder: 1,
        effortHours: 2,
        startDate: '2025-02-26',
        deadline: '2025-02-27',
        assignees: [mockUsers[1]],
        createdAt: '2025-02-20T09:00:00Z',
        updatedAt: '2025-02-26T09:00:00Z',
        parentTaskId: '1'
      },
      {
        id: '1-2',
        projectId: 'project-1',
        title: 'Payment Gateway Implementation',
        description: 'Implement core payment gateway functionality',
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.HIGH,
        priorityOrder: 2,
        effortHours: 4,
        startDate: '2025-02-27',
        deadline: '2025-03-01',
        assignees: [mockUsers[0]],
        createdAt: '2025-02-20T09:00:00Z',
        updatedAt: '2025-02-26T09:00:00Z',
        parentTaskId: '1'
      }
    ]
  },
  // Parent task with child tasks
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
    updatedAt: '2025-02-26T09:00:00Z',
    childTasks: [
      {
        id: '2-1',
        projectId: 'project-1',
        title: 'OAuth2 Provider Setup',
        description: 'Set up and configure OAuth2 provider',
        status: TaskStatus.PLANNED,
        priority: Priority.HIGH,
        priorityOrder: 1,
        effortHours: 2,
        deadline: '2025-03-08',
        assignees: [mockUsers[1]],
        createdAt: '2025-02-20T09:00:00Z',
        updatedAt: '2025-02-26T09:00:00Z',
        parentTaskId: '2'
      },
      {
        id: '2-2',
        projectId: 'project-1',
        title: 'User Authentication Flow Testing',
        description: 'Test OAuth2 authentication flow',
        status: TaskStatus.PLANNED,
        priority: Priority.HIGH,
        priorityOrder: 2,
        effortHours: 2,
        deadline: '2025-03-10',
        assignees: [mockUsers[1]],
        createdAt: '2025-02-20T09:00:00Z',
        updatedAt: '2025-02-26T09:00:00Z',
        parentTaskId: '2'
      }
    ]
  },
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
  {
    id: '4',
    projectId: 'project-1',
    title: 'Database Migration',
    description: 'Migrate data to new MongoDB cluster',
    status: TaskStatus.PLANNED,
    priority: Priority.MEDIUM,
    priorityOrder: 4,
    effortHours: 8,
    assignees: [mockUsers[0], mockUsers[2]],
    createdAt: '2025-02-10T09:00:00Z',
    updatedAt: '2025-02-20T09:00:00Z'
  }
];
