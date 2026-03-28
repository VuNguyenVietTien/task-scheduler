'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface DashboardTaskTableProps {
  title: string;
  tasks: any[];
  columns: Column[];
  maxRows?: number;
  emptyMessage?: string;
}

// Badge color maps
const STATUS_COLORS: Record<string, string> = {
  TODO: 'bg-slate-100 text-slate-700',
  DOING: 'bg-blue-100 text-blue-700',
  REVIEW: 'bg-purple-100 text-purple-700',
  DONE: 'bg-emerald-100 text-emerald-700',
  CLOSE: 'bg-slate-100 text-slate-500',
  BLOCKED: 'bg-red-100 text-red-700',
  PENDING: 'bg-amber-100 text-amber-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-600 text-white',
  URGENT: 'bg-orange-500 text-white',
  HIGH: 'bg-amber-100 text-amber-800',
  MEDIUM: 'bg-blue-100 text-blue-700',
  LOW: 'bg-slate-100 text-slate-600',
};

export function renderStatusBadge(status: string) {
  const s = status?.toUpperCase() || '';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

export function renderPriorityBadge(priority: string) {
  const p = priority?.toUpperCase() || '';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[p] || 'bg-slate-100 text-slate-600'}`}>
      {priority}
    </span>
  );
}

export function DashboardTaskTable({ title, tasks, columns, maxRows = 10, emptyMessage = 'Khong co du lieu' }: DashboardTaskTableProps) {
  const router = useRouter();
  const displayed = tasks.slice(0, maxRows);

  const handleRowClick = (task: any) => {
    if (task.project_id) {
      router.push(`/projects/${task.project_id}?tab=list`);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      </div>

      {displayed.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-400">{emptyMessage}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                {columns.map(col => (
                  <th key={col.key} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayed.map((task, idx) => (
                <tr
                  key={task.task_id || idx}
                  className="hover:bg-slate-50 cursor-pointer text-sm"
                  onClick={() => handleRowClick(task)}
                >
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-3 whitespace-nowrap">
                      {col.render ? col.render(task[col.key], task) : (task[col.key] ?? '-')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tasks.length > maxRows && (
        <div className="px-4 py-2 border-t border-slate-100 text-center">
          <span className="text-xs text-slate-400">Hien thi {maxRows}/{tasks.length} task</span>
        </div>
      )}
    </div>
  );
}
