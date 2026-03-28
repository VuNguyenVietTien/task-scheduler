import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@apollo/client';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import Link from 'next/link';
import { PencilIcon } from '@heroicons/react/24/solid';
import { 
  Task, 
  TaskStatus, 
  Priority,
  TaskStatuses,
  Priorities
} from '@/types/task';
import { GET_TASK_SUBTASKS } from '@/graphql/queries/tasks';
import {
  updateTaskStatus,
  updateTaskPriority,
  updateTaskEffort,
  updateTaskAssignee
} from '@/redux/features/tasksSlice';
import { fetchSubtasks } from '@/redux/features/taskDetailSlice';
import { UserAvatar } from '@/components/common/UserAvatar';

interface TaskDetailSubtasksProps {
  taskId: string;
  projectId: string;
}

// Thêm cache TimeToLive để kiểm soát thời gian cache
const CACHE_TTL = 30000; // 30 giây

export default function TaskDetailSubtasks({ taskId, projectId }: TaskDetailSubtasksProps) {
  // Sử dụng useRef để theo dõi các giá trị trước đó
  const prevTaskIdRef = React.useRef<string | null>(null);
  const fetchTimesRef = useRef<{[key: string]: number}>({});
  const isApiInProgressRef = useRef<{[key: string]: boolean}>({});
  
  console.log('[TaskDetailSubtasks] Rendering with taskId:', taskId, 'projectId:', projectId, 'prevTaskId:', prevTaskIdRef.current);
  
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [editingCell, setEditingCell] = useState<{taskId: string, field: string} | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isLoadingSubtasks, setIsLoadingSubtasks] = useState(false);
  const [originalSubtasks, setOriginalSubtasks] = useState<Task[]>([]);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  
  // Redux Dispatch
  const dispatch = useAppDispatch();

  // Lấy subtasks từ Redux store
  const { subtasks: reduxSubtasks, loadingSubtasks: reduxLoading } = useAppSelector(state => state.taskDetail);
  
  // Lấy danh sách members từ Redux store
  const { members: reduxMembers } = useAppSelector(state => state.members);

  // Kiểm tra xem API call có đang trong tiến trình
  const isApiCallInProgress = useCallback((key: string): boolean => {
    return !!isApiInProgressRef.current[key];
  }, []);

  // Kiểm tra xem có nên gọi API không dựa vào thời gian cache
  const shouldFetchData = useCallback((key: string): boolean => {
    const now = Date.now();
    const lastFetchTime = fetchTimesRef.current[key] || 0;
    return now - lastFetchTime > CACHE_TTL;
  }, []);

  // Đánh dấu API call là đang trong tiến trình
  const markApiCallStart = useCallback((key: string): void => {
    isApiInProgressRef.current[key] = true;
  }, []);

  // Đánh dấu API call đã hoàn thành
  const markApiCallEnd = useCallback((key: string): void => {
    isApiInProgressRef.current[key] = false;
    fetchTimesRef.current[key] = Date.now();
  }, []);

  // Tạo function so sánh để thay thế useMemo trong useEffect nếu có
  const compareSubtaskArrays = (current: Task[], redux: Task[]): boolean => {
    // Tính toán sự khác biệt dựa trên ID thay vì toàn bộ object để tránh re-render không cần thiết
    const currentSubtaskIds = current.map(task => task.task_id).sort().join(',');
    const reduxSubtaskIds = redux.map(task => task.task_id).sort().join(',');
    return currentSubtaskIds !== reduxSubtaskIds;
  };

  // Chỉ fetch subtasks khi cần thiết
  const fetchSubtasksIfNeeded = useCallback(() => {
    const subtasksKey = `subtasks_${taskId}`;
    
    if (!taskId) return;
    
    if (!isApiCallInProgress(subtasksKey) && shouldFetchData(subtasksKey)) {
      console.log(`[TaskDetailSubtasks] Fetching subtasks for task: ${taskId}`);
      setIsLoadingSubtasks(true);
      markApiCallStart(subtasksKey);
      
      dispatch(fetchSubtasks(taskId))
        .then(() => {
          console.log(`[TaskDetailSubtasks] Successfully fetched subtasks for: ${taskId}`);
          setIsLoadingSubtasks(false);
          markApiCallEnd(subtasksKey);
        })
        .catch(error => {
          console.error(`[TaskDetailSubtasks] Error fetching subtasks:`, error);
          setIsLoadingSubtasks(false);
          markApiCallEnd(subtasksKey);
        });
    } else {
      console.log(`[TaskDetailSubtasks] Using cached subtasks data for: ${taskId}`);
    }
  }, [taskId, dispatch, isApiCallInProgress, shouldFetchData, markApiCallStart, markApiCallEnd]);

  // Query để lấy subtasks - chỉ chạy khi thực sự cần thiết
  const { loading: subtasksLoading, data: subtasksData, refetch: refetchSubtasks } = 
    useQuery(GET_TASK_SUBTASKS, {
      variables: { taskId },
      skip: !taskId || // Skip nếu không có taskId
            reduxSubtasks.length > 0 || // Skip nếu đã có dữ liệu trong Redux
            isApiCallInProgress(`subtasks_${taskId}`), // Skip nếu API đang được gọi
      fetchPolicy: 'cache-and-network', // Sử dụng cache trước, sau đó tự động cập nhật khi network response trả về
      onCompleted: (data) => {
        console.log('[TaskDetailSubtasks] GET_TASK_SUBTASKS completed:', data?.taskSubtasks?.length || 0, 'subtasks found');
        if (data && data.taskSubtasks) {
          // Chuyển đổi dữ liệu từ camelCase sang snake_case
          const formattedSubtasks = data.taskSubtasks.map((subtask: any) => ({
            task_id: subtask.taskId,
            id: subtask.taskId,
            title: subtask.title || '',
            description: subtask.description || '',
            status: (subtask.status?.toUpperCase() || 'TODO') as TaskStatus,
            priority: (subtask.priority?.toUpperCase() || 'MEDIUM') as Priority,
            effort: subtask.effort || 0,
            progress: subtask.progress || 0,
            start_date: subtask.startDate || null,
            due_date: subtask.dueDate || null,
            assignee: subtask.assignee ? {
              userId: subtask.assignee.userId,
              username: subtask.assignee.username,
              avatarUrl: subtask.assignee.avatarUrl || '',
              role: subtask.assignee.role || ''
            } : undefined,
            assignee_id: subtask.assignee?.userId, // Thêm assignee_id để phục vụ cho việc cập nhật
            priority_order: subtask.priorityOrder || 0,
            type: subtask.type || null,
            category: subtask.category || null,
            project_id: projectId
          }));
          
          setSubtasks(formattedSubtasks);
          setIsLoadingSubtasks(false);
          
          // Cập nhật thời gian fetch cuối cùng
          setLastFetchTime(Date.now());
          markApiCallEnd(`subtasks_${taskId}`);
        }
      },
      onError: (error) => {
        console.error('[TaskDetailSubtasks] Error fetching subtasks:', error);
        setIsLoadingSubtasks(false);
        markApiCallEnd(`subtasks_${taskId}`);
      }
    });
    
  // Chỉ fetch data khi taskId thay đổi và chưa có dữ liệu
  useEffect(() => {
    if (!taskId) return;
    
    const isTaskIdChanged = prevTaskIdRef.current !== taskId;
    if (isTaskIdChanged) {
      console.log('[TaskDetailSubtasks] Task ID changed from', prevTaskIdRef.current, 'to', taskId);
      prevTaskIdRef.current = taskId;
      
      // Reset trạng thái cache khi taskId thay đổi để đảm bảo dữ liệu mới
      if (isTaskIdChanged) {
        fetchTimesRef.current = {};
        isApiInProgressRef.current = {};
      }
      
      // Nếu taskId thay đổi, kiểm tra xem có dữ liệu trong Redux không
      // Nếu có thì sử dụng, nếu không thì fetch mới
      if (reduxSubtasks.length > 0) {
        // Kiểm tra xem reduxSubtasks có thuộc về task hiện tại không
        const isForCurrentTask = reduxSubtasks.some(
          subtask => subtask.parent_task_id === taskId
        );
        
        if (isForCurrentTask) {
          console.log('[TaskDetailSubtasks] Using cached subtasks from Redux store for new taskId');
          setSubtasks(reduxSubtasks);
        } else {
          // Nếu không phải dữ liệu cho task hiện tại, fetch mới
          fetchSubtasksIfNeeded();
        }
      } else {
        console.log('[TaskDetailSubtasks] No cached subtasks for new taskId, will fetch from API');
        fetchSubtasksIfNeeded();
      }
    }
  }, [taskId, reduxSubtasks, fetchSubtasksIfNeeded]);
  
  // Sử dụng hàm so sánh thay vì useMemo bên trong useEffect
  useEffect(() => {
    // Chỉ cập nhật nếu có sự thay đổi thực sự và không phải là kết quả của action mới
    const hasChanged = compareSubtaskArrays(subtasks, reduxSubtasks);
    if (hasChanged && 
        reduxSubtasks.length > 0 && 
        !isApiCallInProgress(`subtasks_${taskId}`)) {
      console.log('[TaskDetailSubtasks] Updating subtasks from Redux store due to changes:', {
        localCount: subtasks.length,
        reduxCount: reduxSubtasks.length
      });
      setSubtasks(reduxSubtasks);
    }
  }, [
    reduxSubtasks, 
    taskId,
    subtasks,
    isApiCallInProgress
  ]);

  // Tối ưu hóa logic xử lý khi component mount và unmount
  useEffect(() => {
    // Đánh dấu component đã mount
    const isSubtasksComponentMounted = true;
    
    return () => {
      // Khi component unmount, đánh dấu rằng chúng ta đang chuyển đổi task
      console.log('[TaskDetailSubtasks] Component unmounting, possibly navigating to a new task');
      
      // Xóa các trạng thái API call in-progress để không ảnh hưởng đến lần render tiếp theo
      for (const key in isApiInProgressRef.current) {
        if (key.startsWith(`subtasks_${taskId}`)) {
          console.log(`[TaskDetailSubtasks] Clearing API call state for: ${key}`);
          isApiInProgressRef.current[key] = false;
        }
      }
    };
  }, [taskId]);

  // Cập nhật getTaskLink để xác định nếu đang chuyển đến task con
  const getTaskLink = useCallback((subtask: any) => {
    // Tạo đường dẫn đầy đủ để xem chi tiết subtask, bao gồm projectId
    const taskLink = `/projects/${projectId}/tasks/${subtask.task_id}`;
    
    // Thêm tham số để đánh dấu đây là chuyển từ task cha sang task con
    return `${taskLink}?from=parent&parentId=${taskId}`;
  }, [projectId, taskId]);

  // Cài đặt cơ chế để tối ưu việc fetch dữ liệu khi chuyển từ parent task
  useEffect(() => {
    // Nếu component được mount sau khi navigate từ parent task
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const fromParent = url.searchParams.get('from') === 'parent';
      const parentId = url.searchParams.get('parentId');
      
      if (fromParent && parentId) {
        console.log(`[TaskDetailSubtasks] Detected navigation from parent task: ${parentId} to child task: ${taskId}`);
        
        // Chỉ fetch dữ liệu nếu thực sự cần thiết và không phải ngay lập tức
        // Điều này giúp tránh việc fetch trùng lặp
        setTimeout(() => {
          if (reduxSubtasks.length === 0 && !isApiCallInProgress(`subtasks_${taskId}`)) {
            console.log(`[TaskDetailSubtasks] Delayed fetch for subtasks after parent-child navigation`);
            fetchSubtasksIfNeeded();
          }
        }, 1000); // Delay 1 giây để tránh nhiều API calls đồng thời
      }
    }
  }, [taskId, reduxSubtasks.length, isApiCallInProgress, fetchSubtasksIfNeeded]);

  // Tạo các hàm utility với useCallback để tránh re-render không cần thiết

  // Màu sắc trạng thái
  const getStatusColor = useCallback((status: TaskStatus) => {
    const colors: Record<string, string> = {
      'TODO': 'bg-gray-100 text-gray-800',
      'DOING': 'bg-blue-100 text-blue-800',
      'DONE': 'bg-green-100 text-green-800',
      'CLOSE': 'bg-green-100 text-green-800',
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'REVIEW': 'bg-purple-100 text-purple-800',
      'BLOCKED': 'bg-red-100 text-red-800',
      'REJECTED': 'bg-red-100 text-red-800',
      'ARCHIVED': 'bg-gray-100 text-gray-800',
    };
    return colors[status] || colors['TODO'];
  }, []);

  // Màu sắc ưu tiên
  const getPriorityColor = useCallback((priority: Priority) => {
    const colors: Record<string, string> = {
      'LOW': 'bg-green-100 text-green-800',
      'MEDIUM': 'bg-yellow-100 text-yellow-800',
      'HIGH': 'bg-orange-100 text-orange-800',
      'URGENT': 'bg-red-100 text-red-800',
      'CRITICAL': 'bg-red-100 text-red-800 font-bold',
    };
    return colors[priority] || colors['MEDIUM'];
  }, []);

  // Handler cho việc edit subtask
  const handleStartEditing = useCallback((taskId: string, field: string, currentValue: string | number | null) => {
    setEditingCell({ taskId, field });
    setEditValue(currentValue !== null ? String(currentValue) : '');
  }, []);

  const handleCancelEditing = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  // Hàm xử lý khi thay đổi trạng thái task - tối ưu với useCallback
  const handleTaskStatusChange = useCallback(async (taskId: string, newStatus: TaskStatus, e?: React.MouseEvent) => {
    try {
      if (e) {
      e.preventDefault();
      e.stopPropagation();
      }

      // Tạo một bản sao của trạng thái hiện tại để khôi phục nếu cần
      const subtasksCopy = [...subtasks];
      setOriginalSubtasks(subtasksCopy);
      
      // Optimistic update - cập nhật UI ngay lập tức
      setSubtasks(currentSubtasks => 
        currentSubtasks.map(subtask => {
          if (subtask.task_id === taskId || subtask.id === taskId) {
            return { ...subtask, status: newStatus };
          }
          return subtask;
        })
      );
      
      console.log(`[TaskDetailSubtasks] Updating task ${taskId} status to ${newStatus}`);
      
      // Đánh dấu API đang được gọi
      const apiKey = `update_status_${taskId}`;
      markApiCallStart(apiKey);
      
      // Gọi API để cập nhật trạng thái
      const result = await dispatch(updateTaskStatus({ 
        taskId, 
        status: newStatus 
      })).unwrap();
      
      console.log('[TaskDetailSubtasks] Status update result:', result);
      markApiCallEnd(apiKey);
    } catch (error) {
      console.error('[TaskDetailSubtasks] Error updating task status:', error);
      
      // Khôi phục UI nếu có lỗi
      setSubtasks(originalSubtasks);
      
      // Hiển thị thông báo lỗi
      alert(`Không thể cập nhật trạng thái task. Lỗi: ${error}`);
    }
  }, [dispatch, subtasks, originalSubtasks, markApiCallStart, markApiCallEnd]);

  // Hàm xử lý khi thay đổi mức độ ưu tiên task
  const handleTaskPriorityChange = async (taskId: string, newPriority: Priority, e?: React.MouseEvent) => {
    try {
      if (e) {
      e.preventDefault();
      e.stopPropagation();
      }

      // Lưu lại subtasks hiện tại để khôi phục nếu API call thất bại
      const originalSubtasks = [...subtasks];
      
      // Cập nhật UI trước (optimistic update) để tăng UX
      setSubtasks(currentSubtasks => 
        currentSubtasks.map(subtask => {
          if (subtask.task_id === taskId || subtask.id === taskId) {
            return { ...subtask, priority: newPriority };
          }
          return subtask;
        })
      );
      
      console.log(`Đang gửi request cập nhật mức độ ưu tiên task ${taskId} thành ${newPriority}`);
      
      // Dispatch action để gọi API update task
      const result = await dispatch(updateTaskPriority({ 
        taskId, 
        priority: newPriority 
      })).unwrap();
      
      console.log('Kết quả cập nhật mức độ ưu tiên:', result);
      
      // KHÔNG cần fetch lại subtasks vì optimistic update đã cập nhật UI
      // và Redux store đã cập nhật data
    } catch (error) {
      console.error('Lỗi khi cập nhật mức độ ưu tiên:', error);
      
      // Khôi phục UI về trạng thái ban đầu nếu có lỗi
      setSubtasks(originalSubtasks);
      
      // Hiển thị thông báo lỗi
      alert(`Không thể cập nhật mức độ ưu tiên task. Lỗi: ${error}`);
    }
  };

  // Hàm xử lý khi thay đổi effort của task
  const handleTaskEffortChange = async (taskId: string, newEffort: number, e?: React.MouseEvent) => {
    try {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      // Lưu lại subtasks hiện tại để khôi phục nếu API call thất bại
      const originalSubtasks = [...subtasks];
      
      // Cập nhật UI trước (optimistic update) để tăng UX
      setSubtasks(currentSubtasks => 
        currentSubtasks.map(subtask => {
          if (subtask.task_id === taskId || subtask.id === taskId) {
            return { ...subtask, effort: newEffort };
          }
          return subtask;
        })
      );
      
      console.log(`Đang gửi request cập nhật effort task ${taskId} thành ${newEffort}`);
      
      // Dispatch action để gọi API update task
      const result = await dispatch(updateTaskEffort({ 
        taskId, 
        effort: newEffort 
      })).unwrap();
      
      console.log('Kết quả cập nhật effort:', result);
      
      // KHÔNG cần fetch lại subtasks vì optimistic update đã cập nhật UI
      // và Redux store đã cập nhật data
    } catch (error) {
      console.error('Lỗi khi cập nhật effort:', error);
      
      // Khôi phục UI về trạng thái ban đầu nếu có lỗi
      setSubtasks(originalSubtasks);
      
      // Hiển thị thông báo lỗi
      alert(`Không thể cập nhật effort task. Lỗi: ${error}`);
    }
  };

  // Hàm xử lý khi thay đổi assignee của task
  const handleTaskAssigneeChange = async (taskId: string, newAssigneeId: string | null, e: React.MouseEvent) => {
    try {
      // Sử dụng preventDefault và stopPropagation để tránh request media không cần thiết
      e.preventDefault();
      e.stopPropagation();
      
      // Lưu lại subtasks hiện tại để khôi phục nếu API call thất bại
      setOriginalSubtasks([...subtasks]);
      
      // Cập nhật UI trước (optimistic update) để tăng UX
      setSubtasks(currentSubtasks => 
        currentSubtasks.map(subtask => {
          if (subtask.task_id === taskId || subtask.id === taskId) {
            // Tìm thông tin member từ member ID
            let newAssignee = undefined;
            if (newAssigneeId) {
              const member = reduxMembers?.find(m => m.user.userId === newAssigneeId);
              if (member) {
                newAssignee = {
                  userId: member.user.userId,
                  username: member.user.username || member.user.fullName || member.user.email,
                  avatarUrl: member.user.avatarUrl || '',
                  role: member.role
                };
              }
            }
            
            return { 
              ...subtask, 
              assignee: newAssignee 
            };
          }
          return subtask;
        })
      );
      
      console.log(`Đang gửi request cập nhật người được giao cho task ${taskId} thành ${newAssigneeId}`);
      
      // Dispatch action để gọi API update task
      const result = await dispatch(updateTaskAssignee({ 
        taskId, 
        assigneeId: newAssigneeId
      })).unwrap();
      
      console.log('Kết quả cập nhật người được giao:', result);
      
      // KHÔNG cần fetch lại subtasks vì optimistic update đã cập nhật UI
      // và Redux store đã cập nhật data
    } catch (error) {
      console.error('Lỗi khi cập nhật người được giao:', error);
      
      // Khôi phục UI về trạng thái ban đầu nếu có lỗi
      setSubtasks(originalSubtasks);
      
      // Hiển thị thông báo lỗi
      alert(`Không thể cập nhật người được giao task. Lỗi: ${error}`);
    }
  };

  if (isLoadingSubtasks || subtasksLoading || reduxLoading) {
    return <div className="flex justify-center py-8"><div className="loader"></div></div>;
  }

  return (
    <div className="mt-4">
      <h3 className="text-lg font-medium mb-2">Subtasks</h3>
      
      {(isLoadingSubtasks || subtasksLoading || reduxLoading) ? (
        <div className="flex justify-center items-center h-24">
          <p className="text-gray-500">Đang tải subtasks...</p>
        </div>
      ) : subtasks.length === 0 ? (
        <div className="text-center py-4 text-gray-500">
          <p>Không có subtask nào.</p>
        </div>
      ) : (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Task
            </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
            </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
            </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Effort
            </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Người được giao
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {subtasks.map((subtask) => (
                <tr key={subtask.task_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link href={getTaskLink(subtask)} className="text-indigo-600 hover:text-indigo-900">
                  {subtask.title}
                </Link>
              </td>
                  
                  {/* Status Field */}
                  <td className="px-6 py-4 whitespace-nowrap">
                {editingCell?.taskId === subtask.task_id && editingCell?.field === 'status' ? (
                    <select
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                        onBlur={(e) => {
                          handleTaskStatusChange(subtask.task_id, editValue as TaskStatus);
                          setEditingCell(null);
                        }}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                      autoFocus
                      title="Chọn trạng thái task"
                      aria-label="Trạng thái task"
                    >
                      {Object.values(TaskStatuses).map((status) => (
                        <option key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </option>
                      ))}
                    </select>
                    ) : (
                      <div className="flex items-center">
                        <span className={`inline-block h-2 w-2 rounded-full mr-2 ${
                          subtask.status === 'TODO' ? 'bg-gray-400' :
                          subtask.status === 'DOING' ? 'bg-blue-400' :
                          subtask.status === 'REVIEW' ? 'bg-yellow-400' :
                          subtask.status === 'DONE' ? 'bg-green-400' : 'bg-gray-400'
                        }`}></span>
                        <span>
                          {subtask.status === 'TODO' ? 'Todo' :
                          subtask.status === 'DOING' ? 'In Progress' :
                          subtask.status === 'REVIEW' ? 'In Review' :
                          subtask.status === 'DONE' ? 'Done' : subtask.status}
                    </span>
                    <button 
                          onClick={(e) => {
                            e.preventDefault();
                            setEditingCell({ taskId: subtask.task_id, field: 'status' });
                            setEditValue(subtask.status);
                          }}
                      className="ml-2 text-gray-400 hover:text-gray-600"
                      title="Chỉnh sửa trạng thái"
                      aria-label="Chỉnh sửa trạng thái"
                    >
                          <PencilIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </td>
                  
                  {/* Priority Field */}
                  <td className="px-6 py-4 whitespace-nowrap">
                {editingCell?.taskId === subtask.task_id && editingCell?.field === 'priority' ? (
                    <select
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                        onBlur={(e) => {
                          handleTaskPriorityChange(subtask.task_id, editValue as Priority);
                          setEditingCell(null);
                        }}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                      autoFocus
                      title="Chọn mức độ ưu tiên"
                      aria-label="Mức độ ưu tiên"
                    >
                      {Object.values(Priorities).map((priority) => (
                        <option key={priority} value={priority}>
                          {priority.charAt(0).toUpperCase() + priority.slice(1)}
                        </option>
                      ))}
                    </select>
                    ) : (
                      <div className="flex items-center">
                        <span className={`text-sm ${
                          subtask.priority === 'HIGH' ? 'text-red-600' :
                          subtask.priority === 'MEDIUM' ? 'text-yellow-600' :
                          subtask.priority === 'LOW' ? 'text-green-600' : 'text-gray-600'
                        }`}>
                          {subtask.priority === 'HIGH' ? 'High' :
                          subtask.priority === 'MEDIUM' ? 'Medium' :
                          subtask.priority === 'LOW' ? 'Low' : subtask.priority}
                    </span>
                    <button 
                          onClick={(e) => {
                            e.preventDefault();
                            setEditingCell({ taskId: subtask.task_id, field: 'priority' });
                            setEditValue(subtask.priority);
                          }}
                      className="ml-2 text-gray-400 hover:text-gray-600"
                      title="Chỉnh sửa mức độ ưu tiên"
                      aria-label="Chỉnh sửa mức độ ưu tiên"
                    >
                          <PencilIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </td>
                  
                  {/* Effort Field */}
                  <td className="px-6 py-4 whitespace-nowrap">
                {editingCell?.taskId === subtask.task_id && editingCell?.field === 'effort' ? (
                    <input
                      type="number"
                        min="0"
                        max="10"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                        onBlur={(e) => {
                          handleTaskEffortChange(subtask.task_id, parseInt(editValue));
                          setEditingCell(null);
                        }}
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-16"
                      autoFocus
                      title="Nhập số giờ effort"
                      aria-label="Số giờ effort"
                        placeholder="Effort"
                      />
                    ) : (
                      <div className="flex items-center">
                    <span>{subtask.effort || 0}</span>
                    <button 
                          onClick={(e) => {
                            e.preventDefault();
                            setEditingCell({ taskId: subtask.task_id, field: 'effort' });
                            setEditValue(String(subtask.effort || 0));
                          }}
                      className="ml-2 text-gray-400 hover:text-gray-600"
                      title="Chỉnh sửa effort"
                      aria-label="Chỉnh sửa effort"
                    >
                          <PencilIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </td>
                  
                  {/* Assignee Field */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingCell?.taskId === subtask.task_id && editingCell?.field === 'assignee' ? (
                      <select 
                        value={editValue} 
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={(e) => {
                          // Nếu chọn giá trị rỗng, gửi null để gỡ bỏ assignee
                          const newAssigneeId = editValue === '' ? null : editValue;
                          handleTaskAssigneeChange(subtask.task_id, newAssigneeId, e.nativeEvent as unknown as React.MouseEvent);
                          setEditingCell(null);
                        }}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                        autoFocus
                        title="Chọn người được giao"
                        aria-label="Người được giao"
                      >
                        <option value="">Không có người được giao</option>
                        {reduxMembers?.map((member) => (
                          <option key={member.user.userId} value={member.user.userId}>
                            {member.user.username || member.user.fullName || member.user.email}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center">
                        {subtask.assignee ? (
                          <>
                            <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center mr-2 overflow-hidden">
                              {subtask.assignee.avatarUrl ? (
                                <img src={subtask.assignee.avatarUrl} alt={subtask.assignee.username} className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-gray-600 text-xs">{subtask.assignee.username.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <span>{subtask.assignee.username}</span>
                          </>
                        ) : (
                          <span className="text-gray-400">Không có</span>
                        )}
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            setEditingCell({ taskId: subtask.task_id, field: 'assignee' });
                            setEditValue(subtask.assignee?.userId || '');
                          }}
                          className="ml-2 text-gray-400 hover:text-gray-600"
                          title="Chỉnh sửa người được giao"
                          aria-label="Chỉnh sửa người được giao"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                      </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
        </div>
      )}
    </div>
  );
} 