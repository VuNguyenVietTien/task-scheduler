import { NextResponse } from 'next/server';
import { mockProjects } from '@/data/mockProjects';
import { storage } from '@/utils/storage';

export async function GET() {
  try {
    // In a real app, fetch from database
    await new Promise(resolve => setTimeout(resolve, 100));

    // Initialize localStorage with mock data if empty
    const storedProjects = storage.getProjects();
    if (storedProjects.length === 0) {
      storage.saveProjects(mockProjects);
    }

    // Return data from localStorage
    const projects = storage.getProjects();
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

    if (!name || !dueDate) {
      return NextResponse.json(
        { error: 'Name and due date are required' },
        { status: 400 }
      );
    }

    // Create new project
    const newProject = {
      id: crypto.randomUUID(),
      name,
      description: description || '',
      dueDate,
      members: members || 1,
      status: 'active' as const,
      tasks: []
    };

    // Save to localStorage
    storage.addProject(newProject);

    return NextResponse.json(newProject, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
