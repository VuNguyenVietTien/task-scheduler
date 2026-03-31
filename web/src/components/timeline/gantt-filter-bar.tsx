'use client';

import { useState } from 'react';
import { FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';
import {
  GanttFilter,
  TaskType,
  TaskStatus,
  Priority,
  TASK_TYPES,
  TaskStatuses,
  Priorities,
} from '@/types/task';
import { TagInput } from '@/components/ui/tag-input';
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  TYPE_LABELS,
} from '@/constants/task-display-labels';

interface GanttFilterBarProps {
  filter: GanttFilter;
  onFilterChange: (filter: GanttFilter) => void;
}

/**
 * Compact filter bar for the Gantt chart.
 * Filters: search text, status, priority, type, tags (multi-select, OR logic).
 */
export function GanttFilterBar({ filter, onFilterChange }: GanttFilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeCount = [
    filter.status,
    filter.priority,
    filter.type,
    filter.tags?.length ? true : undefined,
  ].filter(Boolean).length;

  const update = (updates: Partial<GanttFilter>) =>
    onFilterChange({ ...filter, ...updates });

  const handleClear = () => {
    onFilterChange({});
    setIsOpen(false);
  };

  return (
    <div className="relative flex items-center gap-2">
      {/* Search input — always visible */}
      <input
        type="text"
        placeholder="Tìm task..."
        value={filter.searchQuery || ''}
        onChange={e => update({ searchQuery: e.target.value || undefined })}
        className="px-2 py-1 text-sm border rounded w-36 focus:outline-none focus:ring-1 focus:ring-blue-300"
      />

      {/* Filter toggle button */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className={`relative flex items-center gap-1 px-2 py-1 text-sm border rounded transition-colors ${
          isOpen ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white hover:bg-slate-50'
        }`}
        title="Lọc task theo trạng thái, ưu tiên, loại, tags"
      >
        <FunnelIcon className="h-4 w-4" />
        <span>Lọc</span>
        {activeCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
            {activeCount}
          </span>
        )}
      </button>

      {/* Clear all filters */}
      {activeCount > 0 && (
        <button
          onClick={handleClear}
          className="p-1 text-slate-400 hover:text-slate-600"
          title="Xóa tất cả bộ lọc"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      )}

      {/* Dropdown panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg p-3 flex flex-col gap-3 min-w-[380px]">
            <div className="flex gap-3 flex-wrap">
              {/* Status */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Trạng thái</label>
                <select
                  value={filter.status || ''}
                  onChange={e => update({ status: (e.target.value as TaskStatus) || undefined })}
                  className="px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-300"
                >
                  <option value="">Tất cả</option>
                  {Object.values(TaskStatuses).map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Ưu tiên</label>
                <select
                  value={filter.priority || ''}
                  onChange={e => update({ priority: (e.target.value as Priority) || undefined })}
                  className="px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-300"
                >
                  <option value="">Tất cả</option>
                  {Object.values(Priorities).map(p => (
                    <option key={p} value={p}>{PRIORITY_LABELS[p] || p}</option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Loại</label>
                <select
                  value={filter.type || ''}
                  onChange={e => update({ type: (e.target.value as TaskType) || undefined })}
                  className="px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-300"
                >
                  <option value="">Tất cả</option>
                  {TASK_TYPES.map(t => (
                    <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tags — free text input, OR logic filter */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Tags</label>
              <TagInput
                value={filter.tags || []}
                onChange={tags => update({ tags: tags.length ? tags : undefined })}
                placeholder="Nhập tag rồi Enter hoặc dấu phẩy..."
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
