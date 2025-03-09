'use client';

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { taskFormSchema, progressTypeOptions } from '@/schemas/taskForm';
import { TASK_TYPES, TASK_CATEGORIES, TASK_TAGS, Task } from '@/types/task';
import { mockTasks } from '@/data/mockTasks';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/hooks/useProject';
import { Combobox } from '@headlessui/react';

// Dynamic import for React Quill
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });
import 'react-quill/dist/quill.snow.css';

interface NewTaskFormProps {
  projectId: string;
}

export interface TaskFormInputs {
  title: string;
  description: string;
  assignee: string;
  deadline: string;
  category: string;
  type: string;
  effort?: number;
  progressType: string;
  tags: string[];
  parentTaskId?: string;
}

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ color: [] }, { background: [] }],
    ['link', 'image'],
    ['clean'],
  ],
};

function ComboboxField({ options, value, onChange, placeholder }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState('');

  const filteredOptions = useMemo(() => {
    if (!query) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(query.toLowerCase())
    );
  }, [options, query]);

  return (
    <Combobox value={value} onChange={onChange}>
      <div className="relative">
        <div className="relative w-full cursor-default overflow-hidden rounded-lg bg-white text-left border border-gray-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
          <Combobox.Input
            className="w-full border-none py-2 pl-3 pr-10 text-sm leading-5 text-gray-900 focus:ring-0"
            placeholder={placeholder}
            displayValue={(val: string) => options.find(opt => opt.value === val)?.label || ''}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
            <svg 
              className="h-5 w-5 text-gray-400" 
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </Combobox.Button>
        </div>
        <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
          {filteredOptions.map((option) => (
            <Combobox.Option
              key={option.value}
              value={option.value}
              className={({ active }) =>
                `relative cursor-pointer select-none py-2 pl-3 pr-9 min-h-[40px] ${
                  active ? 'bg-blue-50 text-gray-900' : 'text-gray-900'
                }`
              }
            >
              {({ selected }) => (
                <>
                  <span className={`block truncate ${selected ? 'font-semibold' : 'font-normal'}`}>
                    {option.label}
                  </span>
                  {selected && (
                    <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-blue-600">
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                  )}
                </>
              )}
            </Combobox.Option>
          ))}
        </Combobox.Options>
      </div>
    </Combobox>
  );
}

export default function NewTaskForm({ projectId }: NewTaskFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { data: projectData } = useProject(projectId);
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [selectedParentTask, setSelectedParentTask] = useState<Task | null>(null);
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState('');
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<TaskFormInputs>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      tags: [],
      type: '',
      category: '',
      progressType: '',
      effort: 0,
    },
  });

  const selectedAssignee = watch('assignee');

  // Filter project members based on search query
  const filteredMembers = useMemo(() => {
    const members = projectData?.project?.members || [];
    if (!assigneeSearchQuery) return members;
    return members.filter(member =>
      member.username.toLowerCase().includes(assigneeSearchQuery.toLowerCase())
    );
  }, [projectData?.project?.members, assigneeSearchQuery]);

  // Filter available parent tasks
  const availableParentTasks = useMemo(() => {
    return mockTasks.filter(task => {
      if (task.projectId !== projectId) return false;
      if (!taskSearchQuery) return true;
      
      const query = taskSearchQuery.toLowerCase();
      return task.title.toLowerCase().includes(query) || 
             task.description?.toLowerCase().includes(query);
    });
  }, [taskSearchQuery, projectId]);

  const progressTypeOpts = useMemo(() => 
    progressTypeOptions.map(type => ({
      value: type,
      label: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    })), 
    []
  );

  const categoryOpts = useMemo(() => 
    TASK_CATEGORIES.map(category => ({
      value: category,
      label: category
    })),
    []
  );

  const typeOpts = useMemo(() => 
    TASK_TYPES.map(type => ({
      value: type,
      label: type
    })),
    []
  );

  const onSubmit = async (data: TaskFormInputs) => {
    try {
      const taskData = {
        ...data,
        projectId,
        parentTaskId: selectedParentTask?.id,
      };
      console.log('Creating task:', taskData);
      router.push(`/projects/${projectId}`);
      router.refresh();
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const handleParentTaskSelect = (task: Task) => {
    setSelectedParentTask(task);
    setTaskSearchQuery('');
    setValue('parentTaskId', task.id);
  };

  const handleAssigneeSelect = (userId: string, username: string) => {
    setValue('assignee', userId);
    setIsAssigneeDropdownOpen(false);
  };

  const handleAssignToMe = () => {
    if (user) {
      setValue('assignee', user.id);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-white p-6 rounded-lg shadow">
      <div className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Title
          </label>
          <input
            {...register('title')}
            type="text"
            id="title"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="Enter task title"
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600">{errors.title.message as string}</p>
          )}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <div className="mt-1">
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <ReactQuill
                  {...field}
                  theme="snow"
                  modules={quillModules}
                  placeholder="Enter task description"
                  className="bg-white"
                />
              )}
            />
          </div>
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">{errors.description.message as string}</p>
          )}
        </div>

        <div>
          <label htmlFor="assignee" className="block text-sm font-medium text-gray-700">
            Assignee
          </label>
          <div className="mt-1 relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div 
                  className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 cursor-pointer"
                  onClick={() => setIsAssigneeDropdownOpen(true)}
                >
                  {selectedAssignee ? (
                    <div className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      {projectData?.project?.members.find(m => m.userId === selectedAssignee)?.username || selectedAssignee}
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="Search members..."
                      value={assigneeSearchQuery}
                      onChange={(e) => {
                        setAssigneeSearchQuery(e.target.value);
                        setIsAssigneeDropdownOpen(true);
                      }}
                      className="w-full border-none p-0 focus:ring-0"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </div>
                {isAssigneeDropdownOpen && (
                  <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    {filteredMembers.map((member) => (
                      <li
                        key={member.userId}
                        onClick={() => handleAssigneeSelect(member.userId, member.username)}
                        className="relative cursor-pointer select-none py-2 px-3 hover:bg-blue-50"
                      >
                        <div className="flex items-center">
                          {member.avatarUrl && (
                            <img src={member.avatarUrl} alt="" className="h-6 w-6 rounded-full mr-2" />
                          )}
                          <span>{member.username}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                type="button"
                onClick={handleAssignToMe}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Assign to me
              </button>
            </div>
            {errors.assignee && (
              <p className="mt-1 text-sm text-red-600">{errors.assignee.message as string}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="deadline" className="block text-sm font-medium text-gray-700">
            Deadline
          </label>
          <input
            {...register('deadline')}
            type="datetime-local"
            id="deadline"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          {errors.deadline && (
            <p className="mt-1 text-sm text-red-600">{errors.deadline.message as string}</p>
          )}
        </div>

        <div>
          <label htmlFor="progressType" className="block text-sm font-medium text-gray-700">
            Progress Type
          </label>
          <div className="mt-1">
            <Controller
              name="progressType"
              control={control}
              render={({ field }) => (
                <ComboboxField
                  options={progressTypeOpts}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select progress type"
                />
              )}
            />
          </div>
          {errors.progressType && (
            <p className="mt-1 text-sm text-red-600">{errors.progressType.message as string}</p>
          )}
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">
            Category
          </label>
          <div className="mt-1">
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <ComboboxField
                  options={categoryOpts}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select category"
                />
              )}
            />
          </div>
          {errors.category && (
            <p className="mt-1 text-sm text-red-600">{errors.category.message as string}</p>
          )}
        </div>

        <div>
          <label htmlFor="type" className="block text-sm font-medium text-gray-700">
            Type
          </label>
          <div className="mt-1">
            <Controller
              name="type" 
              control={control}
              render={({ field }) => (
                <ComboboxField
                  options={typeOpts}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select type"
                />
              )}
            />
          </div>
          {errors.type && (
            <p className="mt-1 text-sm text-red-600">{errors.type.message as string}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
          <div className="mt-2 space-y-2 grid grid-cols-2 gap-4">
            {TASK_TAGS.map((tag) => (
              <label key={tag} className="inline-flex items-center">
                <input
                  type="checkbox"
                  value={tag}
                  {...register('tags')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">{tag}</span>
              </label>
            ))}
          </div>
          {errors.tags && (
            <p className="mt-1 text-sm text-red-600">{errors.tags.message as string}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Create Task
        </button>
      </div>
    </form>
  );
}
