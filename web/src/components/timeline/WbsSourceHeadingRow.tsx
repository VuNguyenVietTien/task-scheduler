'use client';

import React from 'react';
import type { WbsSourceHeading } from '@/types/taxonomy';

export interface WbsSourceHeadingRowProps {
  heading: WbsSourceHeading;
  className?: string;
}

/**
 * Display-only row for a non-task source heading (e.g. issue-1115
 * tracker-Phase headings) in WBS Detail. Renders no task ID, effort,
 * progress, assignee, bar, or dependency affordances; it is never draggable
 * and never passed to task callbacks.
 */
export function WbsSourceHeadingRow({ heading, className = '' }: WbsSourceHeadingRowProps) {
  return (
    <div
      role="heading"
      aria-level={heading.depth + 1}
      data-row-id={`heading:${heading.source_heading_id}`}
      data-source-heading="true"
      data-nondraggable="true"
      style={{ paddingLeft: `${heading.depth * 20}px` }}
      className={`flex items-center h-8 text-xs font-semibold uppercase tracking-wide text-gray-400 select-none ${className}`}
    >
      <span className="truncate">{heading.title}</span>
    </div>
  );
}

export default WbsSourceHeadingRow;
