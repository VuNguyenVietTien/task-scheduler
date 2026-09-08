'use client';

/**
 * SchedulingConfigPanel — requirements 2/3/4/6 management UI, mounted in
 * MembersView:
 *
 * R2: create named project members WITHOUT email (placeholder resource
 *     members, stable ids, immediately assignable), and later LINK them to a
 *     real user by that user's email/user id. The resource member id never
 *     changes, so task assignments stay stable across linking.
 * R3: per-member daily capacity (weekday hours default 8, weekend 0), per-date
 *     overrides (incl. working weekends), and days off at individual / group /
 *     project scope. Changing config + Gantt "Recalculate" reallocates tasks
 *     by priority; zero-hour days render no work bar.
 * R4: real member groups; add/remove members to groups; add project members
 *     in bulk from a group. Groups feed leave (group days off) and meetings
 *     (group-scoped recurring commitments).
 * R6: recurring project/group commitments (daily/weekly/monthly, fixed start
 *     hour + duration) that reserve attendee capacity before finite tasks.
 */
import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { toast } from 'sonner';
import {
  RESOURCE_MEMBERS_QUERY,
  CREATE_RESOURCE_MEMBER,
  LINK_RESOURCE_MEMBER_BY_EMAIL,
  SET_PROJECT_MEMBER_ACCESS,
  REMOVE_RESOURCE_MEMBER,
  TRANSFER_PROJECT_OWNERSHIP,
  CAPACITY_SETTINGS_QUERY,
  SET_MEMBER_CAPACITY,
  SET_CAPACITY_DATE_OVERRIDE,
  ADD_DAY_OFF,
  REMOVE_DAY_OFF,
  RESOURCE_GROUPS_QUERY,
  CREATE_RESOURCE_GROUP,
  DELETE_RESOURCE_GROUP,
  ADD_RESOURCE_GROUP_MEMBERS,
  REMOVE_RESOURCE_GROUP_MEMBER,
  ADD_PROJECT_MEMBERS_BY_GROUP,
  RECURRING_COMMITMENTS_QUERY,
  CREATE_RECURRING_COMMITMENT,
  DELETE_RECURRING_COMMITMENT,
} from '@/graphql/scheduling';
import { canRemoveMember, projectRole } from '@/utils/project-permissions';

interface Props {
  projectId: string;
  canManage: boolean;
  currentUserRole: string;
  currentUserId?: string;
  ownerUserId?: string;
  onMembersChanged?: () => void | Promise<void>;
}

interface ResourceMemberRow {
  member_id: string;
  resource_member_id: string;
  display_name: string;
  email: string | null;
  user_id: string | null;
  member_kind: string;
  linked_at: string | null;
  access_role: string | null;
}

interface CapacityRow {
  resource_member_id: string;
  weekday_hours: number;
  weekend_hours: number;
  date_overrides: { date: string; hours: number }[];
}

interface DayOffRow {
  id: string;
  scope: 'INDIVIDUAL' | 'GROUP' | 'PROJECT';
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

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function SchedulingConfigPanel({ projectId, canManage, currentUserRole, currentUserId, ownerUserId, onMembersChanged }: Props) {
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [linkTarget, setLinkTarget] = useState<Record<string, string>>({});
  const [memberRefreshError, setMemberRefreshError] = useState<string | null>(null);
  const [memberRefreshing, setMemberRefreshing] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [memberActionMessage, setMemberActionMessage] = useState<{ error: boolean; text: string } | null>(null);

  const [capacityDraft, setCapacityDraft] = useState<Record<string, { weekday: string; weekend: string }>>({});
  const [overrideDraft, setOverrideDraft] = useState<Record<string, { date: string; hours: string }>>({});
  const [dayOffDraft, setDayOffDraft] = useState({
    scope: 'INDIVIDUAL' as 'INDIVIDUAL' | 'GROUP' | 'PROJECT',
    memberId: '',
    groupId: '',
    startDate: '',
    endDate: '',
    reason: '',
  });

  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [groupMemberDraft, setGroupMemberDraft] = useState<Record<string, string>>({});

  const [commitmentDraft, setCommitmentDraft] = useState({
    title: '',
    scope: 'PROJECT' as 'PROJECT' | 'GROUP',
    groupId: '',
    frequency: 'WEEKLY' as 'DAILY' | 'WEEKLY' | 'MONTHLY',
    interval: '1',
    weekday: '1',
    monthDay: '1',
    startDate: '',
    endDate: '',
    startHour: '9',
    durationHours: '1',
  });

  const membersQ = useQuery(RESOURCE_MEMBERS_QUERY, {
    variables: { project_id: projectId },
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  });
  const capacityQ = useQuery(CAPACITY_SETTINGS_QUERY, {
    variables: { project_id: projectId },
    fetchPolicy: 'cache-and-network',
  });
  const groupsQ = useQuery(RESOURCE_GROUPS_QUERY, {
    variables: { project_id: projectId },
    fetchPolicy: 'cache-and-network',
  });
  const commitmentsQ = useQuery(RECURRING_COMMITMENTS_QUERY, {
    variables: { project_id: projectId },
    fetchPolicy: 'cache-and-network',
  });

  const recordMemberResult = (member?: ResourceMemberRow) => {
    if (!member?.resource_member_id) return;
    // Resource handles are not Apollo's default id key; retain confirmed writes explicitly.
    membersQ.updateQuery?.((data: { resource_members?: ResourceMemberRow[] }) => {
      const rows = data?.resource_members ?? [];
      const present = rows.some((row) => row.resource_member_id === member.resource_member_id);
      return { ...data, resource_members: present
        ? rows.map((row) => row.resource_member_id === member.resource_member_id ? { ...row, ...member } : row)
        : [...rows, member] };
    });
  };

  const refreshMembers = async (afterWrite = false) => {
    setMemberRefreshing(true);
    try {
      const result = await membersQ.refetch();
      if (result.error || result.errors?.length || !Array.isArray(result.data?.resource_members)) {
        throw result.error ?? new Error(result.errors?.[0]?.message ?? 'Member list returned no data.');
      }
      setMemberRefreshError(null);
    } catch (error) {
      const message = `${afterWrite ? 'Member change saved, but refresh failed: ' : 'Member refresh failed: '}${(error as Error).message}`;
      setMemberRefreshError(message);
      toast.error(message);
    } finally {
      setMemberRefreshing(false);
    }
  };
  const memberError = memberRefreshError ?? membersQ.error?.message ??
    (!membersQ.loading && !Array.isArray(membersQ.data?.resource_members) ? 'Member list returned no data.' : null);

  const [createMember] = useMutation(CREATE_RESOURCE_MEMBER);
  const [linkMember] = useMutation(LINK_RESOURCE_MEMBER_BY_EMAIL);
  const [setMemberAccess] = useMutation(SET_PROJECT_MEMBER_ACCESS);
  const [removeMember] = useMutation(REMOVE_RESOURCE_MEMBER);
  const [transferOwnership] = useMutation(TRANSFER_PROJECT_OWNERSHIP);
  const [setCapacity] = useMutation(SET_MEMBER_CAPACITY);
  const [setOverride] = useMutation(SET_CAPACITY_DATE_OVERRIDE);
  const [addDayOff] = useMutation(ADD_DAY_OFF);
  const [removeDayOff] = useMutation(REMOVE_DAY_OFF);
  const [createGroup] = useMutation(CREATE_RESOURCE_GROUP);
  const [deleteGroup] = useMutation(DELETE_RESOURCE_GROUP);
  const [addGroupMembers] = useMutation(ADD_RESOURCE_GROUP_MEMBERS);
  const [removeGroupMember] = useMutation(REMOVE_RESOURCE_GROUP_MEMBER);
  const [addMembersByGroup] = useMutation(ADD_PROJECT_MEMBERS_BY_GROUP);
  const [createCommitment] = useMutation(CREATE_RECURRING_COMMITMENT);
  const [deleteCommitment] = useMutation(DELETE_RECURRING_COMMITMENT);

  const resourceMembers: ResourceMemberRow[] = membersQ.data?.resource_members ?? [];
  const capacityRows: CapacityRow[] = capacityQ.data?.capacity_settings ?? [];
  const dayOffs: DayOffRow[] = capacityQ.data?.day_offs ?? [];
  const groups: GroupRow[] = groupsQ.data?.resource_groups ?? [];
  const commitments: CommitmentRow[] = commitmentsQ.data?.recurring_commitments ?? [];

  const memberName = (id: string | null) =>
    resourceMembers.find((m) => m.resource_member_id === id)?.display_name ?? id ?? '';
  const groupName = (id: string | null) => groups.find((g) => g.id === id)?.name ?? id ?? '';

  /* ------------------------------ R2 actions ------------------------------ */

  const handleCreateMember = async () => {
    if (!newMemberName.trim()) return;
    try {
      const result = await createMember({
        variables: {
          input: {
            project_id: projectId,
            display_name: newMemberName.trim(),
            email: newMemberEmail.trim() || null,
          },
        },
      });
      recordMemberResult(result.data?.create_resource_member);
      toast.success(`Member "${newMemberName.trim()}" created (no account needed)`);
      setNewMemberName('');
      setNewMemberEmail('');
      await refreshMembers(true);
    } catch (e) {
      toast.error(`Create failed: ${(e as Error).message}`);
    }
  };

  const handleLink = async (memberId: string) => {
    const value = (linkTarget[memberId] ?? '').trim();
    if (!value) return;
    try {
      const result = await linkMember({
        variables: {
          resource_member_id: memberId,
          email: value,
        },
      });
      recordMemberResult(result.data?.link_resource_member_by_email);
      toast.success('Member linked; task assignments preserved');
      setLinkTarget((p) => ({ ...p, [memberId]: '' }));
      await refreshMembers(true);
    } catch (e) {
      toast.error(`Link failed: ${(e as Error).message}`);
    }
  };

  const handleTransferOwnership = async (member: ResourceMemberRow) => {
    if (!member.user_id || !window.confirm(`Transfer project ownership to ${member.display_name}?`)) return;
    setMemberActionMessage(null);
    try {
      const result = await transferOwnership({ variables: {
        project_id: projectId,
        new_owner_user_id: member.user_id,
      }});
      if (!result.data?.transfer_project_ownership) throw new Error('Ownership was not transferred.');
      const text = `Ownership transferred to ${member.display_name}`;
      setMemberActionMessage({ error: false, text });
      toast.success(text);
      await onMembersChanged?.();
    } catch (error) {
      const text = `Transfer failed: ${(error as Error).message}`;
      setMemberActionMessage({ error: true, text });
      toast.error(text);
    }
  };

  const handleRemoveMember = async (member: ResourceMemberRow) => {
    if (!window.confirm(`Remove ${member.display_name} from this project?`)) return;
    setRemovingMemberId(member.member_id);
    setMemberActionMessage(null);
    try {
      const result = await removeMember({ variables: {
        project_id: projectId,
        member_id: member.member_id,
      }});
      if (!result.data?.remove_resource_member) throw new Error('Member was not removed.');
      membersQ.updateQuery?.((data: { resource_members?: ResourceMemberRow[] }) => ({
        ...data,
        resource_members: (data?.resource_members ?? []).filter((row) => row.member_id !== member.member_id),
      }));
      await Promise.all([refreshMembers(true), capacityQ.refetch(), groupsQ.refetch(), onMembersChanged?.()]);
      const text = `${member.display_name} removed from the project`;
      setMemberActionMessage({ error: false, text });
      toast.success(text);
    } catch (error) {
      const text = `Remove failed: ${(error as Error).message}`;
      setMemberActionMessage({ error: true, text });
      toast.error(text);
    } finally {
      setRemovingMemberId(null);
    }
  };

  /* ------------------------------ R3 actions ------------------------------ */

  const handleSetCapacity = async (memberId: string) => {
    const draft = capacityDraft[memberId] ?? { weekday: '8', weekend: '0' };
    try {
      await setCapacity({
        variables: {
          input: {
            resource_member_id: memberId,
            weekday_hours: Number(draft.weekday) || 0,
            weekend_hours: Number(draft.weekend) || 0,
          },
        },
      });
      toast.success('Capacity saved — use Gantt “Recalculate” to reallocate tasks');
      capacityQ.refetch();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    }
  };

  const handleSetOverride = async (memberId: string) => {
    const draft = overrideDraft[memberId] ?? { date: '', hours: '' };
    if (!draft.date || draft.hours === '') return;
    try {
      await setOverride({
        variables: {
          input: {
            resource_member_id: memberId,
            date: draft.date,
            hours: Number(draft.hours) || 0,
          },
        },
      });
      toast.success(`Override saved for ${draft.date}`);
      setOverrideDraft((p) => ({ ...p, [memberId]: { date: '', hours: '' } }));
      capacityQ.refetch();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    }
  };

  const handleAddDayOff = async () => {
    if (!dayOffDraft.startDate || !dayOffDraft.endDate) return;
    if (dayOffDraft.scope === 'INDIVIDUAL' && !dayOffDraft.memberId) return;
    if (dayOffDraft.scope === 'GROUP' && !dayOffDraft.groupId) return;
    try {
      await addDayOff({
        variables: {
          input: {
            project_id: projectId,
            scope: dayOffDraft.scope,
            resource_member_id:
              dayOffDraft.scope === 'INDIVIDUAL' ? dayOffDraft.memberId : null,
            group_id: dayOffDraft.scope === 'GROUP' ? dayOffDraft.groupId : null,
            start_date: dayOffDraft.startDate,
            end_date: dayOffDraft.endDate,
            reason: dayOffDraft.reason || null,
          },
        },
      });
      toast.success('Day off saved');
      setDayOffDraft((p) => ({ ...p, startDate: '', endDate: '', reason: '' }));
      capacityQ.refetch();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    }
  };

  /* ------------------------------ R4 actions ------------------------------ */

  const handleCreateGroup = async () => {
    if (!groupNameDraft.trim()) return;
    try {
      await createGroup({
        variables: { project_id: projectId, name: groupNameDraft.trim() },
      });
      toast.success('Group created');
      setGroupNameDraft('');
      groupsQ.refetch();
    } catch (e) {
      toast.error(`Create failed: ${(e as Error).message}`);
    }
  };

  const handleAddToGroup = async (groupId: string) => {
    const memberId = groupMemberDraft[groupId];
    if (!memberId) return;
    try {
      await addGroupMembers({ variables: { group_id: groupId, member_ids: [memberId] } });
      setGroupMemberDraft((p) => ({ ...p, [groupId]: '' }));
      groupsQ.refetch();
    } catch (e) {
      toast.error(`Add failed: ${(e as Error).message}`);
    }
  };

  const handleAddProjectMembersByGroup = async (groupId: string) => {
    try {
      const res = await addMembersByGroup({
        variables: { group_id: groupId, role: null },
      });
      toast.success(`Added ${res.data?.add_project_members_by_group ?? 0} linked users to the project`);
    } catch (e) {
      toast.error(`Add failed: ${(e as Error).message}`);
    }
  };

  /* ------------------------------ R6 actions ------------------------------ */

  const handleCreateCommitment = async () => {
    const d = commitmentDraft;
    if (!d.title.trim() || !d.startDate) return;
    const hours = Number(d.startHour);
    const duration = Number(d.durationHours);
    if (!(hours >= 0 && hours <= 23) || !(duration > 0 && duration <= 24)) {
      toast.error('Start hour must be 0–23 and duration 0–24h');
      return;
    }
    try {
      await createCommitment({
        variables: {
          input: {
            project_id: projectId,
            title: d.title.trim(),
            scope: d.scope,
            group_id: d.scope === 'GROUP' ? d.groupId : null,
            frequency: d.frequency,
            recurrence_interval: Math.max(1, Number(d.interval) || 1),
            weekday: d.frequency === 'WEEKLY' ? Number(d.weekday) : null,
            month_day: d.frequency === 'MONTHLY' ? Number(d.monthDay) : null,
            start_date: d.startDate,
            end_date: d.endDate || null,
            start_hour: hours,
            duration_hours: duration,
          },
        },
      });
      toast.success('Recurring commitment created');
      setCommitmentDraft((p) => ({ ...p, title: '' }));
      commitmentsQ.refetch();
    } catch (e) {
      toast.error(`Create failed: ${(e as Error).message}`);
    }
  };

  const inputCls = 'px-2 py-1 border rounded text-xs';
  const labelCls = 'text-xs font-medium text-slate-600';

  return (
    <div className="space-y-6" data-testid="scheduling-config-panel">
      {/* ------------------------- R2: resource members ------------------------- */}
      <section className="border rounded-lg p-4 bg-white" data-testid="resource-members-section">
        <h3 className="text-sm font-semibold mb-2">Project members (named, no email required)</h3>
        {(membersQ.loading || memberRefreshing) && <p role="status">Loading project members…</p>}
        {memberError && (
          <div role="alert" className="mb-2 text-sm text-red-700">
            Could not load project members: {memberError}
            <button type="button" className="ml-2 underline" disabled={memberRefreshing} onClick={() => refreshMembers()}>Retry members</button>
          </div>
        )}
        {memberActionMessage && (
          <p role={memberActionMessage.error ? 'alert' : 'status'} className={`mb-2 text-sm ${memberActionMessage.error ? 'text-red-700' : 'text-green-700'}`}>
            {memberActionMessage.text}
          </p>
        )}
        {canManage && (
          <div className="flex flex-wrap gap-2 mb-3">
            <input
              className={inputCls}
              placeholder="Display name *"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              aria-label="New member display name"
            />
            <input
              className={inputCls}
              placeholder="Email (optional)"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              aria-label="New member email"
            />
            <button
              className="px-3 py-1 bg-blue-600 text-white rounded text-xs"
              onClick={handleCreateMember}
              disabled={!newMemberName.trim() || memberRefreshing}
              data-testid="create-resource-member-btn"
            >
              Add member
            </button>
          </div>
        )}
        <table className="w-full text-xs" data-testid="resource-members-table">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-1">Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Access</th>
              {canManage && <th>Link to existing account</th>}
              {canManage && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {resourceMembers.map((m) => (
              <tr key={m.resource_member_id} className="border-b border-slate-100" data-testid="resource-member-row">
                <td className="py-1">{m.display_name}</td>
                <td>{m.email ?? <span className="text-slate-400">—</span>}</td>
                <td>
                  {m.user_id ? (
                    <span className="text-green-600" data-testid={`linked-${m.resource_member_id}`}>
                      linked
                    </span>
                  ) : (
                    <span className="text-amber-600">placeholder</span>
                  )}
                </td>
                <td>
                  {canManage ? (
                    <select
                      className={inputCls}
                      aria-label={`Access role for ${m.display_name}`}
                      value={m.access_role ?? ''}
                      onChange={async (event) => {
                        try {
                          const result = await setMemberAccess({ variables: {
                            resource_member_id: m.resource_member_id,
                            role: event.target.value || null,
                          }});
                          recordMemberResult(result.data?.set_project_member_access);
                          await refreshMembers(true);
                        } catch (error) {
                          toast.error(`Access change failed: ${(error as Error).message}`);
                        }
                      }}
                    >
                      <option value="">No access</option>
                      {projectRole(currentUserRole) === 'manager' && <option value="manager">Manager</option>}
                      {projectRole(currentUserRole) === 'manager' && <option value="leader">Leader</option>}
                      <option value="member">Member</option>
                      <option value="guest">Guest</option>
                    </select>
                  ) : (m.access_role ?? <span className="text-slate-400">none</span>)}
                </td>
                {canManage && (
                  <td>
                    {!m.user_id && (
                      <span className="flex gap-1">
                        <input
                          className={inputCls}
                          placeholder="existing account email"
                          aria-label={`Link user for ${m.display_name}`}
                          value={linkTarget[m.resource_member_id] ?? ''}
                          onChange={(e) => setLinkTarget((p) => ({ ...p, [m.resource_member_id]: e.target.value }))}
                        />
                        <button
                          className="px-2 py-1 border rounded text-xs"
                          onClick={() => handleLink(m.resource_member_id)}
                          disabled={!(linkTarget[m.resource_member_id] ?? '').trim()}
                          data-testid={`link-member-btn-${m.resource_member_id}`}
                        >
                          Link
                        </button>
                      </span>
                    )}
                  </td>
                )}
                {canManage && (
                  <td className="space-x-1">
                    {canRemoveMember(
                      currentUserRole,
                      m.access_role,
                      m.user_id === currentUserId,
                      currentUserId === ownerUserId,
                      m.user_id === ownerUserId,
                    ) && (
                      <button
                        type="button"
                        className="px-2 py-1 text-red-600 border border-red-200 rounded disabled:opacity-50"
                        onClick={() => handleRemoveMember(m)}
                        disabled={removingMemberId !== null || memberRefreshing}
                        aria-label={`Remove ${m.display_name}`}
                      >
                        {removingMemberId === m.member_id ? 'Removing…' : 'Remove'}
                      </button>
                    )}
                    {currentUserId === ownerUserId && m.user_id && m.user_id !== ownerUserId && (
                      <button
                        type="button"
                        className="px-2 py-1 text-blue-600 border border-blue-200 rounded"
                        onClick={() => handleTransferOwnership(m)}
                        aria-label={`Transfer ownership to ${m.display_name}`}
                      >
                        Transfer ownership
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {!membersQ.loading && !memberRefreshing && !memberError && resourceMembers.length === 0 && (
              <tr>
                <td colSpan={canManage ? 6 : 4} className="py-2 text-slate-400">
                  No resource members yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* ------------------------- R3: capacity + days off ------------------------- */}
      <section className="border rounded-lg p-4 bg-white" data-testid="capacity-section">
        <h3 className="text-sm font-semibold mb-2">Daily capacity &amp; days off</h3>
        <table className="w-full text-xs" data-testid="capacity-table">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-1">Member</th>
              <th>Weekday h</th>
              <th>Weekend h</th>
              <th>Date override (working weekend / holiday)</th>
              {canManage && <th />}
            </tr>
          </thead>
          <tbody>
            {resourceMembers.map((m) => {
              const cap = capacityRows.find((c) => c.resource_member_id === m.resource_member_id);
              const draft = capacityDraft[m.resource_member_id] ?? {
                weekday: String(cap?.weekday_hours ?? 8),
                weekend: String(cap?.weekend_hours ?? 0),
              };
              const od = overrideDraft[m.resource_member_id] ?? { date: '', hours: '' };
              return (
                <tr key={m.resource_member_id} className="border-b border-slate-100">
                  <td className="py-1">{m.display_name}</td>
                  <td>
                    {canManage ? (
                      <input
                        className={`${inputCls} w-14`}
                        aria-label={`Weekday hours ${m.display_name}`}
                        value={draft.weekday}
                        onChange={(e) =>
                          setCapacityDraft((p) => ({
                            ...p,
                            [m.resource_member_id]: { ...draft, weekday: e.target.value },
                          }))
                        }
                      />
                    ) : (
                      cap?.weekday_hours ?? 8
                    )}
                  </td>
                  <td>
                    {canManage ? (
                      <input
                        className={`${inputCls} w-14`}
                        aria-label={`Weekend hours ${m.display_name}`}
                        value={draft.weekend}
                        onChange={(e) =>
                          setCapacityDraft((p) => ({
                            ...p,
                            [m.resource_member_id]: { ...draft, weekend: e.target.value },
                          }))
                        }
                      />
                    ) : (
                      cap?.weekend_hours ?? 0
                    )}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1 items-center">
                      {(cap?.date_overrides ?? []).map((o) => (
                        <span key={o.date} className="px-1.5 py-0.5 bg-slate-100 rounded">
                          {o.date}: {o.hours}h
                        </span>
                      ))}
                      {canManage && (
                        <>
                          <input
                            type="date"
                            className={inputCls}
                            aria-label={`Override date ${m.display_name}`}
                            value={od.date}
                            onChange={(e) =>
                              setOverrideDraft((p) => ({
                                ...p,
                                [m.resource_member_id]: { ...od, date: e.target.value },
                              }))
                            }
                          />
                          <input
                            className={`${inputCls} w-14`}
                            placeholder="h"
                            aria-label={`Override hours ${m.display_name}`}
                            value={od.hours}
                            onChange={(e) =>
                              setOverrideDraft((p) => ({
                                ...p,
                                [m.resource_member_id]: { ...od, hours: e.target.value },
                              }))
                            }
                          />
                          <button
                            className="px-2 py-1 border rounded"
                            onClick={() => handleSetOverride(m.resource_member_id)}
                            disabled={!od.date || od.hours === ''}
                          >
                            Set
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                  {canManage && (
                    <td>
                      <button
                        className="px-2 py-1 bg-emerald-600 text-white rounded"
                        onClick={() => handleSetCapacity(m.resource_member_id)}
                        data-testid={`save-capacity-${m.resource_member_id}`}
                      >
                        Save
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-3">
          <div className="text-xs font-medium text-slate-600 mb-1">Days off (leave / holidays)</div>
          {canManage && (
            <div className="flex flex-wrap gap-2 mb-2">
              <select
                className={inputCls}
                aria-label="Day off scope"
                value={dayOffDraft.scope}
                onChange={(e) =>
                  setDayOffDraft((p) => ({ ...p, scope: e.target.value as typeof p.scope }))
                }
              >
                <option value="INDIVIDUAL">Individual</option>
                <option value="GROUP">Group</option>
                <option value="PROJECT">Whole project</option>
              </select>
              {dayOffDraft.scope === 'INDIVIDUAL' && (
                <select
                  className={inputCls}
                  aria-label="Day off member"
                  value={dayOffDraft.memberId}
                  onChange={(e) => setDayOffDraft((p) => ({ ...p, memberId: e.target.value }))}
                >
                  <option value="">Select member…</option>
                  {resourceMembers.map((m) => (
                    <option key={m.resource_member_id} value={m.resource_member_id}>
                      {m.display_name}
                    </option>
                  ))}
                </select>
              )}
              {dayOffDraft.scope === 'GROUP' && (
                <select
                  className={inputCls}
                  aria-label="Day off group"
                  value={dayOffDraft.groupId}
                  onChange={(e) => setDayOffDraft((p) => ({ ...p, groupId: e.target.value }))}
                >
                  <option value="">Select group…</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="date"
                className={inputCls}
                aria-label="Day off start"
                value={dayOffDraft.startDate}
                onChange={(e) => setDayOffDraft((p) => ({ ...p, startDate: e.target.value }))}
              />
              <input
                type="date"
                className={inputCls}
                aria-label="Day off end"
                value={dayOffDraft.endDate}
                onChange={(e) => setDayOffDraft((p) => ({ ...p, endDate: e.target.value }))}
              />
              <input
                className={inputCls}
                placeholder="Reason"
                aria-label="Day off reason"
                value={dayOffDraft.reason}
                onChange={(e) => setDayOffDraft((p) => ({ ...p, reason: e.target.value }))}
              />
              <button
                className="px-3 py-1 bg-blue-600 text-white rounded text-xs"
                onClick={handleAddDayOff}
                data-testid="add-day-off-btn"
              >
                Add day off
              </button>
            </div>
          )}
          <ul className="text-xs space-y-1" data-testid="day-off-list">
            {dayOffs.map((d) => (
              <li key={d.id} className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-slate-100 rounded">{d.scope}</span>
                <span>
                  {d.scope === 'INDIVIDUAL' && memberName(d.resource_member_id)}
                  {d.scope === 'GROUP' && groupName(d.group_id)}
                  {d.scope === 'PROJECT' && 'Everyone'}
                  : {d.start_date} → {d.end_date}
                  {d.reason ? ` (${d.reason})` : ''}
                </span>
                {canManage && (
                  <button
                    className="text-red-600"
                    onClick={async () => {
                      await removeDayOff({ variables: { id: d.id } });
                      capacityQ.refetch();
                    }}
                    aria-label={`Remove day off ${d.id}`}
                  >
                    remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------ R4: groups ------------------------------ */}
      <section className="border rounded-lg p-4 bg-white" data-testid="groups-section">
        <h3 className="text-sm font-semibold mb-2">Member groups</h3>
        {canManage && (
          <div className="flex gap-2 mb-3">
            <input
              className={inputCls}
              placeholder="Group name"
              aria-label="New group name"
              value={groupNameDraft}
              onChange={(e) => setGroupNameDraft(e.target.value)}
            />
            <button
              className="px-3 py-1 bg-blue-600 text-white rounded text-xs"
              onClick={handleCreateGroup}
              disabled={!groupNameDraft.trim()}
              data-testid="create-group-btn"
            >
              Create group
            </button>
          </div>
        )}
        <ul className="space-y-2 text-xs" data-testid="group-list">
          {groups.map((g) => (
            <li key={g.id} className="border rounded p-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{g.name}</span>
                {canManage && (
                  <span className="flex gap-2">
                    <button
                      className="px-2 py-1 border rounded"
                      onClick={() => handleAddProjectMembersByGroup(g.id)}
                      data-testid={`add-project-members-by-group-${g.id}`}
                      title="Add all linked group users as project members"
                    >
                      Add to project
                    </button>
                    <button
                      className="text-red-600"
                      onClick={async () => {
                        await deleteGroup({ variables: { id: g.id } });
                        groupsQ.refetch();
                      }}
                    >
                      delete
                    </button>
                  </span>
                )}
              </div>
              <div className="mt-1 text-slate-600">
                {g.member_ids.map((id) => (
                  <span key={id} className="inline-flex items-center gap-1 mr-2">
                    {memberName(id)}
                    {canManage && (
                      <button
                        className="text-red-500"
                        onClick={async () => {
                          await removeGroupMember({ variables: { group_id: g.id, member_id: id } });
                          groupsQ.refetch();
                        }}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                {g.member_ids.length === 0 && <span className="text-slate-400">empty</span>}
              </div>
              {canManage && (
                <div className="mt-1 flex gap-1">
                  <select
                    className={inputCls}
                    aria-label={`Add member to ${g.name}`}
                    value={groupMemberDraft[g.id] ?? ''}
                    onChange={(e) =>
                      setGroupMemberDraft((p) => ({ ...p, [g.id]: e.target.value }))
                    }
                  >
                    <option value="">Add member…</option>
                    {resourceMembers.map((m) => (
                      <option key={m.resource_member_id} value={m.resource_member_id}>
                        {m.display_name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="px-2 py-1 border rounded"
                    onClick={() => handleAddToGroup(g.id)}
                    disabled={!groupMemberDraft[g.id]}
                  >
                    Add
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------- R6: recurring commitments (meetings) ------------------- */}
      <section className="border rounded-lg p-4 bg-white" data-testid="commitments-section">
        <h3 className="text-sm font-semibold mb-2">
          Recurring commitments (reserve capacity before tasks)
        </h3>
        {canManage && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-xs">
            <input
              className={inputCls}
              placeholder="Title *"
              aria-label="Commitment title"
              value={commitmentDraft.title}
              onChange={(e) => setCommitmentDraft((p) => ({ ...p, title: e.target.value }))}
            />
            <select
              className={inputCls}
              aria-label="Commitment scope"
              value={commitmentDraft.scope}
              onChange={(e) =>
                setCommitmentDraft((p) => ({ ...p, scope: e.target.value as 'PROJECT' | 'GROUP' }))
              }
            >
              <option value="PROJECT">Whole project</option>
              <option value="GROUP">Group</option>
            </select>
            {commitmentDraft.scope === 'GROUP' && (
              <select
                className={inputCls}
                aria-label="Commitment group"
                value={commitmentDraft.groupId}
                onChange={(e) => setCommitmentDraft((p) => ({ ...p, groupId: e.target.value }))}
              >
                <option value="">Select group…</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}
            <select
              className={inputCls}
              aria-label="Commitment frequency"
              value={commitmentDraft.frequency}
              onChange={(e) =>
                setCommitmentDraft((p) => ({
                  ...p,
                  frequency: e.target.value as 'DAILY' | 'WEEKLY' | 'MONTHLY',
                }))
              }
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
            {commitmentDraft.frequency === 'WEEKLY' && (
              <select
                className={inputCls}
                aria-label="Commitment weekday"
                value={commitmentDraft.weekday}
                onChange={(e) => setCommitmentDraft((p) => ({ ...p, weekday: e.target.value }))}
              >
                {WEEKDAY_LABELS.map((label, idx) => (
                  <option key={idx} value={idx}>
                    {label}
                  </option>
                ))}
              </select>
            )}
            {commitmentDraft.frequency === 'MONTHLY' && (
              <input
                className={`${inputCls} w-16`}
                type="number"
                min={1}
                max={31}
                aria-label="Commitment day of month"
                value={commitmentDraft.monthDay}
                onChange={(e) => setCommitmentDraft((p) => ({ ...p, monthDay: e.target.value }))}
              />
            )}
            <input
              className={`${inputCls} w-16`}
              type="number"
              min={1}
              aria-label="Commitment interval"
              title="Every N days/weeks/months"
              value={commitmentDraft.interval}
              onChange={(e) => setCommitmentDraft((p) => ({ ...p, interval: e.target.value }))}
            />
            <input
              type="date"
              className={inputCls}
              aria-label="Commitment start date"
              value={commitmentDraft.startDate}
              onChange={(e) => setCommitmentDraft((p) => ({ ...p, startDate: e.target.value }))}
            />
            <input
              type="date"
              className={inputCls}
              aria-label="Commitment end date"
              value={commitmentDraft.endDate}
              onChange={(e) => setCommitmentDraft((p) => ({ ...p, endDate: e.target.value }))}
            />
            <input
              className={`${inputCls} w-16`}
              type="number"
              min={0}
              max={23}
              aria-label="Commitment start hour"
              value={commitmentDraft.startHour}
              onChange={(e) => setCommitmentDraft((p) => ({ ...p, startHour: e.target.value }))}
            />
            <input
              className={`${inputCls} w-16`}
              type="number"
              min={0.5}
              max={24}
              step={0.5}
              aria-label="Commitment duration hours"
              value={commitmentDraft.durationHours}
              onChange={(e) => setCommitmentDraft((p) => ({ ...p, durationHours: e.target.value }))}
            />
            <button
              className="px-3 py-1 bg-blue-600 text-white rounded text-xs"
              onClick={handleCreateCommitment}
              disabled={!commitmentDraft.title.trim() || !commitmentDraft.startDate}
              data-testid="create-commitment-btn"
            >
              Add commitment
            </button>
          </div>
        )}
        <ul className="text-xs space-y-1" data-testid="commitment-list">
          {commitments.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-slate-100 rounded">{c.frequency}</span>
              <span className="font-medium">{c.title}</span>
              <span className="text-slate-600">
                {c.scope === 'GROUP' ? groupName(c.group_id) : 'project-wide'} ·{' '}
                {String(c.start_hour).padStart(2, '0')}:00 +{c.duration_hours}h · from {c.start_date}
                {c.end_date ? ` to ${c.end_date}` : ''}
                {c.frequency === 'WEEKLY' ? ` · ${WEEKDAY_LABELS[c.weekday ?? 1]}` : ''}
                {c.frequency === 'MONTHLY' ? ` · day ${c.month_day}` : ''}
                {c.recurrence_interval > 1 ? ` · every ${c.recurrence_interval}` : ''}
              </span>
              {canManage && (
                <button
                  className="text-red-600"
                  onClick={async () => {
                    await deleteCommitment({ variables: { id: c.id } });
                    commitmentsQ.refetch();
                  }}
                  aria-label={`Delete commitment ${c.id}`}
                >
                  delete
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
