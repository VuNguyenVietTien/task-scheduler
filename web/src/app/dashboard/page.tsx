'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardTasks } from '@/hooks/use-dashboard-tasks';
import { PMDashboardView } from '@/components/dashboard/pm-dashboard-view';
import { MemberDashboardView } from '@/components/dashboard/member-dashboard-view';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();

  // Hooks must be called before any early return (React rules of hooks)
  const dashboardData = useDashboardTasks(user?.id || '', user?.role || '');
  const { loading, error, isPM, overdueTasks, doingTasks, bugTasks, criticalTasks, activeTasks, tasksByStatus } = dashboardData;

  // Redirect unauthenticated users in useEffect to avoid render-time side effects
  useEffect(() => {
    if (!user) router.push('/auth');
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="p-5">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{t('dashboard.greeting', { name: user.name })}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {isPM ? t('dashboard.projectOverview') : t('dashboard.myTaskOverview')}
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="animate-pulse bg-white rounded-lg border border-slate-200 p-4">
                <div className="h-4 bg-slate-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-slate-200 rounded w-1/4"></div>
              </div>
            ))}
          </div>
          <div className="animate-pulse bg-white rounded-lg border border-slate-200 p-4">
            <div className="h-4 bg-slate-200 rounded w-1/3 mb-4"></div>
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-4 bg-slate-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 p-4 rounded-lg text-red-700">
          {t('dashboard.loadingError')}
        </div>
      ) : isPM ? (
        <PMDashboardView
          overdueTasks={overdueTasks}
          doingTasks={doingTasks}
          bugTasks={bugTasks}
          criticalTasks={criticalTasks}
        />
      ) : (
        <MemberDashboardView
          activeTasks={activeTasks}
          tasksByStatus={tasksByStatus}
        />
      )}
    </div>
  );
}
