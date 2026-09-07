"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from 'zod';
import { taskFormSchema } from "@/schemas/taskForm";
import { Task } from "@/types/task";
import { TagInput } from "@/components/ui/tag-input";
import { mockTasks } from "@/data/mockTasks";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/hooks/useProject";
import { Combobox } from "@headlessui/react";
import { useMutation, useQuery } from "@apollo/client";
import { CREATE_TASK } from "@/graphql/mutations/tasks";
import { RESOURCE_MEMBERS_QUERY } from "@/graphql/scheduling";

import { AdvancedEditor } from "@/components/common/AdvancedEditor";
import { ProjectCatalogSelect } from '@/components/projects/ProjectCatalogSettingsPanel';

interface NewTaskFormProps {
  projectId: string;
  parentTaskId?: string;
}

export interface TaskFormInputs {
  title: string;
  description: string;
  assignee: string;
  /** Set only for a project member who does not have a linked user account. */
  assigneeResourceMemberId?: string;
  startDate: string;
  dueDate: string;
  categoryCatalogItemId: string;
  taskTypeCatalogItemId: string;
  effort?: number;
  progressCatalogItemId: string;
  tags: string[];
  parentTaskId?: string;
  status:
  | "TODO"
  | "DOING"
  | "DONE"
  | "CLOSE"
  | "PENDING"
  | "REVIEW"
  | "BLOCKED"
  | "REJECTED"
  | "ARCHIVED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | "CRITICAL";
  priorityOrder: number;
}

interface ResourceMemberRow {
  resource_member_id: string;
  display_name: string;
  email: string | null;
  user_id: string | null;
  member_kind: string;
}

interface AssigneeOption {
  key: string;
  label: string;
  userId: string | null;
  resourceMemberId: string | null;
  avatarUrl?: string | null;
}

interface ComboboxFieldProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}


function ComboboxField({
  options,
  value,
  onChange,
  placeholder,
}: ComboboxFieldProps) {
  const [query, setQuery] = useState("");

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
            displayValue={(val: string) =>
              options.find((opt) => opt.value === val)?.label || ""
            }
            onChange={(event) => setQuery(event.target.value)}
          />
          <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
            <svg
              className="h-5 w-5 text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
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
                `relative cursor-pointer select-none py-2 pl-3 pr-9 min-h-[40px] ${active ? "bg-blue-50 text-gray-900" : "text-gray-900"
                }`
              }
            >
              {({ selected }) => (
                <>
                  <span
                    className={`block truncate ${selected ? "font-semibold" : "font-normal"
                      }`}
                  >
                    {option.label}
                  </span>
                  {selected && (
                    <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-blue-600">
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
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

const catalogTaskFormSchema = taskFormSchema
  .omit({ category: true, type: true, progressType: true })
  .extend({
    categoryCatalogItemId: z.string(),
    taskTypeCatalogItemId: z.string(),
    progressCatalogItemId: z.string(),
  });

// Rust TaskStatus canonical values for task creation (review BD-3): restrict to
// TODO/DOING/DONE/CLOSE regardless of broader SDL history.
export const TASK_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'TODO', label: 'Todo' },
  { value: 'DOING', label: 'Doing' },
  { value: 'DONE', label: 'Done' },
  { value: 'CLOSE', label: 'Close' },
];

export function buildCreateTaskInput(
  data: TaskFormInputs,
  projectId: string,
  parentTaskId?: string | null
) {
  return {
    title: data.title,
    description: data.description || '',
    project_id: projectId,
    parent_task_id: parentTaskId || data.parentTaskId || null,
    status: data.status,
    priority: data.priority,
    // CreateTaskInput.priority_order is Int! (non-null) — BD-2
    priority_order: data.priorityOrder ?? 0,
    start_date: data.startDate ? new Date().toISOString() : null,
    due_date: data.dueDate ? new Date(data.dueDate).toISOString() : null,
    // An unlinked resource member has no user id. Passing its resource id is
    // what allows the backend to retain the assignment until it is linked.
    assignee_id: data.assigneeResourceMemberId ? null : data.assignee || null,
    assignee_resource_member_id: data.assigneeResourceMemberId || null,
    effort: data.effort || 0,
    task_type_catalog_item_id: data.taskTypeCatalogItemId || null,
    category_catalog_item_id: data.categoryCatalogItemId || null,
    progress_catalog_item_id: data.progressCatalogItemId || null,
    tags: data.tags || [],
  };
}

export default function NewTaskForm({ projectId, parentTaskId }: NewTaskFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { data: projectData } = useProject(projectId);
  const resourceMembersQ = useQuery(RESOURCE_MEMBERS_QUERY, {
    variables: { project_id: projectId },
    skip: !projectId,
    fetchPolicy: 'cache-and-network',
  });
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [selectedParentTask, setSelectedParentTask] = useState<Task | null>(
    null
  );
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState("");
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
  const assigneeRef = React.useRef<HTMLDivElement>(null);

  // Xử lý click ngoài dropdown
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (assigneeRef.current && !assigneeRef.current.contains(event.target as Node)) {
        setIsAssigneeDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [assigneeRef]);

  // GraphQL mutation
  const [createTask, { loading: createTaskLoading }] = useMutation(CREATE_TASK);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<TaskFormInputs>({
    resolver: zodResolver(catalogTaskFormSchema),
    defaultValues: {
      tags: [],
      taskTypeCatalogItemId: "",
      categoryCatalogItemId: "",
      progressCatalogItemId: "",
      effort: 0,
      status: "TODO", // Default to first status
      priority: "MEDIUM",
      priorityOrder: 0,
    },
  });

  const selectedAssignee = watch("assignee");
  const selectedAssigneeResourceMemberId = watch("assigneeResourceMemberId");
  // A project member without an email/user account exists only in
  // resource_members. Merge that list with ordinary project members, while
  // retaining user-id assignment for linked members.
  const assigneeOptions = useMemo<AssigneeOption[]>(() => {
    const byKey = new Map<string, AssigneeOption>();
    for (const member of projectData?.project?.members ?? []) {
      if (!member?.user?.user_id) continue;
      const label = member.user.username || member.user.full_name || member.user.email;
      byKey.set(`user:${member.user.user_id}`, {
        key: `user:${member.user.user_id}`,
        label,
        userId: member.user.user_id,
        resourceMemberId: null,
        avatarUrl: member.user.avatar_url,
      });
    }
    for (const member of (resourceMembersQ.data?.resource_members ?? []) as ResourceMemberRow[]) {
      if (member.user_id) {
        // Linked members keep the existing user-id mutation contract.
        const key = `user:${member.user_id}`;
        if (!byKey.has(key)) {
          byKey.set(key, {
            key,
            label: member.display_name,
            userId: member.user_id,
            resourceMemberId: null,
          });
        }
      } else {
        byKey.set(`resource:${member.resource_member_id}`, {
          key: `resource:${member.resource_member_id}`,
          label: member.display_name,
          userId: null,
          resourceMemberId: member.resource_member_id,
        });
      }
    }
    return Array.from(byKey.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [projectData?.project?.members, resourceMembersQ.data?.resource_members]);

  const filteredMembers = useMemo(() => {
    const query = assigneeSearchQuery.trim().toLowerCase();
    return assigneeOptions
      .filter((member) => !query || member.label.toLowerCase().includes(query))
      .slice(0, 10);
  }, [assigneeOptions, assigneeSearchQuery]);

  const selectedAssigneeMember = useMemo(() => {
    if (selectedAssigneeResourceMemberId) {
      return assigneeOptions.find((option) => option.resourceMemberId === selectedAssigneeResourceMemberId) ?? null;
    }
    return assigneeOptions.find((option) => option.userId === selectedAssignee) ?? null;
  }, [assigneeOptions, selectedAssignee, selectedAssigneeResourceMemberId]);

  // Filter available parent tasks
  const availableParentTasks = useMemo(() => {
    return mockTasks.filter((task) => {
      if (task.projectId !== projectId) return false;
      if (!taskSearchQuery) return true;

      const query = taskSearchQuery.toLowerCase();
      return (
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query)
      );
    });
  }, [taskSearchQuery, projectId]);

  const priorityOpts = useMemo(
    () => [
      { value: "LOW", label: "Low" },
      { value: "MEDIUM", label: "Medium" },
      { value: "HIGH", label: "High" },
      { value: "URGENT", label: "Urgent" },
      { value: "CRITICAL", label: "Critical" },
    ],
    []
  );

  const statusOpts = TASK_STATUS_OPTIONS;

  const onSubmit = async (data: TaskFormInputs) => {
    try {
      // Hiển thị trạng thái loading
      console.log('Submitting task with data:', data);

      // Chuẩn bị input cho GraphQL mutation (snake_case + lowercase progress_type)
      const createTaskInput = buildCreateTaskInput(data, projectId, parentTaskId);

      // Gọi mutation để tạo task
      const result = await createTask({
        variables: {
          input: createTaskInput
        }
      });

      if (!result.data?.create_task) throw new Error('Task creation returned no task result.');
      {
        console.log('Task created successfully:', result.data.create_task);

        // Hiển thị thông báo thành công
        alert('Tạo công việc thành công!');

        // Navigate back to project
        router.push(`/projects/${projectId}`);
      }
    } catch (error) {
      console.error('Error creating task:', error);

      // Hiển thị thông báo lỗi
      alert('Có lỗi xảy ra khi tạo công việc. Vui lòng thử lại.');
    }
  };

  const handleParentTaskSelect = (task: Task) => {
    setSelectedParentTask(task);
    setTaskSearchQuery("");
    setValue("parentTaskId", task.id);
  };

  const handleAssigneeSelect = (option: AssigneeOption) => {
    setValue("assignee", option.userId ?? '');
    setValue("assigneeResourceMemberId", option.resourceMemberId ?? undefined);
    setAssigneeSearchQuery("");
    setIsAssigneeDropdownOpen(false);
  };

  // Thêm xử lý phím ESC để đóng dropdown
  React.useEffect(() => {
    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsAssigneeDropdownOpen(false);
      }
    }
    document.addEventListener("keydown", handleEscapeKey);
    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, []);

  const handleAssignToMe = () => {
    if (user) {
      setValue("assignee", user.id);
      setValue("assigneeResourceMemberId", undefined);
    }
  };

  const handleClearAssignee = () => {
    setValue("assignee", "");
    setValue("assigneeResourceMemberId", undefined);
    setAssigneeSearchQuery("");
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6 bg-white p-6 rounded-lg shadow"
    >
      <div className="space-y-4">
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-700"
          >
            Title
          </label>
          <input
            {...register("title")}
            type="text"
            id="title"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="Enter task title"
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600">
              {errors.title.message as string}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700"
          >
            Description
          </label>
          <div className="mt-1">
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <AdvancedEditor
                  value={field.value || ''}
                  onChange={field.onChange}
                  placeholder="Mô tả task..."
                  mode="full"
                />
              )}
            />
          </div>
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">
              {errors.description.message as string}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="assignee"
            className="block text-sm font-medium text-gray-700"
          >
            Assignee
          </label>
          <div className="mt-1 relative">
            <div className="flex gap-2">
              <div className="relative flex-1" ref={assigneeRef}>
                <div
                  className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 cursor-pointer flex items-center"
                  onClick={() => setIsAssigneeDropdownOpen(true)}
                >
                  {selectedAssigneeMember ? (
                    <div className="flex items-center justify-between w-full">
                      <div className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                        <span>{selectedAssigneeMember.label}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClearAssignee();
                          }}
                          className="ml-2 text-blue-600 hover:text-blue-800"
                          title="Clear assignee"
                          aria-label="Clear assignee"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full">
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
                    </div>
                  )}
                  <div className="inset-y-0 right-0 flex items-center">
                    <svg
                      className="h-5 w-5 text-gray-400"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
                {isAssigneeDropdownOpen && (
                  <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    {filteredMembers.length > 0 ? (
                      filteredMembers.map((member) => (
                        <li
                          key={member.key}
                          onClick={() => handleAssigneeSelect(member)}
                          className="relative cursor-pointer select-none py-2 px-3 hover:bg-blue-50"
                        >
                          <div className="flex items-center">
                            {member.avatarUrl && (
                              <img
                                src={member.avatarUrl}
                                alt=""
                                className="h-6 w-6 rounded-full mr-2"
                              />
                            )}
                            <span>{member.label}</span>
                          </div>
                        </li>
                      ))
                    ) : (
                      <li className="relative py-2 px-3 text-gray-500">
                        Không tìm thấy thành viên nào
                      </li>
                    )}
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
          </div>
        </div>
        {errors.assignee && (
          <p className="mt-1 text-sm text-red-600">
            {errors.assignee.message as string}
          </p>
        )}

        <div>
          <label
            htmlFor="dueDate"
            className="block text-sm font-medium text-gray-700"
          >
            Due Date
          </label>
          <input
            {...register("dueDate")}
            type="datetime-local"
            id="dueDate"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          {errors.dueDate && (
            <p className="mt-1 text-sm text-red-600">
              {errors.dueDate.message as string}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="status"
            className="block text-sm font-medium text-gray-700"
          >
            Status
          </label>
          <div className="mt-1">
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <ComboboxField
                  options={statusOpts}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select status"
                />
              )}
            />
          </div>
          {errors.status && (
            <p className="mt-1 text-sm text-red-600">
              {errors.status.message as string}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="priority"
            className="block text-sm font-medium text-gray-700"
          >
            Priority
          </label>
          <div className="mt-1">
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <ComboboxField
                  options={priorityOpts}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select priority"
                />
              )}
            />
          </div>
          {errors.priority && (
            <p className="mt-1 text-sm text-red-600">
              {errors.priority.message as string}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="priorityOrder"
            className="block text-sm font-medium text-gray-700"
          >
            Priority Order
          </label>
          <input
            {...register("priorityOrder", {
              setValueAs: (value) => {
                const parsed = parseInt(value);
                return isNaN(parsed) ? 0 : parsed;
              },
            })}
            type="number"
            id="priorityOrder"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="Enter priority order"
          />
          {errors.priorityOrder && (
            <p className="mt-1 text-sm text-red-600">
              {errors.priorityOrder.message as string}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="progressType"
            className="block text-sm font-medium text-gray-700"
          >
            Progress Type
          </label>
          <div className="mt-1">
            <Controller
              name="progressCatalogItemId"
              control={control}
              render={({ field }) => (
                <ProjectCatalogSelect projectId={projectId} kind="PROGRESS_TYPE" label="Progress type" value={field.value || null} onChange={(value) => field.onChange(value || '')} />
              )}
            />
          </div>
          {errors.progressCatalogItemId && (
            <p className="mt-1 text-sm text-red-600">
              {errors.progressCatalogItemId.message as string}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="effort"
            className="block text-sm font-medium text-gray-700"
          >
            Effort (hours)
          </label>
          <input
            {...register("effort", {
              setValueAs: (value) => {
                const parsed = parseFloat(value);
                return isNaN(parsed) ? undefined : parsed;
              },
            })}
            type="number"
            id="effort"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="Enter estimated effort in hours"
            defaultValue={0}
            min={0}
            step="0.5"
          />
          {errors.effort && (
            <p className="mt-1 text-sm text-red-600">
              {errors.effort.message as string}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="category"
            className="block text-sm font-medium text-gray-700"
          >
            Category
          </label>
          <div className="mt-1">
            <Controller
              name="categoryCatalogItemId"
              control={control}
              render={({ field }) => (
                <ProjectCatalogSelect projectId={projectId} kind="CATEGORY" label="Category" value={field.value || null} onChange={(value) => field.onChange(value || '')} />
              )}
            />
          </div>
          {errors.categoryCatalogItemId && (
            <p className="mt-1 text-sm text-red-600">
              {errors.categoryCatalogItemId.message as string}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="type"
            className="block text-sm font-medium text-gray-700"
          >
            Type
          </label>
          <div className="mt-1">
            <Controller
              name="taskTypeCatalogItemId"
              control={control}
              render={({ field }) => (
                <ProjectCatalogSelect projectId={projectId} kind="TASK_TYPE" label="Task type" value={field.value || null} onChange={(value) => field.onChange(value || '')} />
              )}
            />
          </div>
          {errors.taskTypeCatalogItemId && (
            <p className="mt-1 text-sm text-red-600">
              {errors.taskTypeCatalogItemId.message as string}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tags
          </label>
          <p className="text-xs text-gray-500 mb-2">Nhấn Enter hoặc nhập dấu phẩy để thêm tag</p>
          <Controller
            name="tags"
            control={control}
            render={({ field }) => (
              <TagInput
                value={field.value || []}
                onChange={field.onChange}
              />
            )}
          />
          {errors.tags && (
            <p className="mt-1 text-sm text-red-600">
              {errors.tags.message as string}
            </p>
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
          disabled={createTaskLoading}
          className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 ${createTaskLoading
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-blue-700"
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
        >
          {createTaskLoading ? "Creating..." : "Create Task"}
        </button>
      </div>
    </form>
  );
}
