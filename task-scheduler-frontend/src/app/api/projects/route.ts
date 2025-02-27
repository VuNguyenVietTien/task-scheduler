import { NextResponse } from 'next/server';

interface Project {
  id: string;
  name: string;
  description: string;
  dueDate: string;
  members: number;
  status: 'active' | 'completed' | 'on-hold';
  tasks: string[];
}

// Mock projects data
const mockProjects: Project[] = [
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

export async function GET(request: Request) {
  try {
    // In a real app, fetch from database
    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 100));

    const searchParams = new URL(request.url).searchParams;
    const status = searchParams.get('status') as Project['status'] | null;
    
    let projects = [...mockProjects];
    
    // Filter by status if provided
    if (status) {
      projects = projects.filter(project => project.status === status);
    }

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, dueDate, members } = body;

    // Validate required fields
    if (!name || !dueDate) {
      return NextResponse.json(
        { error: 'Name and due date are required' },
        { status: 400 }
      );
    }

    // Create new project
    const newProject: Project = {
      id: (mockProjects.length + 1).toString(),
      name,
      description: description || '',
      dueDate,
      members: members || 1,
      status: 'active',
      tasks: []
    };

    mockProjects.push(newProject);

    return NextResponse.json(newProject, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
