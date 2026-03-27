'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { validateProjectForm, type ProjectFormData, ProjectPriority, ProjectVisibility, ProjectStatus } from '@/schemas/projectForm';
import { XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation } from '@apollo/client';
import { CREATE_PROJECT } from '@/graphql/queries/project';

type ValidationError = {
  path: string;
  message: string;
};

export default function NewProjectPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [createProject, { loading: mutationLoading }] = useMutation(CREATE_PROJECT);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    description: null,
    status: ProjectStatus.ACTIVE,
    priority: ProjectPriority.MEDIUM,
    visibility: ProjectVisibility.PRIVATE,
    tags: []
  });
  const [newTag, setNewTag] = useState('');

  const getFieldError = (fieldName: string) => {
    return errors.find(error => error.path === fieldName)?.message;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    const validation = validateProjectForm(formData);
    
    if (!validation.success) {
      setErrors(validation.errors || []);
      return;
    }

    try {
      const { data } = await createProject({
        variables: {
          input: {
            name: formData.name,
            description: formData.description || '',
            status: formData.status,
            priority: formData.priority,
            visibility: formData.visibility,
            tags: formData.tags,
          }
        }
      });

      router.push(`/projects/${data.createProject.projectId}`);
    } catch (err) {
      if (err instanceof Error && err.name === 'AuthenticationError') {
        router.push('/auth');
        return;
      }
      setErrors([
        {
          path: 'form',
          message: err instanceof Error ? err.message : 'Something went wrong'
        }
      ]);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value || null
    }));
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      if (formData.tags.length >= 10) {
        setErrors(prev => [...prev, { path: 'tags', message: 'Maximum 10 tags allowed' }]);
        return;
      }
      if (newTag.length > 30) {
        setErrors(prev => [...prev, { path: 'tags', message: 'Tag must be less than 30 characters' }]);
        return;
      }
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const formError = getFieldError('form');

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Create New Project</h1>
        <p className="text-gray-600">Fill in the details to create a new project</p>
      </div>

      {formError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error creating project</h3>
              <p className="mt-2 text-sm text-red-700">{formError}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Project Name *
          </label>
          <input
            type="text"
            name="name"
            id="name"
            required
            value={formData.name}
            onChange={handleChange}
            className={`mt-2 block w-full px-4 py-3 text-base rounded-lg border shadow-sm transition-colors
              ${getFieldError('name') 
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
              } 
              hover:border-gray-400`}
          />
          {getFieldError('name') && (
            <p className="mt-1 text-sm text-red-600">{getFieldError('name')}</p>
          )}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            name="description"
            id="description"
            rows={4}
            value={formData.description || ''}
            onChange={handleChange}
            className={`mt-2 block w-full px-4 py-3 text-base rounded-lg border shadow-sm transition-colors
              ${getFieldError('description')
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
              }
              hover:border-gray-400 resize-none`}
          />
          {getFieldError('description') && (
            <p className="mt-1 text-sm text-red-600">{getFieldError('description')}</p>
          )}
        </div>

        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
            Priority *
          </label>
          <select
            name="priority"
            id="priority"
            required
            value={formData.priority}
            onChange={handleChange}
            className="mt-2 block w-full px-4 py-3 text-base rounded-lg border border-gray-300 shadow-sm transition-colors focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400"
          >
            {Object.entries(ProjectPriority).map(([key, value]) => (
              <option key={key} value={value}>{key}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700">
            Status *
          </label>
          <select
            name="status"
            id="status"
            required
            value={formData.status}
            onChange={handleChange}
            className="mt-2 block w-full px-4 py-3 text-base rounded-lg border border-gray-300 shadow-sm transition-colors focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400"
          >
            {Object.entries(ProjectStatus).map(([key, value]) => (
              <option key={key} value={value}>{key}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="visibility" className="block text-sm font-medium text-gray-700">
            Visibility *
          </label>
          <select
            name="visibility"
            id="visibility"
            required
            value={formData.visibility}
            onChange={handleChange}
            className="mt-2 block w-full px-4 py-3 text-base rounded-lg border border-gray-300 shadow-sm transition-colors focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400"
          >
            {Object.entries(ProjectVisibility).map(([key, value]) => (
              <option key={key} value={value}>{key}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
            Tags (Press Enter to add)
          </label>
          <input
            type="text"
            id="tags"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={handleAddTag}
            className="mt-2 block w-full px-4 py-3 text-base rounded-lg border border-gray-300 shadow-sm transition-colors focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400"
            placeholder="Add tags..."
          />
          {getFieldError('tags') && (
            <p className="mt-1 text-sm text-red-600">{getFieldError('tags')}</p>
          )}
          {formData.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1 inline-flex items-center"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <XCircle className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutationLoading}
            className={`px-6 py-3 text-base font-medium text-white bg-blue-600 border border-transparent rounded-lg shadow-sm hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              mutationLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {mutationLoading ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              </div>
            ) : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
}
