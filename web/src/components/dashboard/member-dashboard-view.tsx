'use client';

import React from 'react';
import { DashboardSummaryCard } from './dashboard-summary-card';
import { DashboardTaskTable, renderStatusBadge, renderPriorityBadge } from './dashboard-task-table';

interface DashboardTask {
  task_id: string;
  title: string;
  project_id: string;
  status: string;
  priority: string;
  type: string | null;
  due_date: string | null;
  assignee: { user_id: string; username: string } | null;
}

interface MemberDashboardViewProps {
  activeTasks: DashboardTask[];
  tasksByStatus: Record<string, DashboardTask[]>;
}

export function MemberDashboardView({ activeTasks, tasksByStatus }: MemberDashboardViewProps) {
  // Sort by due date ascending (soonest first), nulls at end
  const sortedTasks = [...activeTasks].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardSummaryCard title="Tong cong viec" count={activeTasks.length} color="text-slate-800" />
        <DashboardSummaryCard title="Dang lam" count={tasksByStatus['DOING']?.length || 0} color="text-blue-600" />
        <DashboardSummaryCard title="Cho xu ly" count={(tasksByStatus['TODO']?.length || 0) + (tasksByStatus['PENDING']?.length || 0)} color="text-amber-600" />
        <DashboardSummaryCard title="Can review" count={tasksByStatus['REVIEW']?.length || 0} color="text-purple-600" />
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
