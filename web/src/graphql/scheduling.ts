/**
 * GraphQL operations for requirement 2/3/4/6/8 backing entities:
 * resource members (placeholders + linking), capacity settings & overrides,
 * days off (individual/project/group), member groups, recurring commitments,
 * timesheet batch save.
 *
 * Backend SDL additions live in `backend/schema.graphql` and resolvers under
 * `backend/src/graphql/resolvers/{resource_members,capacity,timesheet}.rs`.
 * Naming follows the repo convention: snake_case fields/args.
 */
import { gql } from '@apollo/client';

/* ------------------------------ resource members ----------------------------- */

export const RESOURCE_MEMBERS_QUERY = gql`
  query ResourceMembers($project_id: ID!, $only_assignable: Boolean) {
    resource_members(project_id: $project_id, only_assignable: $only_assignable) {
      member_id
      resource_member_id
      project_id
      display_name
      email
      user_id
      member_kind
      linked_at
      access_role
      joined_at
      invited_by
    }
  }
`;

export const CREATE_RESOURCE_MEMBER = gql`
  mutation CreateResourceMember($input: CreateResourceMemberInput!) {
    create_resource_member(input: $input) {
      resource_member_id
      project_id
      display_name
      email
      user_id
      member_kind
      linked_at
    }
  }
`;

export const LINK_RESOURCE_MEMBER_USER = gql`
  mutation LinkResourceMemberUser($resource_member_id: ID!, $user_id: ID!) {
    link_resource_member_user(resource_member_id: $resource_member_id, user_id: $user_id) {
      member_id resource_member_id project_id display_name email user_id member_kind linked_at access_role joined_at invited_by
    }
  }
`;

export const LINK_RESOURCE_MEMBER_BY_EMAIL = gql`
  mutation LinkResourceMemberByEmail($resource_member_id: ID!, $email: String!) {
    link_resource_member_by_email(resource_member_id: $resource_member_id, email: $email) {
      member_id resource_member_id project_id display_name email user_id member_kind linked_at access_role joined_at invited_by
    }
  }
`;

export const SET_PROJECT_MEMBER_ACCESS = gql`
  mutation SetProjectMemberAccess($resource_member_id: ID!, $role: String) {
    set_project_member_access(resource_member_id: $resource_member_id, role: $role) {
      member_id resource_member_id project_id display_name email user_id member_kind linked_at access_role joined_at invited_by
    }
  }
`;

export const REMOVE_RESOURCE_MEMBER = gql`
  mutation RemoveResourceMember($project_id: ID!, $member_id: ID!) {
    remove_resource_member(project_id: $project_id, member_id: $member_id)
  }
`;

/* ---------------------------------- capacity --------------------------------- */

export const CAPACITY_SETTINGS_QUERY = gql`
  query CapacitySettings($project_id: ID!) {
    capacity_settings(project_id: $project_id) {
      resource_member_id
      weekday_hours
      weekend_hours
      date_overrides {
        date
        hours
      }
    }
    day_offs(project_id: $project_id) {
      id
      project_id
      scope
      resource_member_id
      group_id
      start_date
      end_date
      reason
    }
  }
`;

export const SET_MEMBER_CAPACITY = gql`
  mutation SetMemberCapacity($input: SetMemberCapacityInput!) {
    set_member_capacity(input: $input) {
      resource_member_id
      weekday_hours
      weekend_hours
      date_overrides {
        date
        hours
      }
    }
  }
`;

export const SET_CAPACITY_DATE_OVERRIDE = gql`
  mutation SetCapacityDateOverride($input: CapacityDateOverrideInput!) {
    set_capacity_date_override(input: $input) {
      resource_member_id
      weekday_hours
      weekend_hours
      date_overrides {
        date
        hours
      }
    }
  }
`;

export const ADD_DAY_OFF = gql`
  mutation AddDayOff($input: AddDayOffInput!) {
    add_day_off(input: $input) {
      id
      project_id
      scope
      resource_member_id
      group_id
      start_date
      end_date
      reason
    }
  }
`;

export const REMOVE_DAY_OFF = gql`
  mutation RemoveDayOff($id: ID!) {
    remove_day_off(id: $id)
  }
`;

/* ----------------------------------- groups ---------------------------------- */

export const RESOURCE_GROUPS_QUERY = gql`
  query ResourceGroups($project_id: ID!) {
    resource_groups(project_id: $project_id) {
      id
      project_id
      name
      member_ids
    }
  }
`;

export const CREATE_RESOURCE_GROUP = gql`
  mutation CreateResourceGroup($project_id: ID!, $name: String!) {
    create_resource_group(project_id: $project_id, name: $name) {
      id
      project_id
      name
      member_ids
    }
  }
`;

export const DELETE_RESOURCE_GROUP = gql`
  mutation DeleteResourceGroup($id: ID!) {
    delete_resource_group(id: $id)
  }
`;

export const ADD_RESOURCE_GROUP_MEMBERS = gql`
  mutation AddResourceGroupMembers($group_id: ID!, $member_ids: [ID!]!) {
    add_resource_group_members(group_id: $group_id, member_ids: $member_ids)
  }
`;

export const REMOVE_RESOURCE_GROUP_MEMBER = gql`
  mutation RemoveResourceGroupMember($group_id: ID!, $member_id: ID!) {
    remove_resource_group_member(group_id: $group_id, member_id: $member_id)
  }
`;

/** Add project members in bulk by group (links users into project_members). */
export const ADD_PROJECT_MEMBERS_BY_GROUP = gql`
  mutation AddProjectMembersByGroup($group_id: ID!, $role: MemberRole) {
    add_project_members_by_group(group_id: $group_id, role: $role)
  }
`;

/* --------------------------- recurring commitments --------------------------- */

export const RECURRING_COMMITMENTS_QUERY = gql`
  query RecurringCommitments($project_id: ID!) {
    recurring_commitments(project_id: $project_id) {
      id
      project_id
      title
      scope
      group_id
      frequency
      recurrence_interval
      weekday
      month_day
      start_date
      end_date
      start_hour
      duration_hours
    }
  }
`;

export const CREATE_RECURRING_COMMITMENT = gql`
  mutation CreateRecurringCommitment($input: CreateRecurringCommitmentInput!) {
    create_recurring_commitment(input: $input) {
      id
      project_id
      title
      scope
      group_id
      frequency
      recurrence_interval
      weekday
      month_day
      start_date
      end_date
      start_hour
      duration_hours
    }
  }
`;

export const DELETE_RECURRING_COMMITMENT = gql`
  mutation DeleteRecurringCommitment($id: ID!) {
    delete_recurring_commitment(id: $id)
  }
`;

/* --------------------------------- timesheet --------------------------------- */

export const TIMESHEET_ENTRIES_QUERY = gql`
  query TimesheetEntries($project_id: ID!, $from: NaiveDate!, $to: NaiveDate!) {
    my_timesheet_entries(project_id: $project_id, from: $from, to: $to) {
      id
      project_id
      user_id
      task_id
      work_date
      hours
      note
    }
  }
`;

export const SAVE_TIMESHEET_BATCH = gql`
  mutation SaveTimesheetBatch($input: SaveTimesheetBatchInput!) {
    save_timesheet_batch(input: $input) {
      saved
      errors {
        row
        message
      }
    }
  }
`;

/* --------------------------- plan lifecycle (260906) -------------------------- */

export const SAVED_PLANS_QUERY = gql`
  query SavedPlans($project_id: ID!) {
    saved_plans(project_id: $project_id) {
      plan_id
      project_id
      name
      revision
      is_active
      stale
      stale_reasons
      config_fingerprint
      parent_plan_id
      plan_data
      created_at
      updated_at
    }
  }
`;

export const SAVED_PLAN_QUERY = gql`
  query SavedPlan($plan_id: ID!) {
    saved_plan(plan_id: $plan_id) {
      plan_id
      project_id
      name
      revision
      is_active
      stale
      stale_reasons
      config_fingerprint
      parent_plan_id
      plan_data
      created_at
      updated_at
    }
  }
`;

export const PLAN_RECALC_METADATA_QUERY = gql`
  query PlanRecalcMetadata($plan_id: ID!) {
    plan_recalc_metadata(plan_id: $plan_id) {
      plan_id
      project_id
      revision
      stale
      stale_reasons
      current_config_fingerprint
      task_ids
    }
  }
`;

export const SAVE_PLAN_SNAPSHOT_MUTATION = gql`
  mutation SavePlanSnapshot($input: SavePlanSnapshotInput!) {
    save_plan_snapshot(input: $input) {
      plan_id
      project_id
      name
      revision
      is_active
      stale
      stale_reasons
      config_fingerprint
      parent_plan_id
      plan_data
      created_at
      updated_at
    }
  }
`;
