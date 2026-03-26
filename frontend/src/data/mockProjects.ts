export interface Project {
  id: string;
  name: string;
  description: string;
  dueDate: string;
  members: number;
  status: 'active' | 'completed' | 'on-hold';
  tasks: string[];
}

export const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Website Redesign',
    description: 'Modernizing the company website with new design system',
    dueDate: '2025-03-15',
    members: 5,
    status: 'active',
    tasks: []
  },
  {
    id: '2',
    name: 'Mobile App Development',
    description: 'Building a new mobile app for task management',
    dueDate: '2025-04-30',
    members: 8,
    status: 'active',
    tasks: []
  },
  {
    id: '3',
    name: 'API Integration',
    description: 'Integrating third-party APIs for enhanced functionality',
    dueDate: '2025-02-28',
    members: 3,
    status: 'completed',
    tasks: []
  }
];
