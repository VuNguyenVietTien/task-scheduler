'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@apollo/client';
import { XCircle } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { CREATE_PROJECT, GET_USER_PROJECTS } from '@/graphql/queries/project';
import {
  validateProjectForm,
  type ProjectFormData,
  ProjectPriority,
  ProjectVisibility,
  ProjectStatus,
} from '@/schemas/projectForm';

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
}

type ValidationError = { path: string; message: string };

const INITIAL_FORM: ProjectFormData = {
  name: '',
  description: null,
  status: ProjectStatus.ACTIVE,
  priority: ProjectPriority.MEDIUM,
  visibility: ProjectVisibility.PRIVATE,
  tags: [],
};

export default function CreateProjectModal({ open, onClose }: CreateProjectModalProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<ProjectFormData>(INITIAL_FORM);
  const [newTag, setNewTag] = useState('');
  const [errors, setErrors] = useState<ValidationError[]>([]);

  const [createProject, { loading }] = useMutation(CREATE_PROJECT, {
    refetchQueries: [{ query: GET_USER_PROJECTS }],
  });

  const getFieldError = (field: string) =>
    errors.find((e) => e.path === field)?.message;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value || null }));
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !newTag.trim()) return;
    e.preventDefault();
    if (formData.tags.length >= 10) {
      setErrors((prev) => [...prev, { path: 'tags', message: 'Maximum 10 tags allowed' }]);
      return;
    }
    if (newTag.length > 30) {
      setErrors((prev) => [...prev, { path: 'tags', message: 'Tag must be less than 30 characters' }]);
      return;
    }
    setFormData((prev) => ({ ...prev, tags: [...prev.tags, newTag.trim()] }));
    setNewTag('');
  };

  const removeTag = (tag: string) => {
    setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  };

  const handleClose = () => {
    setFormData(INITIAL_FORM);
    setNewTag('');
    setErrors([]);
    onClose();
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
          },
        },
      });

      handleClose();
      router.push(`/projects/${data.createProject.projectId}`);
    } catch (err) {
      if (err instanceof Error && err.name === 'AuthenticationError') {
        router.push('/auth');
        return;
      }
      setErrors([
        { path: 'form', message: err instanceof Error ? err.message : 'Something went wrong' },
      ]);
    }
  };

  const inputClass = (field: string) =>
    `mt-1 block w-full px-3 py-2 text-sm rounded-lg border shadow-sm transition-colors focus:outline-none focus:ring-2 ${
      getFieldError(field)
        ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
        : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400'
    }`;

  return (
    <Dialog open={open} onClose={handleClose} title="Create New Project" preventBackdropClose>
      <div className="mt-4 w-full min-w-[480px]">
        {getFieldError('form') && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {getFieldError('form')}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Website Redesign"
              className={inputClass('name')}
            />
            {getFieldError('name') && (
              <p className="mt-1 text-xs text-red-600">{getFieldError('name')}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              name="description"
              rows={3}
              value={formData.description || ''}
              onChange={handleChange}
              placeholder="Brief description of the project..."
              className={`${inputClass('description')} resize-none`}
            />
            {getFieldError('description') && (
              <p className="mt-1 text-xs text-red-600">{getFieldError('description')}</p>
            )}
          </div>

          {/* Priority + Status row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Priority <span className="text-red-500">*</span>
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className={inputClass('priority')}
              >
                {Object.entries(ProjectPriority).map(([key, value]) => (
                  <option key={key} value={value}>{key}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className={inputClass('status')}
              >
                {Object.entries(ProjectStatus).map(([key, value]) => (
                  <option key={key} value={value}>{key}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Visibility <span className="text-red-500">*</span>
            </label>
            <select
              name="visibility"
              value={formData.visibility}
              onChange={handleChange}
              className={inputClass('visibility')}
            >
              {Object.entries(ProjectVisibility).map(([key, value]) => (
                <option key={key} value={value}>{key}</option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Tags <span className="text-gray-400 font-normal">(press Enter to add)</span>
            </label>
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Add a tag..."
              className={inputClass('tags')}
            />
            {getFieldError('tags') && (
              <p className="mt-1 text-xs text-red-600">{getFieldError('tags')}</p>
            )}
            {formData.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      aria-label={`Remove tag ${tag}`}
                    >
                      <XCircle className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
