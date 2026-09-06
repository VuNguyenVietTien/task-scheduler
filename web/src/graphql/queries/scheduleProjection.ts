import { gql } from '@apollo/client';

/**
 * Increment 1 — project schedule projection read (CURRENT_TASK_FIELDS producer).
 * Backend contract: Task 1.3 report §4 (exact SDL operation/field names).
 * Read-only: switching display modes never issues a write.
 */

export type ScheduleProjectionSource = 'CURRENT_TASK_FIELDS';

export interface GqlScheduleTotals {
  task_count: number;
  /** Normalized display decimal string, e.g. "387.00". */
  effort_hours: string;
  progress?: number | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface GqlSchedulePhaseGroup {
  phase_id?: string | null;
  phase_key: string;
  is_unphased: boolean;
  task_ids: string[];
  totals: GqlScheduleTotals;
}

/** Real task row: carries the bar-relevant current fields. */
export interface GqlScheduleTaskEntry {
  __typename: 'ScheduleTaskEntry';
  task_id: string;
  title: string;
  phase_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  effort_hours: string;
  progress?: number | null;
  depth: number;
}

/**
 * Source WBS heading row: DISTINCT object with NO task identity, NO bar
 * callbacks, NO schedule numbers. Display/provenance metadata only.
 */
export interface GqlScheduleSourceHeading {
  __typename: 'ScheduleSourceHeading';
  heading_id: string;
  source_system: string;
  external_id: string;
  title: string;
  depth: number;
}

export type GqlScheduleWbsRow = GqlScheduleTaskEntry | GqlScheduleSourceHeading;

export interface GqlProjectScheduleProjection {
  project_id: string;
  source: ScheduleProjectionSource;
  phase_groups: GqlSchedulePhaseGroup[];
  wbs_rows: GqlScheduleWbsRow[];
  totals: GqlScheduleTotals;
}

export interface GetProjectScheduleProjectionData {
  project_schedule_projection: GqlProjectScheduleProjection;
}

export interface GetProjectScheduleProjectionVars {
  projectId: string;
}

export const GET_PROJECT_SCHEDULE_PROJECTION = gql`
  query GetProjectScheduleProjection($projectId: ID!) {
    project_schedule_projection(project_id: $projectId) {
      project_id
      source
      phase_groups {
        phase_id
        phase_key
        is_unphased
        task_ids
        totals {
          task_count
          effort_hours
          progress
          start_date
          end_date
        }
      }
      wbs_rows {
        __typename
        ... on ScheduleTaskEntry {
          task_id
          title
          phase_id
          start_date
          end_date
          effort_hours
          progress
          depth
        }
        ... on ScheduleSourceHeading {
          heading_id
          source_system
          external_id
          title
          depth
        }
      }
      totals {
        task_count
        effort_hours
        progress
        start_date
        end_date
      }
    }
  }
`;
