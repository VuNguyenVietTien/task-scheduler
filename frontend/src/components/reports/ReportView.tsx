'use client';

import { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  createReport,
  generateDailyReport,
  Report,
  ReportType
} from '@/redux/features/reportsSlice';
import { DailyReportView, useDailyReportData } from './daily-report-view';
import { PeriodReportView } from './period-report-view';

interface ReportViewProps {
  projectId: string;
}

export function ReportView({ projectId }: ReportViewProps) {
  const dispatch = useAppDispatch();
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  const { currentReport } = useAppSelector(state => state.reports);
  const { plans, activePlan } = useAppSelector(state => state.plans);
  const dailyData = useDailyReportData(projectId);

  // Default to active plan
  useEffect(() => {
    if (activePlan && !selectedPlanId) {
      setSelectedPlanId(activePlan.id);
    }
  }, [activePlan]);

  useEffect(() => {
    if (reportType === 'daily' && dailyData.report.totalTasks > 0) {
      dispatch(generateDailyReport(dailyData.report as Report));
    }
  }, [dailyData.report.totalTasks, reportType]);

  const saveReport = async () => {
    if (!currentReport) return;
    try {
      const result = await dispatch(createReport({
        ...currentReport,
        projectId,
        planId: selectedPlanId || undefined,
      } as any));
      if (createReport.fulfilled.match(result)) {
        alert('Báo cáo đã được lưu thành công!');
      } else {
        alert('Có lỗi xảy ra khi lưu báo cáo!');
      }
    } catch (err) {
      console.error('Lỗi khi lưu báo cáo:', err);
      alert('Có lỗi xảy ra khi lưu báo cáo!');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="select select-bordered"
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            aria-label="Loại báo cáo"
          >
            <option value="daily">Báo cáo ngày</option>
            <option value="weekly">Báo cáo tuần</option>
            <option value="monthly">Báo cáo tháng</option>
            <option value="quarterly">Báo cáo quý</option>
          </select>

          {/* Plan selector */}
          <select
            className="select select-bordered"
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
            aria-label="Chọn kế hoạch"
          >
            <option value="">Không chọn kế hoạch</option>
            {plans.map(plan => (
              <option key={plan.id} value={plan.id}>
                {plan.name || plan.id.slice(0, 8)}
                {activePlan?.id === plan.id ? ' (Active)' : ''}
              </option>
            ))}
          </select>

        </div>

        <button
          className="btn btn-primary"
          onClick={saveReport}
          disabled={!currentReport}
        >
          Lưu báo cáo
        </button>
      </div>

      {/* Report content by type */}
      {reportType === 'daily' ? (
        <DailyReportView
          projectId={projectId}
          onSummaryChange={(summary) => {
            if (currentReport) {
              dispatch(generateDailyReport({ ...currentReport, summary }));
            }
          }}
        />
      ) : (
        <PeriodReportView
          projectId={projectId}
          reportType={reportType}
          planId={selectedPlanId || undefined}
        />
      )}
    </div>
  );
}
