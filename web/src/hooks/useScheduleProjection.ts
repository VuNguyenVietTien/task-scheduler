'use client';

import { useMemo } from 'react';
import { useQuery } from '@apollo/client';
import {
  GET_PROJECT_SCHEDULE_PROJECTION,
} from '@/graphql/queries/scheduleProjection';
import type {
  GetProjectScheduleProjectionData,
  GetProjectScheduleProjectionVars,
  GqlProjectScheduleProjection,
} from '@/graphql/queries/scheduleProjection';
import { wbsRowsFromProjection } from '@/lib/scheduling/build-wbs-rows';
import { masterRowsFromProjection } from '@/lib/scheduling/build-master-rows';
import type { WbsRow, PhaseRollupSummary } from '@/types/schedule-projection';
import type { PhaseDescriptor } from '@/types/taxonomy';

export interface MasterScheduleRows {
  phase_groups: PhaseRollupSummary[];
  unphased_group: PhaseRollupSummary;
}

const EMPTY_MASTER: MasterScheduleRows = {
  phase_groups: [],
  unphased_group: {
    phase_id: null,
    name: 'Unphased',
    display_order: Number.MAX_SAFE_INTEGER,
    is_unphased: true,
    task_ids: [],
    task_count: 0,
    total_effort_hours: 0,
  },
};

/**
 * Increment 1 — read-only schedule projection for the Gantt schedule modes.
 *
 * Fetches project_schedule_projection (CURRENT_TASK_FIELDS producer) and maps
 * it through the PURE builders into presentation rows:
 *  - wbsRows: exact server order/depth; source headings stay non-task rows.
 *  - masterRows: configured phase display order + explicit Unphased LAST.
 *
 * Presentation only: this hook NEVER issues a mutation. Switching modes or
 * refetching performs no writes. Known backend limitation (Increment-2
 * follow-up): wbs_rows may omit task-cycle members that totals still count —
 * consumers render exactly what is provided here.
 */
export function useScheduleProjection(
  projectId: string | null | undefined,
  phases: readonly PhaseDescriptor[]
) {
  const { data, loading, error, refetch } = useQuery<
    GetProjectScheduleProjectionData,
    GetProjectScheduleProjectionVars
  >(GET_PROJECT_SCHEDULE_PROJECTION, {
    variables: { projectId: projectId ?? '' },
    skip: !projectId,
    fetchPolicy: 'cache-and-network',
  });

  const projection: GqlProjectScheduleProjection | undefined =
    data?.project_schedule_projection;

  const wbsRows = useMemo<WbsRow[]>(
    () => (projection ? wbsRowsFromProjection(projection.wbs_rows) : []),
    [projection]
  );

  const masterRows = useMemo<MasterScheduleRows>(
    () => (projection ? masterRowsFromProjection(projection.wbs_rows, phases) : EMPTY_MASTER),
    [projection, phases]
  );

  return {
    projection,
    /** CURRENT_TASK_FIELDS current-field totals (task_count may exceed provided rows). */
    totals: projection?.totals,
    wbsRows,
    masterRows,
    loading,
    error,
    refetch,
  };
}
