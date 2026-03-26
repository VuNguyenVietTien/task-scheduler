'use client';

import React from 'react';

interface DashboardSummaryCardProps {
  title: string;
  count: number;
  color: string; // Tailwind text color class, e.g. 'text-red-600'
  icon?: React.ReactNode;
}

export function DashboardSummaryCard({ title, count, color, icon }: DashboardSummaryCardProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        {icon && <span className="w-5 h-5 flex-shrink-0">{icon}</span>}
        <span>{title}</span>
      </div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{count}</div>
    </div>
  );
}
