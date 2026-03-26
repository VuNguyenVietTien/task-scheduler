'use client';

import React from 'react';
import { DashboardSummaryCard } from './dashboard-summary-card';
import { DashboardTaskTable, renderStatusBadge, renderPriorityBadge } from './dashboard-task-table';

interface DashboardTask {
  taskId: string;
  title: string;
  projectId: string;
  status: string;
  priority: string;
  type: string | null;
  dueDate: string | null;
  assignee: { userId: string; username: string } | null;
}

interface MemberDashboardViewProps {
  activeTasks: DashboardTask[];
  tasksByStatus: Record<string, DashboardTask[]>;
}

export function MemberDashboardView({ activeTasks, tasksByStatus }: MemberDashboardViewProps) {
  // Sort by due date ascending (soonest first), nulls at end
  const sortedTasks = [...activeTasks].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardSummaryCard title="Tong cong viec" count={activeTasks.length} color="text-slate-800" />
        <DashboardSummaryCard title="Dang lam" count={tasksByStatus['doing']?.length || 0} color="text-blue-600" />
        <DashboardSummaryCard title="Cho xu ly" count={(tasksByStatus['todo']?.length || 0) + (tasksByStatus['pending']?.length || 0)} color="text-amber-600" />
        <DashboardSummaryCard title="Can review" count={tasksByStatus['review']?.length || 0} color="text-purple-600" />
      </div>

      {/* Task table */}
      <DashboardTaskTable
        title="Cong viec cua toi"
        tasks={sortedTasks}
        columns={[
          { key: 'title', label: 'Task' },
          { key: 'status', label: 'Trang thai', render: (v: string) => renderStatusBadge(v) },
          { key: 'priority', label: 'Uu tien', render: (v: string) => renderPriorityBadge(v) },
          { key: 'dueDate', label: 'Han', render: (v: string) => v ? new Date(v).toLocaleDateString('vi-VN') : '-' },
        ]}
        maxRows={20}
        emptyMessage="Khong co cong viec nao"
      />
    </div>
  );
}
