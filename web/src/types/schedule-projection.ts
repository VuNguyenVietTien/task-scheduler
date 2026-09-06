/**
 * Project schedule projection types, aligned with the
 * ProjectScheduleProjection shape in
 * docs/superpowers/specs/2026-09-01-project-scheduling-wbs-design.md §5.1.
 *
 * Increment 1 builds these from current task fields; later increments swap the
 * producer (GraphQL / capacity scheduler) without changing consumer shapes.
 */
import type { PhaseDescriptor, ScheduleDisplayMode, WbsSourceHeading } from './taxonomy';

export type ProjectionSource = 'CURRENT_TASK_FIELDS' | 'CAPACITY_SCHEDULER';

export interface TaskAssignmentRef {
  user_id: string;
  /** Optional allocation percentage for this assignment (Increment 2+). */
  allocation_percent?: number;
}

export interface TaskScheduleSegment {
  start: string;
  end: string;
  allocated_hours?: number;
}

/** A single real (non-deleted) task projected for scheduling purposes. */
export interface TaskScheduleItem {
  task_id: string;
  parent_task_id?: string | null;
  phase_id?: string | null;
  title: string;
  status: string;
  priority_order: number;
  /** Direct effort in hours; counted once per task regardless of hierarchy. */
  effort_hours?: number | null;
  /** Current progress in percent (0-100). */
  progress_percent?: number | null;
  /** Scheduled start (ISO date). Absent for unscheduled tasks. */
  start?: string | null;
  /** Scheduled end (ISO date). Absent for unscheduled tasks. */
  end?: string | null;
  assignments?: TaskAssignmentRef[];
  segments?: TaskScheduleSegment[];
  predecessor_ids?: string[];
  /** Authoritative allocation hours (Increment 3+); optional. */
  allocated_hours?: number | null;
  remaining_hours?: number | null;
  /** Soft-deleted tasks are excluded from all rollups. */
  deleted?: boolean;
}

/** A row of the WBS Detail tree. */
export type WbsRow =
  | {
      kind: 'TASK';
      row_id: string;
      /** Zero-based depth in the materialized hierarchy. */
      depth: number;
      task: TaskScheduleItem;
    }
  | {
      kind: 'SOURCE_HEADING';
      row_id: string;
      depth: number;
      heading: WbsSourceHeading;
    };

/** Derived, presentation-only Master Schedule summary for one phase (or Unphased). */
export interface PhaseRollupSummary {
  /** null for the explicit Unphased group. */
  phase_id: string | null;
  name: string;
  display_order: number;
  is_unphased: boolean;
  /** Real non-deleted task ids grouped here, each exactly once. */
  task_ids: string[];
  task_count: number;
  /** Sum of direct task effort_hours (hours). */
  total_effort_hours: number;
  /** Present only when tasks supply allocated/remaining hours. */
  allocated_hours?: number;
  remaining_hours?: number;
  /** min/max dates among scheduled tasks only; absent when none are scheduled. */
  start?: string;
  end?: string;
  /** Effort-weighted progress over positive-effort tasks; absent when undefined. */
  progress_percent?: number;
}

/** Full pure projection consumed by Gantt mode renderers. */
export interface ProjectScheduleProjection {
  source: ProjectionSource;
  project_id: string;
  generated_at?: string;
  display_mode?: ScheduleDisplayMode;
  wbs_rows: WbsRow[];
  phase_groups: PhaseRollupSummary[];
  unphased_group: PhaseRollupSummary;
  meetings?: unknown[];
  diagnostics?: string[];
}

/** Convenience re-export keeps consumers on one import site. */
export type { PhaseDescriptor, ScheduleDisplayMode, WbsSourceHeading };
