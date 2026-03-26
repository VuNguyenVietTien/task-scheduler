interface TimelineSkeletonProps {
  rows?: number;
}

export function TimelineSkeleton({ rows = 5 }: TimelineSkeletonProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      {/* Header */}
      <div className="flex mb-6">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex-1 px-2">
            <div className="skeleton-text w-20 mb-2"></div>
            <div className="skeleton-text w-16"></div>
          </div>
        ))}
      </div>

      {/* Task Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center mb-4">
          {/* Task Bar */}
          <div 
            className="skeleton-rect h-8"
            style={{ 
              width: `${Math.random() * 40 + 60}%`,
              marginLeft: `${Math.random() * 20}%`
            }}
          ></div>
        </div>
      ))}
    </div>
  );
}
