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

interface PMDashboardViewProps {
  overdueTasks: DashboardTask[];
  doingTasks: DashboardTask[];
  bugTasks: DashboardTask[];
  criticalTasks: DashboardTask[];
}

function daysOverdue(dueDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

export function PMDashboardView({ overdueTasks, doingTasks, bugTasks, criticalTasks }: PMDashboardViewProps) {
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardSummaryCard title="Task tre han" count={overdueTasks.length} color="text-red-600" />
        <DashboardSummaryCard title="Dang thuc hien" count={doingTasks.length} color="text-blue-600" />
        <DashboardSummaryCard title="Bug chua xong" count={bugTasks.length} color="text-orange-500" />
        <DashboardSummaryCard title="Critical/Urgent" count={criticalTasks.length} color="text-red-600" />
      </div>

      {/* Overdue tasks table */}
      <DashboardTaskTable
        title="Task dang tre han"
        tasks={overdueTasks}
        columns={[
          { key: 'title', label: 'Task' },
          { key: 'assignee', label: 'Nguoi thuc hien', render: (v: any) => v?.username || '-' },
          { key: 'dueDate', label: 'Han', render: (v: string) => v ? new Date(v).toLocaleDateString('vi-VN') : '-' },
          { key: 'daysOverdue', label: 'Tre (ngay)', render: (_v: any, row: any) => row.dueDate ? daysOverdue(row.dueDate) : '-' },
          { key: 'status', label: 'Trang thai', render: (v: string) => renderStatusBadge(v) },
        ]}
        emptyMessage="Khong co task tre han"
      />

      {/* Active bugs table */}
      <DashboardTaskTable
        title="Bug chua hoan thanh"
        tasks={bugTasks}
        columns={[
          { key: 'title', label: 'Task' },
          { key: 'assignee', label: 'Nguoi thuc hien', render: (v: any) => v?.username || '-' },
          { key: 'priority', label: 'Uu tien', render: (v: string) => renderPriorityBadge(v) },
          { key: 'status', label: 'Trang thai', render: (v: string) => renderStatusBadge(v) },
        ]}
        emptyMessage="Khong co bug"
      />

      {/* Critical/Urgent tasks table */}
      <DashboardTaskTable
        title="Task Critical/Urgent"
        tasks={criticalTasks}
        columns={[
          { key: 'title', label: 'Task' },
          { key: 'assignee', label: 'Nguoi thuc hien', render: (v: any) => v?.username || '-' },
          { key: 'dueDate', label: 'Han', render: (v: string) => v ? new Date(v).toLocaleDateString('vi-VN') : '-' },
          { key: 'priority', label: 'Uu tien', render: (v: string) => renderPriorityBadge(v) },
          { key: 'status', label: 'Trang thai', render: (v: string) => renderStatusBadge(v) },
        ]}
        emptyMessage="Khong co task critical/urgent"
      />
    </div>
  );
}
