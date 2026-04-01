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

interface MemberDashboardViewProps {
  activeTasks: DashboardTask[];
  tasksByStatus: Record<string, DashboardTask[]>;
}

export function MemberDashboardView({ activeTasks, tasksByStatus }: MemberDashboardViewProps) {
  const { t } = useTranslation();
  const statusLabel = (s: string) => t(`tasks.statusLabels.${s?.toUpperCase()}`, { defaultValue: s });
  const priorityLabel = (p: string) => t(`tasks.priorityLabels.${p?.toUpperCase()}`, { defaultValue: p });

  const sortedTasks = [...activeTasks].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardSummaryCard title={t('dashboard.totalTasks')} count={activeTasks.length} color="text-slate-800" />
        <DashboardSummaryCard title={t('dashboard.doing')} count={tasksByStatus['DOING']?.length || 0} color="text-blue-600" />
        <DashboardSummaryCard title={t('dashboard.pending')} count={(tasksByStatus['TODO']?.length || 0) + (tasksByStatus['PENDING']?.length || 0)} color="text-amber-600" />
        <DashboardSummaryCard title={t('dashboard.needsReview')} count={tasksByStatus['REVIEW']?.length || 0} color="text-purple-600" />
      </div>

      <DashboardTaskTable
        title={t('dashboard.myTasks')}
        tasks={sortedTasks}
        columns={[
          { key: 'title', label: t('dashboard.colTask') },
          { key: 'status', label: t('dashboard.colStatus'), render: (v: string) => renderStatusBadge(statusLabel(v)) },
          { key: 'priority', label: t('dashboard.colPriority'), render: (v: string) => renderPriorityBadge(priorityLabel(v)) },
          { key: 'dueDate', label: t('dashboard.colDeadline'), render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
        ]}
        maxRows={20}
        emptyMessage={t('dashboard.noTasks')}
      />
    </div>
  );
}
