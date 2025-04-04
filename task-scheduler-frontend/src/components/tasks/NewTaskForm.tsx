"use client";

import React, { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { taskFormSchema, progressTypeOptions } from "@/schemas/taskForm";
import { TASK_TYPES, TASK_CATEGORIES, TASK_TAGS, Task } from "@/types/task";
import { mockTasks } from "@/data/mockTasks";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/hooks/useProject";
import { Combobox } from "@headlessui/react";
import { useMutation } from "@apollo/client";
import { CREATE_TASK } from "@/graphql/mutations";

// Dynamic import for React Quill
const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });
import "react-quill/dist/quill.snow.css";

interface NewTaskFormProps {
  projectId: string;
  parentTaskId?: string;
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
  status:
    | "todo"
    | "doing"
    | "done"
    | "close"
    | "pending"
    | "review"
    | "blocked"
    | "rejected"
    | "archived";
  priority: "low" | "medium" | "high" | "urgent" | "critical";
  priorityOrder: number;
}

interface ComboboxFieldProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ color: [] }, { background: [] }],
    ["link", "image"],
    ["clean"],
  ],
};

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
                `relative cursor-pointer select-none py-2 pl-3 pr-9 min-h-[40px] ${
                  active ? "bg-blue-50 text-gray-900" : "text-gray-900"
                }`
              }
            >
              {({ selected }) => (
                <>
                  <span
                    className={`block truncate ${
                      selected ? "font-semibold" : "font-normal"
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

export default function NewTaskForm({ projectId, parentTaskId }: NewTaskFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { data: projectData } = useProject(projectId);
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
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      tags: [],
      type: "",
      category: "",
      progressType: "study", // Default to first progress type
      effort: 0,
      status: "todo", // Default to first status
      priority: "medium",
      priorityOrder: 0,
    },
  });

  const selectedAssignee = watch("assignee");
  // Filter project members based on search query
  const filteredMembers = useMemo(() => {
    const members = projectData?.project?.members || [];
    let filtered = members;
    
    if (assigneeSearchQuery) {
      filtered = members.filter((member) => 
        member && member.user && member.user.username && 
        member.user.username.toLowerCase().includes(assigneeSearchQuery.toLowerCase())
      );
    }
    
    // Sắp xếp thành viên theo tên người dùng
    filtered = [...filtered].sort((a, b) => {
      if (!a.user || !b.user || !a.user.username || !b.user.username) return 0;
      return a.user.username.localeCompare(b.user.username);
    });
    
    // Limit the number of displayed members to 10
    return filtered.slice(0, 10);
  }, [projectData?.project?.members, assigneeSearchQuery]);
  
  // Get selected assignee member
  const selectedAssigneeMember = useMemo(() => {
    if (!selectedAssignee || !projectData?.project?.members) return null;
    return projectData.project.members.find(
      (m) => m.user.userId === selectedAssignee
    );
  }, [selectedAssignee, projectData?.project?.members]);

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

  const categoryOpts = useMemo(
    () =>
      TASK_CATEGORIES.map((category) => ({
        value: category,
        label: category,
      })),
    []
  );

  const typeOpts = useMemo(
    () =>
      TASK_TYPES.map((type) => ({
        value: type,
        label: type,
      })),
    []
  );

  const priorityOpts = useMemo(
    () => [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
      { value: "urgent", label: "Urgent" },
      { value: "critical", label: "Critical" },
    ],
    []
  );

  const statusOpts = useMemo(
    () => [
      { value: "todo", label: "Todo" },
      { value: "doing", label: "Doing" },
      { value: "done", label: "Done" },
      { value: "close", label: "Close" },
      { value: "pending", label: "Pending" },
      { value: "review", label: "Review" },
      { value: "blocked", label: "Blocked" },
      { value: "rejected", label: "Rejected" },
      { value: "archived", label: "Archived" },
    ],
    []
  );

  // Update progressTypeOpts to match backend enum
  const progressTypeOpts = useMemo(
    () => [
      { value: "study", label: "Study" },
      { value: "investigate", label: "Investigate" },
      { value: "code", label: "Code" },
      { value: "test", label: "Test" },
      { value: "review_code", label: "Review Code" },
      { value: "review_test_report", label: "Review Test Report" },
      { value: "release", label: "Release" },
    ],
    []
  );

  const onSubmit = async (data: TaskFormInputs) => {
    try {
      // Hiển thị trạng thái loading
      console.log('Submitting task with data:', data);

      // Chuẩn bị input cho GraphQL mutation
      const createTaskInput = {
        title: data.title,
        description: data.description || '',
        projectId: projectId,
        parentTaskId: parentTaskId || data.parentTaskId || null,
        status: data.status,
        priority: data.priority,
        priorityOrder: data.priorityOrder || 0,
        startDate: data.deadline ? new Date().toISOString() : null,
        deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
        assigneeId: data.assignee || null,
        effort: data.effort || 0,
        type: data.type || null,
        category: data.category || null,
        progressType: data.progressType || null,
        tags: data.tags || [],
      };

      // Gọi mutation để tạo task
      const result = await createTask({
        variables: {
          input: createTaskInput
        }
      });

      if (result.data?.createTask) {
        console.log('Task created successfully:', result.data.createTask);
        
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

  const handleAssigneeSelect = (userId: string, username: string) => {
    setValue("assignee", userId);
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
    }
  };

  const handleClearAssignee = () => {
    setValue("assignee", "");
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
                        <span>{selectedAssigneeMember.user.username}</span>
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
                          key={member.user.userId}
                          onClick={() =>
                            handleAssigneeSelect(member.user.userId, member.user.username)
                          }
                          className="relative cursor-pointer select-none py-2 px-3 hover:bg-blue-50"
                        >
                          <div className="flex items-center">
                            {member.user.avatarUrl && (
                              <img
                                src={member.user.avatarUrl}
                                alt=""
                                className="h-6 w-6 rounded-full mr-2"
                              />
                            )}
                            <span>{member.user.username}</span>
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

        <div>
          <label
            htmlFor="deadline"
            className="block text-sm font-medium text-gray-700"
          >
            Deadline
          </label>
          <input
            {...register("deadline")}
            type="datetime-local"
            id="deadline"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          {errors.deadline && (
            <p className="mt-1 text-sm text-red-600">
              {errors.deadline.message as string}
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
            <p className="mt-1 text-sm text-red-600">
              {errors.progressType.message as string}
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
            <p className="mt-1 text-sm text-red-600">
              {errors.category.message as string}
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
            <p className="mt-1 text-sm text-red-600">
              {errors.type.message as string}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags
          </label>
          <div className="mt-2 space-y-2 grid grid-cols-2 gap-4">
            {TASK_TAGS.map((tag) => (
              <label key={tag} className="inline-flex items-center">
                <input
                  type="checkbox"
                  value={tag}
                  {...register("tags")}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">{tag}</span>
              </label>
            ))}
          </div>
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
          className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 ${
            createTaskLoading
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
