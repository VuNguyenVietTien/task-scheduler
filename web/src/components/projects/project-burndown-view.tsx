'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SAVED_PLANS_QUERY } from '@/graphql/scheduling';
import { useAppSelector } from '@/redux/hooks';
import { distinctTaskPopulation } from '@/components/reports/task-population';
import { buildProjectBurndown, readBurndownPlan } from '@/utils/project-burndown';

interface SavedPlan {
  plan_id: string;
  name: string;
  revision: number;
  is_active: boolean;
  stale: boolean;
  plan_data: unknown;
  created_at?: string;
}

function todayKey(): string {
  const today = new Date();
  return [today.getFullYear(), today.getMonth() + 1, today.getDate()]
    .map((part, index) => String(part).padStart(index ? 2 : 4, '0'))
    .join('-');
}

export function ProjectBurndownView({ projectId }: { projectId: string }) {
  const { t, i18n } = useTranslation();
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const { tasks: taskForest, loading: tasksLoading } = useAppSelector((state) => state.tasks);
  const currentTasks = useMemo(() => distinctTaskPopulation(taskForest), [taskForest]);
  const { data, loading: plansLoading, error } = useQuery<{ saved_plans: SavedPlan[] }>(SAVED_PLANS_QUERY, {
    variables: { project_id: projectId },
    fetchPolicy: 'cache-and-network',
  });
  const plans = useMemo(() => data?.saved_plans ?? [], [data?.saved_plans]);

  useEffect(() => {
    if (!plans.length) {
      setSelectedPlanId('');
      return;
    }
    if (!plans.some((plan) => plan.plan_id === selectedPlanId)) {
      setSelectedPlanId(plans.find((plan) => plan.is_active)?.plan_id ?? plans[0].plan_id);
    }
  }, [plans, selectedPlanId]);

  const selectedPlan = plans.find((plan) => plan.plan_id === selectedPlanId);
  const calculation = useMemo(() => {
    if (!selectedPlan) return { result: null, message: null };
    try {
      const baseline = readBurndownPlan(selectedPlan.plan_data);
      return {
        result: buildProjectBurndown(
          baseline.tasks,
          currentTasks,
          todayKey(),
          baseline.contextTasks
        ),
        message: null,
      };
    } catch (caught) {
      return { result: null, message: caught instanceof Error ? caught.message : String(caught) };
    }
  }, [currentTasks, selectedPlan]);

  const formatDate = (date: string) => new Intl.DateTimeFormat(i18n.language, {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
  const result = calculation.result;
  const indicatorClass = result?.indicator === 'ahead'
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : result?.indicator === 'behind'
      ? 'bg-red-50 text-red-800 border-red-200'
      : result?.indicator === 'on-track'
        ? 'bg-blue-50 text-blue-800 border-blue-200'
        : 'bg-amber-50 text-amber-900 border-amber-200';
  const indicatorText = !result || result.indicator === 'unavailable'
    ? t('burndown.unavailable')
    : result.indicator === 'ahead'
      ? t('burndown.ahead', { count: Math.abs(result.delta) })
      : result.indicator === 'behind'
        ? t('burndown.behind', { count: result.delta })
        : t('burndown.onTrack');

  return (
    <section className="h-full overflow-auto space-y-4 p-2" aria-labelledby="burndown-title">
      <div className="card p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 id="burndown-title" className="text-xl font-semibold text-slate-900">{t('burndown.title')}</h1>
            <p className="mt-1 text-sm text-slate-600">{t('burndown.scope')}</p>
          </div>
          <label className="min-w-64 text-sm font-medium text-slate-700">
            {t('burndown.plan')}
            <select
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              value={selectedPlanId}
              onChange={(event) => setSelectedPlanId(event.target.value)}
              disabled={plansLoading || !plans.length}
            >
              {!plans.length && <option value="">{t('burndown.noPlans')}</option>}
              {plans.map((plan) => (
                <option key={plan.plan_id} value={plan.plan_id}>
                  {plan.name} (r{plan.revision}){plan.is_active ? ` — ${t('burndown.active')}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {(error || calculation.message) && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error ? t('burndown.loadError') : t('burndown.invalidSnapshot', { detail: calculation.message })}
        </div>
      )}
      {(tasksLoading || (plansLoading && !selectedPlan)) && (
        <div role="status" className="card p-6 text-sm text-slate-600">{t('burndown.loading')}</div>
      )}
      {!plansLoading && !error && !plans.length && (
        <div className="card p-6 text-center text-slate-600">{t('burndown.emptyPlans')}</div>
      )}

      {selectedPlan && result && !tasksLoading && (
        <>
          <div className="card p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <strong className="text-slate-900">{selectedPlan.name}</strong>
              <span>r{selectedPlan.revision}</span>
              {selectedPlan.is_active && <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-800">{t('burndown.active')}</span>}
              {selectedPlan.stale && <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">{t('burndown.stale')}</span>}
              {result.scheduledRange && <span>{formatDate(result.scheduledRange.start)} – {formatDate(result.scheduledRange.end)}</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="card p-4">
              <p className="text-sm text-slate-500">{t('burndown.inScope')}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{result.totalTasks}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-slate-500">{t('burndown.actualRemaining')}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{result.actualRemaining}</p>
            </div>
            <div className={`rounded-lg border p-4 ${indicatorClass}`}>
              <p className="text-sm">{t('burndown.asOf', { date: formatDate(todayKey()) })}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{indicatorText}</p>
              <p className="mt-1 text-xs">{t('burndown.plannedRemaining', { count: result.plannedRemaining })}</p>
            </div>
          </div>

          {result.points.length ? (
            <div className="card p-4">
              <h2 className="text-lg font-medium text-slate-900">{t('burndown.chartTitle')}</h2>
              <p className="mt-1 text-sm text-slate-600" aria-live="polite">
                {t('burndown.chartSummary', { planned: result.plannedRemaining, actual: result.actualRemaining, date: formatDate(todayKey()) })}
              </p>
              <div className="mt-4 h-[360px] min-h-[360px]" role="img" aria-label={t('burndown.chartAria')}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.points} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tickFormatter={(value) => formatDate(String(value))} minTickGap={32} />
                    <YAxis allowDecimals={false} width={36} />
                    <Tooltip labelFormatter={(value) => formatDate(String(value))} />
                    <Legend />
                    <Line type="stepAfter" dataKey="plannedRemaining" name={t('burndown.planned')} stroke="#7c3aed" strokeWidth={2} dot={false} />
                    <Line type="stepAfter" dataKey="actualRemaining" name={t('burndown.actual')} stroke="#0284c7" strokeWidth={2} dot={false} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="card p-6 text-center text-slate-600">{t('burndown.noScheduledTasks')}</div>
          )}

          <div className="card p-4 text-sm text-slate-700">
            <h2 className="font-medium text-slate-900">{t('burndown.evidence')}</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>{t('burndown.timing', { early: result.completedEarlyCount, onTime: result.completedOnTimeCount, late: result.completedLateCount })}</li>
              <li>{t('burndown.exclusions', { summaries: result.summaryCount, excluded: result.excludedCount })}</li>
              <li>{t('burndown.unplanned', { count: result.unplannedTaskCount })}</li>
              <li>{t('burndown.zeroEffort', { count: result.zeroEffortCount })}</li>
              {result.unscheduledCount > 0 && <li className="text-amber-800">{t('burndown.unscheduled', { count: result.unscheduledCount })}</li>}
              {result.missingCurrentTaskCount > 0 && <li className="text-amber-800">{t('burndown.missingCurrent', { count: result.missingCurrentTaskCount })}</li>}
              {result.completedWithoutActualEndCount > 0 && <li className="text-amber-800">{t('burndown.missingActualEnd', { count: result.completedWithoutActualEndCount })}</li>}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
