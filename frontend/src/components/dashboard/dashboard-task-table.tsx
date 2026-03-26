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
  todo: 'bg-slate-100 text-slate-700',
  doing: 'bg-blue-100 text-blue-700',
  review: 'bg-purple-100 text-purple-700',
  done: 'bg-emerald-100 text-emerald-700',
  close: 'bg-slate-100 text-slate-500',
  blocked: 'bg-red-100 text-red-700',
  pending: 'bg-amber-100 text-amber-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  urgent: 'bg-orange-500 text-white',
  high: 'bg-amber-100 text-amber-800',
  medium: 'bg-blue-100 text-blue-700',
  low: 'bg-slate-100 text-slate-600',
};

export function renderStatusBadge(status: string) {
  const s = status?.toLowerCase() || '';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

export function renderPriorityBadge(priority: string) {
  const p = priority?.toLowerCase() || '';
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
    if (task.projectId) {
      router.push(`/projects/${task.projectId}?tab=list`);
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
                  key={task.taskId || idx}
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
