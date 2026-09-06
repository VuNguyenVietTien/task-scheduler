'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Calendar,
  Info,
  Settings,
  FileText
} from 'lucide-react';
import { DatePicker } from '../ui/date-picker';
import { client } from '@/lib/apollo-client';
import { CREATE_PROJECT } from '@/graphql/queries/project';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion';

interface ProjectFormData {
  id?: string;
  name: string;
  description: string;
  start_date: Date | null;
  due_date: Date | null;
  status: string;
  priority: string;
  category: string;
  visibility: string;
  tags: string[];
  metadata: Record<string, any>;
}

interface ProjectFormProps {
  initialData?: Partial<ProjectFormData>;
  mode: 'create' | 'edit';
}

export default function ProjectForm({ initialData, mode }: ProjectFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<ProjectFormData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    start_date: initialData?.start_date ? new Date(initialData.start_date) : null,
    due_date: initialData?.due_date ? new Date(initialData.due_date) : null,
    status: initialData?.status || 'NEW',
    priority: initialData?.priority || 'MEDIUM',
    category: initialData?.category || '',
    visibility: initialData?.visibility || 'PUBLIC',
    tags: initialData?.tags || [],
    metadata: initialData?.metadata || {}
  });

  const handleInputChange = (field: keyof ProjectFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'create') {
        // Rust contract: create_project(input: CreateProjectInput!) → ProjectResponse.project_id
        const response = await client.mutate({
          mutation: CREATE_PROJECT,
          variables: {
            input: {
              name: formData.name,
              description: formData.description || null,
              // Rust ProjectStatus enum: ACTIVE/COMPLETED/ON_HOLD/CANCELLED (no NEW)
              status: formData.status === 'NEW' ? 'ACTIVE' : formData.status,
              priority: formData.priority,
              visibility: formData.visibility,
              tags: formData.tags,
              category: formData.category || null,
            },
          },
        });
        if (response.errors?.length) {
          throw new Error(response.errors[0].message);
        }
        const canonicalId = response.data?.create_project?.project_id;
        if (!canonicalId) {
          throw new Error('create_project response missing project_id');
        }
        router.push(`/projects/${canonicalId}`);
        return;
      }

      // RESIDUAL (W3 audit): edit mode still uses same-origin REST PUT
      // /api/projects/{id} — no update_project op exists in backend/schema.graphql.
      const url = `/api/projects/${initialData?.id}`;
      const method = 'PUT';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      // Navigate to projects list after successful update
      router.push('/projects');
      router.refresh();
    } catch (err) {
      console.error('Project form error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/projects');
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto p-6 space-y-6">
      <Accordion type="single" collapsible defaultValue="basic">
        <AccordionItem value="basic">
          <AccordionTrigger icon={<FileText className="w-5 h-5 text-blue-500" />}>
            Basic Information
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="project-name">
                  Project Name *
                </label>
                <input
                  id="project-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter project name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="project-description">
                  Description
                </label>
                <textarea
                  id="project-description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter project description"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="timeline">
          <AccordionTrigger icon={<Calendar className="w-5 h-5 text-green-500" />}>
            Timeline
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <DatePicker
                  date={formData.start_date}
                  onChange={(date: Date | null) => handleInputChange('start_date', date)}
                  placeholder="Select start date"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <DatePicker
                  date={formData.due_date}
                  onChange={(date: Date | null) => handleInputChange('due_date', date)}
                  placeholder="Select due date"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="details">
          <AccordionTrigger icon={<Info className="w-5 h-5 text-yellow-500" />}>
            Project Details
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="project-status">
                    Status *
                  </label>
                  <select
                    id="project-status"
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="NEW">New</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="project-priority">
                    Priority *
                  </label>
                  <select
                    id="project-priority"
                    value={formData.priority}
                    onChange={(e) => handleInputChange('priority', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="project-category">
                  Category
                </label>
                <input
                  id="project-category"
                  type="text"
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter project category"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="project-visibility">
                  Visibility *
                </label>
                <select
                  id="project-visibility"
                  value={formData.visibility}
                  onChange={(e) => handleInputChange('visibility', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="PUBLIC">Public</option>
                  <option value="PRIVATE">Private</option>
                  <option value="TEAM">Team Only</option>
                </select>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="additional">
          <AccordionTrigger icon={<Settings className="w-5 h-5 text-purple-500" />}>
            Additional Information
          </AccordionTrigger>
          <AccordionContent>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="project-tags">
                Tags
              </label>
              <input
                id="project-tags"
                type="text"
                value={formData.tags.join(', ')}
                onChange={(e) => handleInputChange('tags', e.target.value.split(',').map(tag => tag.trim()))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter tags separated by commas"
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {error && (
        <div className="text-red-500 text-sm mt-2" role="alert">
          {error}
        </div>
      )}

      <div className="flex justify-end space-x-4 pt-6">
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? 'Saving...' : mode === 'create' ? 'Create Project' : 'Update Project'}
        </button>
      </div>
    </form>
  );
}
