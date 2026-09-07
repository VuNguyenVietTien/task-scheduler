/**
 * useProjectSchedulingConfig — loads persisted scheduling configuration for a
 * project (requirement 3/4/6): per-member capacity (weekday/weekend hours +
 * date overrides), days off (individual/project/group), member groups, and
 * recurring commitments. Derives scheduler-ready structures:
 *
 *  - `capacityFor(memberKey)` → CapacityResolver (0h days excluded by the
 *    scheduler, so weekend defaults / leave produce no work bars)
 *  - `reservedFor(memberKey, from, to)` → per-date hours reserved by
 *    recurring commitments applying to that member (group-scoped rules apply
 *    only to group members; project rules to everyone)
 *
 * Defaults apply only to confirmed absent config rows. Loading, failed or
 * incomplete query results must not authorize draft calculations.
 */
import { useMemo } from 'react';
import { useQuery } from '@apollo/client';
import {
  CAPACITY_SETTINGS_QUERY,
  RECURRING_COMMITMENTS_QUERY,
  RESOURCE_MEMBERS_QUERY,
  RESOURCE_GROUPS_QUERY,
} from '@/graphql/scheduling';
import {
  DEFAULT_CAPACITY,
  buildCapacityResolver,
  type CapacityConfig,
  type CapacityResolver,
  type DayOffRange,
} from '@/utils/capacity';
import {
  expandCommitmentsDetailed,
  reservedHoursByDate,
  commitmentAppliesToMember,
  type RecurringCommitment,
} from '@/utils/recurring';

export interface SchedulingResourceMember {
  resource_member_id: string;
  display_name: string;
  user_id: string | null;
  member_kind: string;
}

export interface SchedulingConfig {
  loading: boolean;
  /** Scheduling reads failed; callers must not present defaults as loaded data. */
  error?: string;
  /** Canonical project resources, including unlinked zero-allocation members. */
  resourceMembers: SchedulingResourceMember[];
  /** resource member id -> group ids */
  memberGroups: Record<string, string[]>;
  /** resource member id -> capacity config */
  memberCapacity: Record<string, CapacityConfig>;
  /** project-wide default capacity (resource member with no row) */
  defaultCapacity: CapacityConfig;
  daysOff: DayOffRange[];
  commitments: RecurringCommitment[];
  groups: { id: string; name: string; memberIds: string[] }[];
  capacityFor(memberKey: string | undefined): CapacityResolver;
  configFor(memberKey: string | undefined): CapacityConfig;
  groupIdsFor(memberKey: string | undefined): string[];
  reservedFor(memberKey: string | undefined, from: string, to: string): Record<string, number>;
  /** Recurring-commitment rule ids whose horizon expansion was truncated —
   * UI must warn instead of implying complete reservations. NOTE: populated
   * lazily as `reservedFor` runs during allocation computation; read it in a
   * memo that depends on the allocation result (or during render after it). */
  truncatedCommitmentRules: Set<string>;
  /** Maps a task assignee's userId → the resource_member key that owns the
   * capacity/leave/group rows (linked member) so placeholder-linked and
   * direct members share one key space; falls back to userId, then
   * 'unassigned'. */
  memberKeyFor(userId?: string | null): string;
}

interface CapacityRow {
  resource_member_id: string;
  weekday_hours: number;
  weekend_hours: number;
  date_overrides: { date: string; hours: number }[];
}

interface DayOffRow {
  id: string;
  project_id: string;
  scope: 'INDIVIDUAL' | 'PROJECT' | 'GROUP';
  resource_member_id: string | null;
  group_id: string | null;
  start_date: string;
  end_date: string;
  reason: string | null;
}

interface GroupRow {
  id: string;
  name: string;
  member_ids: string[];
}

interface CommitmentRow {
  id: string;
  project_id: string;
  title: string;
  scope: 'PROJECT' | 'GROUP';
  group_id: string | null;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  recurrence_interval: number;
  weekday: number | null;
  month_day: number | null;
  start_date: string;
  end_date: string | null;
  start_hour: number;
  duration_hours: number;
}

export function useProjectSchedulingConfig(projectId: string | undefined): SchedulingConfig {
  const capacityQ = useQuery(CAPACITY_SETTINGS_QUERY, {
    variables: { project_id: projectId ?? '' },
    skip: !projectId,
    fetchPolicy: 'cache-first',
  });
  const groupsQ = useQuery(RESOURCE_GROUPS_QUERY, {
    variables: { project_id: projectId ?? '' },
    skip: !projectId,
    fetchPolicy: 'cache-first',
  });
  const commitmentsQ = useQuery(RECURRING_COMMITMENTS_QUERY, {
    variables: { project_id: projectId ?? '' },
    skip: !projectId,
    fetchPolicy: 'cache-first',
  });
  const membersQ = useQuery(RESOURCE_MEMBERS_QUERY, {
    variables: { project_id: projectId ?? '' },
    skip: !projectId,
    fetchPolicy: 'cache-first',
  });

  return useMemo<SchedulingConfig>(() => {
    const capacityRows: CapacityRow[] =
      capacityQ.data?.capacity_settings ?? [];
    const dayOffRows: DayOffRow[] = capacityQ.data?.day_offs ?? [];
    const groupRows: GroupRow[] = groupsQ.data?.resource_groups ?? [];
    const commitmentRows: CommitmentRow[] =
      commitmentsQ.data?.recurring_commitments ?? [];

    const memberRows: SchedulingResourceMember[] =
      membersQ.data?.resource_members ?? [];
    // userId → resource_member_id (linked placeholders resolve to the row
    // that carries their capacity/leave/groups; R2/R3 key mapping).
    const userToMember: Record<string, string> = {};
    for (const m of memberRows) {
      if (m.user_id) userToMember[m.user_id] = m.resource_member_id;
    }
    const memberKeyFor = (userId?: string | null): string =>
      (userId && userToMember[userId]) || userId || 'unassigned';

    const memberCapacity: Record<string, CapacityConfig> = {};
    for (const row of capacityRows) {
      memberCapacity[row.resource_member_id] = {
        weekdayHours: row.weekday_hours ?? 8,
        weekendHours: row.weekend_hours ?? 0,
        dateOverrides: Object.fromEntries(
          (row.date_overrides ?? []).map((o) => [o.date, o.hours])
        ),
      };
    }

    const memberGroups: Record<string, string[]> = {};
    for (const g of groupRows) {
      for (const m of g.member_ids ?? []) {
        (memberGroups[m] ??= []).push(g.id);
      }
    }

    const daysOff: DayOffRange[] = dayOffRows.map((r) => ({
      id: r.id,
      scope: r.scope.toLowerCase() as DayOffRange['scope'],
      memberKey: r.resource_member_id ?? undefined,
      groupId: r.group_id ?? undefined,
      startDate: r.start_date,
      endDate: r.end_date,
      reason: r.reason ?? undefined,
    }));

    const commitments: RecurringCommitment[] = commitmentRows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      scope: r.scope,
      groupId: r.group_id ?? undefined,
      frequency: r.frequency,
      interval: r.recurrence_interval ?? 1,
      weekday: r.weekday ?? null,
      monthDay: r.month_day ?? null,
      startDate: r.start_date,
      endDate: r.end_date ?? null,
      startHour: r.start_hour,
      durationHours: r.duration_hours,
    }));

    const configFor = (memberKey: string | undefined): CapacityConfig =>
      (memberKey && memberCapacity[memberKey]) || DEFAULT_CAPACITY;

    const groupIdsFor = (memberKey: string | undefined): string[] =>
      (memberKey && memberGroups[memberKey]) || [];

    const capacityFor = (memberKey: string | undefined): CapacityResolver =>
      buildCapacityResolver(
        configFor(memberKey),
        memberKey,
        groupIdsFor(memberKey),
        daysOff
      );

    const truncatedCommitmentRules = new Set<string>();
    const reservedFor = (
      memberKey: string | undefined,
      from: string,
      to: string
    ): Record<string, number> => {
      const applicable = commitments.filter((c) =>
        commitmentAppliesToMember(c, memberKey, groupIdsFor(memberKey))
      );
      if (applicable.length === 0) return {};
      // Detailed variant so TRUNCATED expansions are surfaced instead of
      // silently under-reserving capacity (herdr-260906 residual gap).
      const { occurrences: occ, truncatedRules } = expandCommitmentsDetailed(applicable, from, to);
      for (const ruleId of truncatedRules) truncatedCommitmentRules.add(ruleId);
      const capacity = capacityFor(memberKey);
      const dayCap = (dateKey: string) => {
        const [y, m, d] = dateKey.split('-').map(Number);
        return capacity(new Date(y, m - 1, d));
      };
      return reservedHoursByDate(occ, dayCap);
    };

    return {
      loading: capacityQ.loading || groupsQ.loading || commitmentsQ.loading || membersQ.loading,
      error: capacityQ.error?.message || groupsQ.error?.message || commitmentsQ.error?.message || membersQ.error?.message ||
        (![capacityQ.data?.capacity_settings, capacityQ.data?.day_offs, groupsQ.data?.resource_groups,
          commitmentsQ.data?.recurring_commitments, membersQ.data?.resource_members].every(Array.isArray)
          ? 'Scheduling data is incomplete or unavailable' : undefined),
      resourceMembers: memberRows,
      memberGroups,
      memberCapacity,
      defaultCapacity: DEFAULT_CAPACITY,
      daysOff,
      commitments,
      groups: groupRows.map((g) => ({ id: g.id, name: g.name, memberIds: g.member_ids ?? [] })),
      capacityFor,
      configFor,
      groupIdsFor,
      reservedFor,
      memberKeyFor,
      truncatedCommitmentRules,
    };
  }, [capacityQ.data, capacityQ.loading, capacityQ.error, groupsQ.data, groupsQ.loading, groupsQ.error, commitmentsQ.data, commitmentsQ.loading, commitmentsQ.error, membersQ.data, membersQ.loading, membersQ.error]);
}
