/**
 * W3 contract tests — GraphQL op names / variables / return contracts
 * against backend/schema.graphql (Rust SDL).
 */
import { CREATE_PROJECT } from '@/graphql/queries/project';
import { GET_PROJECTS } from '@/graphql/queries/projects';
import {
  INVITE_PROJECT_MEMBER,
  UPDATE_PROJECT_MEMBER_ROLE,
} from '@/graphql/mutations/projectMember';
import {
  REMOVE_MULTIPLE_PROJECT_MEMBERS,
  UPDATE_MULTIPLE_MEMBER_ROLES,
} from '@/graphql/mutations/projectMembers';
import { REORDER_TASKS } from '@/graphql/mutations/tasks';
import { GET_PROJECT_MEMBERS } from '@/graphql/queries/member';
import { buildCreateTaskInput } from '@/components/tasks/NewTaskForm';
import { mapReorderInput, normalizeReorderResult } from '@/hooks/useTasks';

const src = (doc: any) => (doc && doc.loc ? doc.loc.source.body : String(doc));

describe('W3: project creation consumes Rust project_id', () => {
  it('CREATE_PROJECT selects create_project.project_id (snake_case)', () => {
    const body = src(CREATE_PROJECT);
    expect(body).toContain('create_project(input: $input)');
    expect(body).toContain('project_id');
    expect(body).not.toContain('projectId');
  });

  it('new/page.tsx navigates on create_project.project_id (regression for createProject.projectId)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    const page = fs.readFileSync(
      require('path').join(__dirname, '../../app/projects/new/page.tsx'),
      'utf8'
    );
    expect(page).toContain('create_project?.project_id');
    expect(page).not.toContain('createProject.projectId');
  });
});

describe('W3: task creation uses stable project catalog identity', () => {
  it('buildCreateTaskInput sends the selected catalog ID without a legacy progress scalar', () => {
    const input = buildCreateTaskInput({ progressCatalogItemId: 'catalog-id', priorityOrder: 3 } as any, 'p');
    expect(input.progress_catalog_item_id).toBe('catalog-id');
    expect(input).not.toHaveProperty('progress_type');
    expect(input.priority_order).toBe(3);
  });

  it('buildCreateTaskInput maps an empty catalog selection to null', () => {
    const input = buildCreateTaskInput({ progressCatalogItemId: '' } as any, 'p');
    expect(input.progress_catalog_item_id).toBeNull();
    expect(input.priority_order).toBe(0);
  });

  it('status options restricted to Rust-canonical TODO/DOING/DONE/CLOSE (BD-3)', () => {
    const { TASK_STATUS_OPTIONS } = require('@/components/tasks/NewTaskForm');
    const values = TASK_STATUS_OPTIONS.map((o: any) => o.value);
    expect(values.sort()).toEqual(['CLOSE', 'DOING', 'DONE', 'TODO']);
  });
});

describe('W3: member ops match Rust schema', () => {
  it('invite uses add_project_member_by_email (invite_project_member absent in SDL)', () => {
    const body = src(INVITE_PROJECT_MEMBER);
    expect(body).toContain('add_project_member_by_email(project_id: $project_id, email: $email, role: $role)');
    expect(body).not.toContain('invite_project_member(');
  });

  it('single role update uses positional update_project_member args', () => {
    const body = src(UPDATE_PROJECT_MEMBER_ROLE);
    expect(body).toContain('update_project_member(project_id: $project_id, user_id: $user_id, role: $role)');
    expect(body).not.toContain('update_project_member(input:');
  });

  it('bulk ops use update_multiple_members / remove_multiple_project_members', () => {
    expect(src(UPDATE_MULTIPLE_MEMBER_ROLES)).toContain(
      'update_multiple_members(project_id: $projectId, updates: $updates)'
    );
    expect(src(REMOVE_MULTIPLE_PROJECT_MEMBERS)).toContain(
      'remove_multiple_project_members(project_id: $projectId, member_ids: $memberIds)'
    );
  });

  it('GET_PROJECT_MEMBERS does not select non-existent position field', () => {
    const body = src(GET_PROJECT_MEMBERS);
    expect(body).toContain('project_members(project_id: $projectId)');
    expect(body).not.toMatch(/^\s*position$/m);
  });

  it('GET_PROJECTS only selects fields present on Rust Projects type', () => {
    const body = src(GET_PROJECTS);
    expect(body).toContain('member_count');
    expect(body).not.toContain('created_by');
    expect(body).not.toContain('is_public');
  });
});

describe('W3: reorder_tasks [Task!] return contract', () => {
  it('mutation hits reorder_tasks and selects task_id/priority_order', () => {
    const body = src(REORDER_TASKS);
    expect(body).toContain('reorder_tasks(input: $input)');
    expect(body).toContain('priority_order');
  });

  it('maps camelCase payload to ReorderTasksInput snake_case', () => {
    expect(
      mapReorderInput({
        projectId: 'p1',
        taskOrders: [
          { taskId: 't1', priorityOrder: 2 },
          { taskId: 't2', priorityOrder: 1 },
        ],
      })
    ).toEqual({
      project_id: 'p1',
      tasks: [
        { task_id: 't1', priority_order: 2 },
        { task_id: 't2', priority_order: 1 },
      ],
    });
  });

  it('normalizes the [Task!] array result', () => {
    const out = normalizeReorderResult([
      { task_id: 't1', priority_order: 5 },
      { task_id: 't2' },
    ]);
    expect(out).toEqual([
      { taskId: 't1', priorityOrder: 5 },
      { taskId: 't2', priorityOrder: 0 },
    ]);
  });

  it('rejects non-array results (contract violation)', () => {
    expect(() => normalizeReorderResult({ ok: true })).toThrow('[Task!]');
  });
});

/**
 * Increment 1 (project scheduling & WBS) contract — task 1.3.
 * These documents are the locked surface Task 1.4 will consume; they are
 * validated against backend/schema.graphql in w3-sdl-fixture.test.ts.
 */
const PROJECT_PHASES = /* GraphQL */ `
  query ProjectPhases($projectId: ID!) {
    project_phases(project_id: $projectId) {
      phase_id
      phase_key
      display_order
      is_active
      translations { locale name }
    }
  }
`;

const SET_TASK_TAXONOMY = /* GraphQL */ `
  mutation SetTaskTaxonomy($taskId: ID!, $phaseId: ID, $categoryId: ID) {
    set_task_taxonomy(task_id: $taskId, phase_id: $phaseId, category_id: $categoryId)
  }
`;

const RESOURCE_MEMBERS = /* GraphQL */ `
  query ResourceMembers($projectId: ID!) {
    resource_members(project_id: $projectId) {
      resource_member_id
      display_name
      email
      user_id
      member_kind
    }
  }
`;

const IMPORT_DRY_RUN = /* GraphQL */ `
  query ImportDryRun($manifest: JSON!) {
    import_dry_run(manifest: $manifest) {
      source_system
      root_external_id
      heading_count
      task_count
      phase_counts { phase_key count }
      total_effort_hours
      issue_1139 { external_id effort_hours assignee_display_name assignee_linked wbs_row }
      diagnostics
      snapshot_sha256
    }
  }
`;

const SCHEDULE_PROJECTION = /* GraphQL */ `
  query ProjectScheduleProjection($projectId: ID!) {
    project_schedule_projection(project_id: $projectId) {
      project_id
      source
      phase_groups {
        phase_id
        phase_key
        is_unphased
        task_ids
        totals { task_count effort_hours progress start_date end_date }
      }
      wbs_rows {
        __typename
        ... on ScheduleTaskEntry {
          task_id
          title
          start_date
          end_date
          effort_hours
          progress
          depth
        }
        ... on ScheduleSourceHeading {
          heading_id
          external_id
          title
          depth
        }
      }
      totals { task_count effort_hours progress start_date end_date }
    }
  }
`;

describe('Increment 1: scheduling/WBS GraphQL contract', () => {
  it('project phases read uses project_phases with translations', () => {
    expect(PROJECT_PHASES).toContain('project_phases(project_id: $projectId)');
    expect(PROJECT_PHASES).toContain('phase_key');
    expect(PROJECT_PHASES).not.toContain('phaseKey');
  });

  it('task phase/category assignment reuses the task update path via set_task_taxonomy', () => {
    expect(SET_TASK_TAXONOMY).toContain('set_task_taxonomy(task_id: $taskId, phase_id: $phaseId, category_id: $categoryId)');
  });

  it('resource member read is resource_members(project_id)', () => {
    expect(RESOURCE_MEMBERS).toContain('resource_members(project_id: $projectId)');
    expect(RESOURCE_MEMBERS).toContain('member_kind');
  });

  it('import dry-run exposes DryRunReport gates incl. 1139', () => {
    expect(IMPORT_DRY_RUN).toContain('import_dry_run(manifest: $manifest)');
    expect(IMPORT_DRY_RUN).toContain('total_effort_hours');
    expect(IMPORT_DRY_RUN).toContain('issue_1139');
    expect(IMPORT_DRY_RUN).toContain('snapshot_sha256');
  });

  it('project_schedule_projection is CURRENT_TASK_FIELDS with Unphased + distinct heading rows', () => {
    expect(SCHEDULE_PROJECTION).toContain('project_schedule_projection(project_id: $projectId)');
    expect(SCHEDULE_PROJECTION).toContain('source');
    expect(SCHEDULE_PROJECTION).toContain('is_unphased');
    // Heading rows are a DISTINCT type with NO task identity: the heading
    // fragment must never select task_id/start_date/effort/progress.
    const headingFragment = SCHEDULE_PROJECTION.split('... on ScheduleSourceHeading')[1].split('}')[0];
    expect(headingFragment).toContain('heading_id');
    ['task_id', 'start_date', 'end_date', 'effort_hours', 'progress'].forEach((f) =>
      expect(headingFragment).not.toContain(f)
    );
  });
});
