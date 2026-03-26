'use client';

interface MetricItem {
  label: string;
  value: number;
  total?: number;
  bgColor: string;
}

interface ReportMetricsCardProps {
  metrics: MetricItem[];
}

export function ReportMetricsCard({ metrics }: ReportMetricsCardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, index) => (
        <div key={index} className={`stat ${metric.bgColor} rounded-lg p-4`}>
          <div className="stat-title">{metric.label}</div>
          <div className="stat-value">{metric.value}</div>
          {metric.total !== undefined && metric.total > 0 && (
            <div className="stat-desc">
              {Math.round((metric.value / metric.total) * 100)}%
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
