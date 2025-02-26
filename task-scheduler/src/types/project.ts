export interface ProjectData {
  id: string;
  name: string;
  description: string;
  dueDate: string;
  members: number;
  status: 'active' | 'completed' | 'on-hold';
}