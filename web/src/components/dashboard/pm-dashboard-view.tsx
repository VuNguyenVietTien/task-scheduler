'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const statusLabel = (s: string) => t(`tasks.statusLabels.${s?.toUpperCase()}`, { defaultValue: s });
  const priorityLabel = (p: string) => t(`tasks.priorityLabels.${p?.toUpperCase()}`, { defaultValue: p });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardSummaryCard title={t('dashboard.overdueTasks')} count={overdueTasks.length} color="text-red-600" />
        <DashboardSummaryCard title={t('dashboard.activeTasks')} count={doingTasks.length} color="text-blue-600" />
        <DashboardSummaryCard title={t('dashboard.unfinishedBugs')} count={bugTasks.length} color="text-orange-500" />
        <DashboardSummaryCard title={t('dashboard.criticalUrgent')} count={criticalTasks.length} color="text-red-600" />
      </div>

      <DashboardTaskTable
        title={t('dashboard.overdueTasksTitle')}
        tasks={overdueTasks}
        columns={[
          { key: 'title', label: t('dashboard.colTask') },
          { key: 'assignee', label: t('dashboard.colAssignee'), render: (v: any) => v?.username || '-' },
          { key: 'due_date', label: t('dashboard.colDeadline'), render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
          { key: 'daysOverdue', label: t('dashboard.colOverdueDays'), render: (_v: any, row: any) => row.due_date ? daysOverdue(row.due_date) : '-' },
          { key: 'status', label: t('dashboard.colStatus'), render: (v: string) => renderStatusBadge(statusLabel(v)) },
        ]}
        emptyMessage={t('dashboard.noOverdueTasks')}
      />

      <DashboardTaskTable
        title={t('dashboard.activeBugsTitle')}
        tasks={bugTasks}
        columns={[
          { key: 'title', label: t('dashboard.colTask') },
          { key: 'assignee', label: t('dashboard.colAssignee'), render: (v: any) => v?.username || '-' },
          { key: 'priority', label: t('dashboard.colPriority'), render: (v: string) => renderPriorityBadge(priorityLabel(v)) },
          { key: 'status', label: t('dashboard.colStatus'), render: (v: string) => renderStatusBadge(statusLabel(v)) },
        ]}
        emptyMessage={t('dashboard.noBugs')}
      />

      <DashboardTaskTable
        title={t('dashboard.criticalUrgent')}
        tasks={criticalTasks}
        columns={[
          { key: 'title', label: t('dashboard.colTask') },
          { key: 'assignee', label: t('dashboard.colAssignee'), render: (v: any) => v?.username || '-' },
          { key: 'due_date', label: t('dashboard.colDeadline'), render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
          { key: 'priority', label: t('dashboard.colPriority'), render: (v: string) => renderPriorityBadge(priorityLabel(v)) },
          { key: 'status', label: t('dashboard.colStatus'), render: (v: string) => renderStatusBadge(statusLabel(v)) },
        ]}
        emptyMessage={t('dashboard.noCritical')}
      />
    </div>
  );
}
