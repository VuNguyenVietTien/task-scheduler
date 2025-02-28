'use client';

import React from 'react';

interface TimelineSkeletonProps {
  rows: number;
}

export function TimelineSkeleton({ rows }: TimelineSkeletonProps) {
  return (
    <div className="animate-pulse">
      <div className="flex gap-4 h-full">
        {/* Priority List Skeleton */}
        <div className="w-80 flex-shrink-0 bg-slate-100 rounded-lg">
          <div className="p-4 border-b border-slate-200">
            <div className="h-6 w-24 bg-slate-200 rounded" />
          </div>
          <div className="p-4 space-y-4">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-3/4 bg-slate-200 rounded" />
                <div className="h-3 w-1/2 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        </div>
        
        {/* Timeline Grid Skeleton */}
        <div className="flex-1 bg-slate-100 rounded-lg">
          <div className="h-16 bg-slate-200" /> {/* Header */}
          <div className="grid grid-cols-7 gap-1 p-4">
            {Array.from({ length: rows * 7 }).map((_, i) => (
              <div key={i} className="h-8 bg-slate-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
