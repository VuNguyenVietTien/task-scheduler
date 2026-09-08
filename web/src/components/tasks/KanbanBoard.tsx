'use client';

import { Task, TaskStatus, TaskStatuses } from '@/types/task';
import { useEffect, useState, useMemo, useRef, useCallback, MouseEvent as ReactMouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DragDropProvider,
  Droppable,
  Draggable,
  type DroppableProvided,
  type DraggableProvided,
  type DraggableStateSnapshot,
  type DropResult
} from '@/components/dnd/DragDropProvider';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { deleteTask, removeTasksFromTree, updateTaskStatus } from '@/redux/features/tasksSlice';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux/store';
import { UserInfo } from '@/types/members';
import Select, { SingleValue, MultiValue, ActionMeta, components } from 'react-select';
import makeAnimated from 'react-select/animated';
import { TaskDetail } from './TaskDetail';
import { useAuth } from '@/contexts/AuthContext';
import {
  KANBAN_COLUMNS,
  flattenKanbanTasks,
  getKanbanStatus,
  updateKanbanTaskInTree,
} from './kanban-tasks';
import { getStatusLabel } from '@/constants/task-display-labels';
import { filterTaskTreeByStatus, isTaskStatusVisible } from '@/utils/task-status-visibility';
import { taskDeletionConfirmationMessage } from '@/utils/task-deletion';

interface KanbanBoardProps {
  tasks: Task[];
  onTasksReorder?: (tasks: Task[]) => void;
  projectId: string;
}

interface UserOption {
  value: string;
  label: string;
}

interface StatusOption {
  value: TaskStatus;
  label: string;
}

// Tạo component cho animated select
const animatedComponents = makeAnimated();

// Khoá lưu trữ cho localStorage
const KANBAN_SELECTED_USER_KEY = 'kanban_selected_user';
const KANBAN_SELECTED_STATUSES_KEY = 'kanban_selected_statuses';

// Hàm helper để lấy dữ liệu từ localStorage
const getStoredValue = <T,>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  
  try {
    const storedValue = localStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : defaultValue;
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return defaultValue;
  }
};

// Hàm helper để lưu dữ liệu vào localStorage
const storeValue = <T,>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Error writing to localStorage:', error);
  }
};

// Compare the complete forest so a descendant update is not discarded as a root-only no-op.
const areTasksEqual = (tasksA: Task[], tasksB: Task[]): boolean => {
  const rowsA = flattenKanbanTasks(tasksA);
  const rowsB = flattenKanbanTasks(tasksB);
  return rowsA.length === rowsB.length && rowsA.every(({ task, parent }, index) => {
    const other = rowsB[index];
    return task.task_id === other.task.task_id &&
      parent?.task_id === other.parent?.task_id &&
      task.status === other.task.status &&
      task.priority === other.task.priority &&
      task.assignee?.userId === other.task.assignee?.userId;
  });
};

export function KanbanBoard({ tasks, onTasksReorder, projectId }: KanbanBoardProps) {
  const { t } = useTranslation();
  // Khởi tạo state từ localStorage nếu có hoặc giá trị mặc định
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(
    getStoredValue<UserOption | null>(KANBAN_SELECTED_USER_KEY, null)
  );
  const [selectedStatuses, setSelectedStatuses] = useState<StatusOption[]>(
    getStoredValue<StatusOption[]>(KANBAN_SELECTED_STATUSES_KEY, [])
  );
  
  const [clonedTasks, setClonedTasks] = useState<Task[]>(tasks);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const isDragRef = useRef(false);
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  
  // Thêm refs và state để tính toán chiều cao
  const kanbanContainerRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [columnHeight, setColumnHeight] = useState<number>(0);
  
  // Đăng ký theo dõi thay đổi từ Redux store
  const tasksState = useSelector((state: RootState) => state.tasks);
  
  // Lấy danh sách thành viên từ Redux store
  const { members, loading: membersLoading } = useSelector((state: RootState) => state.members);
  
  const statusOptions = useMemo<StatusOption[]>(() => KANBAN_COLUMNS.map(({ id }) => ({
    value: id,
    label: getStatusLabel(id),
  })), [t]);

  const visibleColumns = useMemo(() => {
    const selected = selectedStatuses.map(({ value }) => value);
    return statusOptions
      .filter((column) => isTaskStatusVisible(column.value, selected))
      .map(({ value, label }) => ({ id: value, title: label }));
  }, [selectedStatuses, statusOptions]);

  // Filter the authoritative tree first, then flatten once without losing descendants.
  const filteredTasks = useMemo(() => {
    let result = flattenKanbanTasks(filterTaskTreeByStatus(
      clonedTasks,
      selectedStatuses.map(({ value }) => value)
    ));
    if (selectedUser && selectedUser.value !== 'all') {
      result = result.filter(({ task }) => task.assignee?.userId === selectedUser.value);
    }
    return result;
  }, [clonedTasks, selectedUser, selectedStatuses]);
  
  // Hàm tính toán chiều cao của columns
  const calculateColumnHeight = useCallback(() => {
    if (!kanbanContainerRef.current) return;
    
    // Lấy chiều cao của window
    const windowHeight = window.innerHeight;
    
    // Lấy vị trí top của container so với top của window
    const containerTop = kanbanContainerRef.current.getBoundingClientRect().top;
    
    // Tính minHeight = windowHeight - containerTop - padding dưới
    const minHeight = windowHeight - containerTop - 20; // 20px for bottom padding
    
    // Tìm column có height lớn nhất
    let maxColumnHeight = 0;
    Object.values(columnsRef.current).forEach(column => {
      if (column) {
        // Lấy chiều cao thực của toàn bộ column bao gồm tất cả task cards
        const totalHeight = column.scrollHeight;
        maxColumnHeight = Math.max(maxColumnHeight, totalHeight);
      }
    });
    
    // Chọn giá trị lớn hơn giữa minHeight và maxColumnHeight
    const optimalHeight = Math.max(minHeight, maxColumnHeight);
    
    // Cập nhật state
    setColumnHeight(optimalHeight);
  }, []);
  
  // Tính toán chiều cao khi component mount và khi resize window
  useEffect(() => {
    // Tính toán ban đầu
    calculateColumnHeight();
    
    // Đăng ký sự kiện resize
    window.addEventListener('resize', calculateColumnHeight);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', calculateColumnHeight);
    };
  }, [calculateColumnHeight]);
  
  // Tính lại chiều cao khi filteredTasks thay đổi (có task mới)
  useEffect(() => {
    // Đợi một chút cho DOM cập nhật
    const timeoutId = setTimeout(calculateColumnHeight, 100);
    return () => clearTimeout(timeoutId);
  }, [filteredTasks, visibleColumns, calculateColumnHeight]);
  
  // Lưu lựa chọn user vào localStorage khi thay đổi
  useEffect(() => {
    storeValue(KANBAN_SELECTED_USER_KEY, selectedUser);
  }, [selectedUser]);
  
  // Lưu lựa chọn statuses vào localStorage khi thay đổi
  useEffect(() => {
    storeValue(KANBAN_SELECTED_STATUSES_KEY, selectedStatuses);
  }, [selectedStatuses]);
  
  // Tối ưu hàm cập nhật clonedTasks bằng useCallback
  const updateClonedTasks = useCallback((newTasks: Task[]) => {
    setClonedTasks(prevTasks => {
      // Chỉ cập nhật nếu có thay đổi thực sự
      return areTasksEqual(prevTasks, newTasks) ? prevTasks : newTasks;
    });
  }, []);
  
  // Cập nhật từ Redux store hoặc từ props
  useEffect(() => {
    // Ưu tiên dữ liệu từ Redux store nếu có
    if (tasksState.tasks.length > 0) {
      // Lọc tasks theo projectId hiện tại
      const projectTasks = tasksState.tasks.filter(task => task.project_id === projectId);
      if (projectTasks.length > 0) {
        updateClonedTasks(projectTasks);
        return;
      }
    }
    
    // Fallback sử dụng tasks từ props nếu không có dữ liệu từ Redux
    updateClonedTasks(tasks);
  }, [tasks, tasksState, projectId, updateClonedTasks]);

  // Tạo danh sách lựa chọn users từ members
  const userOptions: UserOption[] = useMemo(() => {
    const options = members.map(member => ({
      value: member.user.userId,
      label: member.user.username
    }));
    
    // Thêm option "Tất cả" vào đầu danh sách
    return [{ value: 'all', label: t('common.all') }, ...options];
  }, [members]);

  // Lắng nghe sự kiện khi task status được cập nhật từ nơi khác
  useEffect(() => {
    const handleTaskStatusUpdate = (event: CustomEvent) => {
      if (!event.detail) return;
      const { taskId, newStatus } = event.detail;
      
      console.log('Task status updated externally:', { taskId, newStatus });
      
      setClonedTasks(prevTasks =>
        updateKanbanTaskInTree(prevTasks, taskId, { status: newStatus })
      );
    };

    // Add event listener
    window.addEventListener('task-status-updated', handleTaskStatusUpdate as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('task-status-updated', handleTaskStatusUpdate as EventListener);
    };
  }, []);

  // Handle task card click: left click -> modal, ctrl/middle -> new tab
  const handleTaskCardClick = useCallback((e: ReactMouseEvent, task: Task) => {
    // Skip if this click is the end of a drag
    if (isDragRef.current) return;

    if (e.ctrlKey || e.metaKey || e.button === 1) {
      e.preventDefault();
      window.open(`/projects/${task.project_id}/tasks/${task.task_id}`, '_blank');
      return;
    }
    setSelectedTask(task);
    setIsTaskDetailOpen(true);
  }, []);

  // Sync modal changes back to kanban state
  const handleTaskDetailUpdate = useCallback((taskId: string, updates: Partial<Task>) => {
    setSelectedTask(prev => prev ? { ...prev, ...updates } : null);
    setClonedTasks(prev => updateKanbanTaskInTree(prev, taskId, updates));
  }, []);

  const getTasksByStatus = (status: TaskStatus) => {
    return filteredTasks.filter(({ task }) => getKanbanStatus(task.status) === status);
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatuses.DONE:
        return 'border-green-500';
      case TaskStatuses.DOING:
        return 'border-blue-500';
      case TaskStatuses.REVIEW:
        return 'border-purple-500';
      case TaskStatuses.PENDING:
        return 'border-amber-500';
      case TaskStatuses.BLOCKED:
        return 'border-red-500';
      default:
        return 'border-slate-500';
    }
  };

  const getColumnGradient = (status: TaskStatus) => {
    switch (status) {
      case TaskStatuses.TODO:
        return 'bg-gradient-to-b from-slate-50 to-slate-100';
      case TaskStatuses.DOING:
        return 'bg-gradient-to-b from-blue-50 to-blue-100/60';
      case TaskStatuses.REVIEW:
        return 'bg-gradient-to-b from-purple-50 to-purple-100/60';
      case TaskStatuses.PENDING:
        return 'bg-gradient-to-b from-amber-50 to-amber-100/60';
      case TaskStatuses.BLOCKED:
        return 'bg-gradient-to-b from-red-50 to-red-100/60';
      case TaskStatuses.DONE:
        return 'bg-gradient-to-b from-green-50 to-green-100/60';
      default:
        return 'bg-gradient-to-b from-slate-50 to-slate-100';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toUpperCase()) {
      case 'URGENT':
      case 'CRITICAL':
        return 'text-red-600 bg-red-50';
      case 'HIGH':
        return 'text-orange-600 bg-orange-50';
      case 'MEDIUM':
        return 'text-amber-600 bg-amber-50';
      case 'LOW':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-slate-600 bg-slate-50';
    }
  };

  const handleDragEnd = (result: DropResult) => {
    // Mark drag as ended with a small delay so onClick doesn't fire
    setTimeout(() => { isDragRef.current = false; }, 0);
    if (!result.destination) return;

    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId as TaskStatus;
    const previousStatus = result.source.droppableId as TaskStatus;

    // Không làm gì nếu kéo thả vào cùng cột
    if (newStatus === previousStatus) return;

    console.log(`Dragging task ${taskId} from ${previousStatus} to ${newStatus}`);

    if (newStatus === TaskStatuses.REJECTED) {
      const task = flattenKanbanTasks(clonedTasks).find((item) => item.task.task_id === taskId)?.task;
      if (!task || !window.confirm(taskDeletionConfirmationMessage(task, 'reject'))) return;
      dispatch(deleteTask({ taskId }))
        .unwrap()
        .then((result) => {
          setClonedTasks((current) => removeTasksFromTree(current, result.deletedTaskIds));
          setSelectedTask((current) => current && result.deletedTaskIds.includes(current.task_id) ? null : current);
          setIsTaskDetailOpen(false);
          window.dispatchEvent(new CustomEvent('show-notification', {
            detail: { type: 'success', message: 'Task deleted.' },
          }));
        })
        .catch(() => window.dispatchEvent(new CustomEvent('show-notification', {
          detail: { type: 'error', message: 'Could not delete task.' },
        })));
      return;
    }

    // Optimistically update the matching node without flattening its tree.
    const optimisticTasks = updateKanbanTaskInTree(clonedTasks, taskId, { status: newStatus });
    setClonedTasks(optimisticTasks);

    // Sử dụng Redux dispatch thay vì gọi mutation trực tiếp
    // Điều này đảm bảo thống nhất với cách xử lý trong TaskListView
    dispatch(updateTaskStatus({
      taskId,
      status: newStatus
    }))
    .unwrap()
    .then(({ task }) => {
      console.log('Task status updated successfully via Redux');
      const confirmedTasks = updateKanbanTaskInTree(optimisticTasks, taskId, task);
      setClonedTasks(prevTasks => updateKanbanTaskInTree(prevTasks, taskId, task));

      // Call onTasksReorder callback if provided
      if (onTasksReorder) {
        onTasksReorder(confirmedTasks);
      }
      
      // Dispatch một event thông báo cập nhật thành công
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'success',
          message: t('kanban.statusUpdated')
        }
      });
      window.dispatchEvent(event);
    })
    .catch(error => {
      console.error('Failed to update task status:', error);
      
      // Revert UI changes on error
      setClonedTasks(prevTasks =>
        updateKanbanTaskInTree(prevTasks, taskId, { status: previousStatus })
      );
      
      // Show error notification
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'error',
          message: t('kanban.statusUpdateFailed')
        }
      });
      window.dispatchEvent(event);
    });
  };

  // Tuỳ chỉnh style cho Select
  const customStyles = {
    control: (provided: any) => ({
      ...provided,
      minHeight: '36px',
      height: '36px',
      minWidth: '300px',
      width: '100%',
    }),
    valueContainer: (provided: any) => ({
      ...provided,
      height: '36px',
      padding: '0 6px',
    }),
    input: (provided: any) => ({
      ...provided,
      margin: '0px',
    }),
    indicatorsContainer: (provided: any) => ({
      ...provided,
      height: '36px',
    }),
    option: (provided: any, state: any) => ({
      ...provided,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 12px',
    }),
    container: (provided: any) => ({
      ...provided,
      width: '300px',
    }),
  };
  
  // Tùy chỉnh component Option để hiển thị dấu check
  const Option = (props: any) => {
    const { isSelected, data, selectOption } = props;
    return (
      <div 
        className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-100 ${isSelected ? 'bg-blue-50 text-blue-700' : ''}`}
        onClick={() => selectOption(data)}
      >
        <span>{data.label}</span>
        {isSelected && (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        )}
      </div>
    );
  };
  
  // Tùy chỉnh MultiValueContainer để không hiển thị tag đã chọn
  const MultiValueContainer = () => {
    return null;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-2 flex flex-col gap-2 p-3">
        <div className="flex items-center gap-6">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t('tasks.colAssignee')}:</label>
            <Select<UserOption, false>
              className="basic-select"
              classNamePrefix="select"
              value={selectedUser}
              onChange={(newValue) => setSelectedUser(newValue)}
              options={userOptions}
              isLoading={membersLoading}
              isClearable
              placeholder={t('common.all')}
              components={{
                ...animatedComponents,
                Option
              }}
              styles={customStyles}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t('tasks.colStatus')}:</label>
            <Select<StatusOption, true>
              className="basic-select"
              classNamePrefix="select"
              isMulti
              value={selectedStatuses}
              onChange={(newValue) => setSelectedStatuses(newValue as StatusOption[])}
              options={statusOptions}
              components={{
                ...animatedComponents,
                MultiValueContainer,
                Option
              }}
              placeholder={t('common.all')}
              styles={customStyles}
              hideSelectedOptions={false}
              closeMenuOnSelect={false}
            />
          </div>
        </div>
        
        {/* Hiển thị tag trạng thái được chọn ở dưới combobox status */}
        {selectedStatuses.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 ml-[306px]">
            {selectedStatuses.map(status => (
              <span 
                key={status.value} 
                className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800"
              >
                {status.label}
                <button
                  type="button"
                  className="ml-1 flex-shrink-0 h-4 w-4 rounded-full inline-flex items-center justify-center text-blue-800 hover:bg-blue-200 hover:text-blue-900 focus:outline-none"
                  onClick={() => {
                    setSelectedStatuses(selectedStatuses.filter(s => s.value !== status.value));
                  }}
                >
                  <span className="sr-only">{t('kanban.removeFilter')} {status.label}</span>
                  <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                    <path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      
      <DragDropProvider onDragStart={() => { isDragRef.current = true; }} onDragEnd={handleDragEnd}>
        <div 
          ref={kanbanContainerRef}
          className="flex gap-4 overflow-x-auto pb-8"
        >
          {visibleColumns.map(column => (
            <div 
              key={column.id} 
              className="min-w-[280px] max-w-[280px] flex flex-col"
              ref={el => {
                columnsRef.current[column.id] = el;
              }}
              style={{ 
                minHeight: `${columnHeight}px`,
              }}
            >
              <div 
                className={`rounded-lg p-4 flex flex-col ${getColumnGradient(column.id)} shadow-sm h-full overflow-visible`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-slate-900">{column.title}</h3>
                  <span className="text-sm text-slate-600">
                    {getTasksByStatus(column.id).length}
                  </span>
                </div>

                <Droppable droppableId={column.id}>
                  {(provided: DroppableProvided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`rounded-lg transition-colors duration-200 flex-1 column-content
                        ${snapshot.isDraggingOver 
                          ? 'outline outline-2 outline-blue-400 outline-dashed bg-blue-50/70' 
                          : 'bg-transparent'
                        }`}
                      style={{ overflow: 'visible' }}
                    >
                      <div className="space-y-3 p-2">
                        {getTasksByStatus(column.id).map(({ task, depth, parent }, index) => (
                          <Draggable
                            key={task.task_id}
                            draggableId={task.task_id}
                            index={index}
                            isDragDisabled={updateTaskStatusMutation.isLoading}
                          >
                            {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                data-task-id={task.task_id}
                                data-task-depth={depth}
                                data-parent-task-id={parent?.task_id ?? ''}
                                className={`p-3 rounded-lg border-l-4 bg-white
                                  ${getStatusColor(task.status)}
                                  ${snapshot.isDragging 
                                    ? 'shadow-lg ring-2 ring-blue-400 rotate-[1deg]' 
                                    : 'shadow-sm hover:shadow-md'
                                  }
                                  ${updateTaskStatusMutation.isLoading && updateTaskStatusMutation.variables?.taskId === task.task_id
                                    ? 'animate-pulse'
                                    : ''
                                  }
                                  cursor-grab active:cursor-grabbing
                                  transition-all duration-200`}
                                onClick={(e) => handleTaskCardClick(e, task)}
                                onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); handleTaskCardClick(e, task); } }}
                              >
                                {parent && (
                                  <div className="mb-1 truncate text-xs text-slate-500" title={parent.title}>
                                    ↳ {parent.title}
                                  </div>
                                )}
                                <div className="flex items-start justify-between mb-2">
                                  <h4 className="font-medium text-slate-900 truncate flex-1">
                                    {task.title}
                                  </h4>
                                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium shrink-0 ${getPriorityColor(task.priority)}`}>
                                    {task.priority}
                                  </span>
                                </div>

                                <div className="flex justify-between items-center">
                                  <div className="flex -space-x-2">
                                    {task.assignee && (
                                      <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-xs text-blue-700 ring-2 ring-white">
                                        {task.assignee.username.charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {task.due_date && 
                                      `Due ${new Date(task.due_date).toLocaleDateString()}`
                                    }
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              </div>
            </div>
          ))}
        </div>
      </DragDropProvider>

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          isOpen={isTaskDetailOpen}
          onClose={() => setIsTaskDetailOpen(false)}
          onTaskUpdate={handleTaskDetailUpdate}
          currentUser={user || undefined}
          projectMembers={members}
        />
      )}
    </div>
  );
}
