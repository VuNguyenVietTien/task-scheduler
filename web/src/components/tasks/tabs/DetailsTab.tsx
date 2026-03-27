import React from 'react';
import { Task, TaskStatus, Priority, TaskStatuses, Priorities } from '@/types/task';

interface DetailsTabProps {
  task: Task;
  editedTask: Task;
  editingField: string | null;
  calculateDaysRemaining: () => string | null;
  formatDate: (dateString?: string) => string;
  formatEffortWithRemaining: (subtasks: Task[]) => string;
  calculateProgress: (subtasks: Task[]) => number;
  renderEditableField: (label: string, fieldName: string, type?: 'text' | 'number' | 'date' | 'select', options?: {value: string, label: string}[]) => React.ReactNode;
  projectMembers?: { 
    role: string;
    joinedAt: string;
    user: {
      userId: string;
      email: string;
      fullName: string;
      username: string;
      avatarUrl: string;
    };
  }[];
  subtasks: Task[];
}

export default function DetailsTab({ 
  task, 
  editedTask, 
  editingField, 
  calculateDaysRemaining,
  formatDate,
  formatEffortWithRemaining,
  calculateProgress,
  renderEditableField,
  projectMembers,
  subtasks
}: DetailsTabProps) {
  return (
    <div className="bg-white rounded-lg">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Thông tin chi tiết</h2>
      
      <div className="grid grid-cols-1 gap-2">
        {/* Trạng thái */}
        {renderEditableField('Trạng thái', 'status', 'select', 
          Object.entries(TaskStatuses).map(([_, value]) => ({ 
            value, 
            label: value.charAt(0).toUpperCase() + value.slice(1) 
          })))}
        
        {/* Mức độ ưu tiên */}
        {renderEditableField('Mức độ ưu tiên', 'priority', 'select', 
          Object.entries(Priorities).map(([_, value]) => ({ 
            value, 
            label: value.charAt(0).toUpperCase() + value.slice(1) 
          })))}
        
        {/* Thời gian */}
        <div className="mt-6 border-t border-gray-200 pt-4">
          <h3 className="text-base font-medium text-gray-900 mb-3">Thời gian</h3>
          {renderEditableField('Ngày bắt đầu', 'start_date', 'date')}
          {renderEditableField('Ngày đến hạn', 'due_date', 'date')}
          
          {/* Thêm ngày thực tế */}
          <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
            <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">Ngày bắt đầu thực tế:</div>
            <div className="flex-1 text-sm text-gray-900">
              {task.actual_start_date ? formatDate(task.actual_start_date) : 'Chưa bắt đầu'}
            </div>
          </div>
          
          <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
            <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">Ngày kết thúc thực tế:</div>
            <div className="flex-1 text-sm text-gray-900">
              {task.actual_end_date ? formatDate(task.actual_end_date) : 'Chưa hoàn thành'}
            </div>
          </div>
          
          {calculateDaysRemaining() && (
            <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
              <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">Thời gian còn lại:</div>
              <div className="flex-1">
                <span className={`inline-block px-2 py-1 text-sm rounded ${calculateDaysRemaining()?.includes('Quá hạn') ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                  {calculateDaysRemaining()}
                </span>
              </div>
            </div>
          )}
        </div>               
        
        {/* Người phụ trách */}
        <div className="mt-6 border-t border-gray-200 pt-4">
          <h3 className="text-base font-medium text-gray-900 mb-3">Người phụ trách</h3>
          {renderEditableField('Người được giao', 'assignee', 'select',
            projectMembers && projectMembers.length > 0 ? 
              [{ value: '', label: 'Chưa gán' }, ...projectMembers.map(member => ({ 
                value: member.user.userId, 
                label: member.user.username || member.user.fullName || member.user.email 
              }))] : 
              [{ value: '', label: 'Chưa gán' }]
          )}
          
          {renderEditableField('Người tạo', 'created_by')}
        </div>
        
        {/* Nỗ lực và tiến độ */}
        <div className="mt-6 border-t border-gray-200 pt-4">
          <h3 className="text-base font-medium text-gray-900 mb-3">Nỗ lực và tiến độ</h3>
          {subtasks.length === 0 ? (
            <>
              {renderEditableField('Nỗ lực (giờ)', 'effort', 'number')}
              {renderEditableField('Tiến độ (%)', 'progress', 'number')}
            </>
          ) : (
            <>
              <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
                <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">Nỗ lực:</div>
                <div className="flex-1 text-sm text-gray-900">
                  {formatEffortWithRemaining(subtasks)}
                </div>
              </div>
              <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
                <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">Tiến độ:</div>
                <div className="flex-1 text-sm text-gray-900">
                  {calculateProgress(subtasks)}%
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Phân loại */}
        <div className="mt-6 border-t border-gray-200 pt-4">
          <h3 className="text-base font-medium text-gray-900 mb-3">Phân loại</h3>
          
          {/* Loại task */}
          {renderEditableField('Loại task', 'type', 'select', 
            [
              { value: '', label: 'Không xác định' },
              { value: 'Feature', label: 'Feature' },
              { value: 'Bug', label: 'Bug' },
              { value: 'Enhancement', label: 'Enhancement' },
              { value: 'Documentation', label: 'Documentation' }
            ]
          )}
          
          {/* Danh mục */}
          {renderEditableField('Danh mục', 'category', 'select', 
            [
              { value: '', label: 'Không xác định' },
              { value: 'Frontend', label: 'Frontend' },
              { value: 'Backend', label: 'Backend' },
              { value: 'Design', label: 'Design' },
              { value: 'Testing', label: 'Testing' },
              { value: 'DevOps', label: 'DevOps' }
            ]
          )}
          
          {/* Tags */}
          <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
            <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">Tags:</div>
            <div className="flex-1 flex flex-wrap gap-1">
              {task.tags && Array.isArray(task.tags) && task.tags.length > 0 ? (
                task.tags.map((tag, idx) => (
                  <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {tag}
                  </span>
                ))
              ) : task.tags && typeof task.tags === 'object' && Object.keys(task.tags).length > 0 ? (
                Object.entries(task.tags).map(([key, value], idx) => (
                  <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {typeof value === 'string' ? value : key}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-500">Không có tags</span>
              )}
            </div>
          </div>
          
          {/* Loại tiến độ */}
          {renderEditableField('Loại tiến độ', 'progress_type', 'select', 
            [
              { value: '', label: 'Chưa thiết lập' },
              { value: 'study', label: 'Nghiên cứu' },
              { value: 'investigate', label: 'Điều tra' },
              { value: 'code', label: 'Lập trình' },
              { value: 'test', label: 'Kiểm thử' },
              { value: 'review_code', label: 'Review code' },
              { value: 'review_test_report', label: 'Review báo cáo test' },
              { value: 'release', label: 'Phát hành' }
            ]
          )}
        </div>
        
        {/* Thông tin khác */}
        <div className="mt-6 border-t border-gray-200 pt-4">
          <h3 className="text-base font-medium text-gray-900 mb-3">Thông tin khác</h3>
          <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
            <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">Thời gian tạo:</div>
            <div className="flex-1 text-sm text-gray-900">
              {formatDate(task.created_at)}
            </div>
          </div>
          
          <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
            <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">Cập nhật cuối:</div>
            <div className="flex-1 text-sm text-gray-900">
              {formatDate(task.updated_at)}
            </div>
          </div>
          
          {task.task_id && (
            <div className="flex items-center py-1.5 rounded-md hover:bg-gray-50">
              <div className="flex-shrink-0 w-1/3 text-sm font-medium text-gray-700">ID Task:</div>
              <div className="flex-1 text-sm text-gray-900 font-mono">
                {task.task_id}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 