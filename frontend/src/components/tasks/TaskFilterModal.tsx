'use client';

import React, { useState, useEffect } from 'react';
import { TaskFilter, TaskStatus, Priority, TaskStatuses, Priorities, TaskAssignee } from '@/types/task';
import { ProjectData } from '@/types/project';
import { Dialog } from '@/components/ui/Dialog';

interface SavedFilter {
  id: string;
  name: string;
  filter: TaskFilter;
}

interface TaskFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filter: TaskFilter;
  onApply: (filter: TaskFilter) => void;
  assignees: TaskAssignee[];
  projects: ProjectData[];
}

export function TaskFilterModal({ 
  isOpen, 
  onClose, 
  filter, 
  onApply, 
  assignees, 
  projects 
}: TaskFilterModalProps) {
  const [activeTab, setActiveTab] = useState('general');
  const [currentFilter, setCurrentFilter] = useState<TaskFilter>(filter);
  const [filterName, setFilterName] = useState('');
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);

  // Load saved filters from localStorage on mount
  useEffect(() => {
    const loadedFilters = localStorage.getItem('savedTaskFilters');
    if (loadedFilters) {
      try {
        setSavedFilters(JSON.parse(loadedFilters));
      } catch (error) {
        console.error('Error loading saved filters:', error);
      }
    }
  }, []);

  // Update current filter when props filter changes
  useEffect(() => {
    setCurrentFilter(filter);
  }, [filter]);

  const handleSaveFilter = () => {
    if (!filterName.trim()) return;
    
    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: filterName,
      filter: currentFilter
    };
    
    const updatedFilters = [...savedFilters, newFilter];
    setSavedFilters(updatedFilters);
    localStorage.setItem('savedTaskFilters', JSON.stringify(updatedFilters));
    setFilterName('');
  };

  const handleApplySavedFilter = (savedFilter: SavedFilter) => {
    setCurrentFilter(savedFilter.filter);
    onApply(savedFilter.filter);
  };

  const handleDeleteSavedFilter = (id: string) => {
    const updatedFilters = savedFilters.filter(f => f.id !== id);
    setSavedFilters(updatedFilters);
    localStorage.setItem('savedTaskFilters', JSON.stringify(updatedFilters));
  };

  const handleApplyFilter = () => {
    onApply(currentFilter);
    onClose();
  };

  const handleResetFilter = () => {
    const emptyFilter = {};
    setCurrentFilter(emptyFilter);
    onApply(emptyFilter);
  };

  const handleInputChange = (key: keyof TaskFilter, value: any) => {
    setCurrentFilter(prev => {
      // Nếu giá trị rỗng, loại bỏ key này khỏi filter
      if (value === '' || value === undefined) {
        const newFilter = { ...prev };
        delete newFilter[key];
        return newFilter;
      }
      
      return { ...prev, [key]: value };
    });
  };

  const getActiveFilterCount = () => {
    return Object.keys(currentFilter).length;
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title="Lọc công việc"
      className="max-w-3xl w-[calc(100%-2rem)]"
    >
      <div className="p-6">
        {/* Tabs */}
        <div className="border-b border-slate-200 mb-6">
          <div className="flex space-x-6">
            <button
              onClick={() => setActiveTab('general')}
              className={`pb-2 px-1 text-sm font-medium transition-colors relative ${
                activeTab === 'general'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              aria-label="Tab thông tin chung"
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
                <span>Thông tin chung</span>
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('date')}
              className={`pb-2 px-1 text-sm font-medium transition-colors relative ${
                activeTab === 'date'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              aria-label="Tab ngày tháng"
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Ngày tháng</span>
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('people')}
              className={`pb-2 px-1 text-sm font-medium transition-colors relative ${
                activeTab === 'people'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              aria-label="Tab người thực hiện"
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span>Người thực hiện</span>
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('saved')}
              className={`pb-2 px-1 text-sm font-medium transition-colors relative ${
                activeTab === 'saved'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              aria-label="Tab bộ lọc đã lưu"
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                <span>Bộ lọc đã lưu</span>
              </div>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="mb-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Search */}
              <div className="space-y-2">
                <label htmlFor="search" className="block text-sm font-medium text-slate-700">
                  Tìm kiếm
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="search"
                    placeholder="Tìm kiếm theo tiêu đề hoặc mô tả..."
                    className="block w-full rounded-lg border-slate-300 border-2 focus:border-blue-500 focus:ring focus:ring-blue-200 pl-10 py-2 text-base"
                    value={currentFilter.searchQuery || ''}
                    onChange={(e) => handleInputChange('searchQuery', e.target.value)}
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  {currentFilter.searchQuery && (
                    <button
                      onClick={() => handleInputChange('searchQuery', '')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-500"
                      aria-label="Xóa tìm kiếm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Status & Priority */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="status" className="block text-sm font-medium text-slate-700">
                    Trạng thái
                  </label>
                  <select
                    id="status"
                    className="block w-full rounded-lg border-slate-300 border-2 focus:border-blue-500 focus:ring focus:ring-blue-200 py-2"
                    value={currentFilter.status || ''}
                    onChange={(e) => handleInputChange('status', e.target.value || undefined)}
                    aria-label="Lọc theo trạng thái"
                  >
                    <option value="">Tất cả trạng thái</option>
                    {Object.values(TaskStatuses).map((status) => (
                      <option key={status} value={status}>
                        {status.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="priority" className="block text-sm font-medium text-slate-700">
                    Độ ưu tiên
                  </label>
                  <select
                    id="priority"
                    className="block w-full rounded-lg border-slate-300 border-2 focus:border-blue-500 focus:ring focus:ring-blue-200 py-2"
                    value={currentFilter.priority || ''}
                    onChange={(e) => handleInputChange('priority', e.target.value || undefined)}
                    aria-label="Lọc theo độ ưu tiên"
                  >
                    <option value="">Tất cả độ ưu tiên</option>
                    {Object.values(Priorities).map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Project */}
              <div className="space-y-2">
                <label htmlFor="project" className="block text-sm font-medium text-slate-700">
                  Dự án
                </label>
                <select
                  id="project"
                  className="block w-full rounded-lg border-slate-300 border-2 focus:border-blue-500 focus:ring focus:ring-blue-200 py-2"
                  value={currentFilter.projectId || ''}
                  onChange={(e) => handleInputChange('projectId', e.target.value || undefined)}
                  aria-label="Lọc theo dự án"
                >
                  <option value="">Tất cả dự án</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {activeTab === 'date' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="startDate" className="block text-sm font-medium text-slate-700">
                    Từ ngày
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    className="block w-full rounded-lg border-slate-300 border-2 focus:border-blue-500 focus:ring focus:ring-blue-200 py-2"
                    value={currentFilter.startDate || ''}
                    onChange={(e) => handleInputChange('startDate', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="endDate" className="block text-sm font-medium text-slate-700">
                    Đến ngày
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    className="block w-full rounded-lg border-slate-300 border-2 focus:border-blue-500 focus:ring focus:ring-blue-200 py-2"
                    value={currentFilter.endDate || ''}
                    onChange={(e) => handleInputChange('endDate', e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-4 text-sm text-slate-500">
                <p>Lọc các nhiệm vụ trong khoảng thời gian:</p>
                <ul className="list-disc ml-5 mt-2">
                  <li>Các công việc có ngày bắt đầu sau "Từ ngày"</li>
                  <li>Các công việc có hạn hoàn thành trước "Đến ngày"</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'people' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="assignee" className="block text-sm font-medium text-slate-700">
                  Người được giao
                </label>
                <select
                  id="assignee"
                  className="block w-full rounded-lg border-slate-300 border-2 focus:border-blue-500 focus:ring focus:ring-blue-200 py-2"
                  value={currentFilter.assigneeId || ''}
                  onChange={(e) => handleInputChange('assigneeId', e.target.value || undefined)}
                  aria-label="Lọc theo người được giao"
                >
                  <option value="">Tất cả người dùng</option>
                  {assignees.map((assignee) => (
                    <option key={assignee.userId} value={assignee.userId}>
                      {assignee.username}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {activeTab === 'saved' && (
            <div className="space-y-4">
              {savedFilters.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Bộ lọc đã lưu</p>
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                    {savedFilters.map((savedFilter) => (
                      <div key={savedFilter.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <p className="font-medium">{savedFilter.name}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {Object.keys(savedFilter.filter).length} điều kiện lọc
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleApplySavedFilter(savedFilter)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            aria-label={`Áp dụng bộ lọc ${savedFilter.name}`}
                          >
                            Áp dụng
                          </button>
                          <button
                            onClick={() => handleDeleteSavedFilter(savedFilter.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                            aria-label={`Xóa bộ lọc ${savedFilter.name}`}
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p>Bạn chưa lưu bộ lọc nào.</p>
                  <p className="mt-1 text-sm">Tạo bộ lọc mới và lưu lại để sử dụng sau này.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Applied Filters */}
        {getActiveFilterCount() > 0 && (
          <div className="bg-slate-50 rounded-lg p-3 mb-6">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium text-slate-700">
                Đang áp dụng {getActiveFilterCount()} điều kiện lọc
              </p>
              <button
                onClick={handleResetFilter}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                aria-label="Đặt lại tất cả các bộ lọc"
              >
                Đặt lại tất cả
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-4 border-t bg-slate-50 rounded-b-lg">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Đặt tên cho bộ lọc này"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            className="rounded-lg border-slate-300 text-sm p-2 max-w-[200px]"
            aria-label="Tên bộ lọc để lưu"
          />
          <button
            onClick={handleSaveFilter}
            disabled={!filterName.trim() || getActiveFilterCount() === 0}
            className={`px-3 py-2 rounded-lg text-sm font-medium ${
              !filterName.trim() || getActiveFilterCount() === 0
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
            aria-label="Lưu bộ lọc này"
          >
            Lưu bộ lọc
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            aria-label="Hủy"
          >
            Hủy
          </button>
          <button
            onClick={handleApplyFilter}
            className="px-3 py-2 bg-blue-600 rounded-lg text-sm font-medium text-white hover:bg-blue-700"
            aria-label="Áp dụng bộ lọc"
          >
            Áp dụng
          </button>
        </div>
      </div>
    </Dialog>
  );
} 