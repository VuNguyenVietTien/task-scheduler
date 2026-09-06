/**
 * W3 SDL-validity fixture (rework BD-4) — validates every W3-changed GraphQL
 * document against the live backend/schema.graphql using only the installed
 * `graphql` package (buildSchema/parse/typeFromAST). Source-string assertions
 * alone missed BD-1/BD-2/BD-3; this walker catches selection/input defects.
 */
import fs from 'fs';
import path from 'path';
import { buildSchema, parse, Kind, typeFromAST } from 'graphql';
import {
  isObjectType,
  isNonNullType,
  isListType,
  isEnumType,
  isScalarType,
  isUnionType,
} from 'graphql';

import { CREATE_PROJECT } from '@/graphql/queries/project';
import { GET_PROJECTS } from '@/graphql/queries/projects';
import { GET_PROJECT_MEMBERS } from '@/graphql/queries/member';
import {
  INVITE_PROJECT_MEMBER,
  UPDATE_PROJECT_MEMBER_ROLE as SINGLE_ROLE_PM,
  // UPDATE_MEMBER_POSITION deliberately excluded: documented backend-absent residual
} from '@/graphql/mutations/projectMember';
import {
  ADD_PROJECT_MEMBER,
  UPDATE_MEMBER_ROLE,
  UPDATE_PROJECT_MEMBER_ROLE as SINGLE_ROLE_PMS,
  UPDATE_MULTIPLE_MEMBER_ROLES,
  REMOVE_MULTIPLE_PROJECT_MEMBERS,
} from '@/graphql/mutations/projectMembers';
import { REORDER_TASKS } from '@/graphql/mutations/tasks';
import { buildCreateTaskInput, TASK_STATUS_OPTIONS } from '@/components/tasks/NewTaskForm';

/**
 * Increment 1 (scheduling/WBS) documents — task 1.3 contract. Inline here
 * until task 1.4 lands the real query/mutation modules.
 */
const PROJECT_PHASES_DOC = /* GraphQL */ `
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
const SET_TASK_TAXONOMY_DOC = /* GraphQL */ `
  mutation SetTaskTaxonomy($taskId: ID!, $phaseId: ID, $categoryId: ID) {
    set_task_taxonomy(task_id: $taskId, phase_id: $phaseId, category_id: $categoryId)
  }
`;
const RESOURCE_MEMBERS_DOC = /* GraphQL */ `
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
const IMPORT_DRY_RUN_DOC = /* GraphQL */ `
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
const SCHEDULE_PROJECTION_DOC = /* GraphQL */ `
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

const schemaPath = path.resolve(__dirname, '../../../../backend/schema.graphql');
const schema = buildSchema(fs.readFileSync(schemaPath, 'utf8'));

const src = (doc: any) => doc.loc.source.body;

function unwrap(t: any): any {
  while (isNonNullType(t) || isListType(t)) return unwrap(t.ofType);
  return t;
}

function checkSelectionSet(parentRaw: any, set: any, path: string, errors: string[]) {
  const parent = unwrap(parentRaw);
  if (isUnionType(parent)) {
    // Union selections: __typename FIELDs plus inline fragments per member.
    for (const sel of set.selections) {
      if (sel.kind === Kind.FIELD && sel.name.value === '__typename') continue;
      if (sel.kind === Kind.INLINE_FRAGMENT) {
        const memberName = sel.typeCondition?.name?.value;
        const member = memberName ? schema.getType(memberName) : undefined;
        if (!member) {
          errors.push(`${path}: union member ${String(memberName)} missing in SDL`);
          continue;
        }
        checkSelectionSet(member, sel.selectionSet, `${path}...on ${memberName}`, errors);
        continue;
      }
      errors.push(`${path}: only __typename/inline fragments select a union, got ${sel.kind}`);
    }
    return;
  }
  if (!isObjectType(parent)) {
    errors.push(`${path}: selection on non-object type ${String(parent)}`);
    return;
  }
  const fields = parent.getFields();
  for (const sel of set.selections) {
    if (sel.kind === Kind.FIELD) {
      checkField(sel);
      continue;
    }
    if (sel.kind === Kind.INLINE_FRAGMENT) {
      const memberName = sel.typeCondition?.name?.value;
      const member = memberName ? schema.getType(memberName) : parent;
      checkSelectionSet(member, sel.selectionSet, `${path}(...${memberName ?? ''})`, errors);
      continue;
    }
    errors.push(`${path}: unexpected selection kind ${sel.kind}`);
  }
  function checkField(sel: any) {
    const name = sel.name.value;
    const field = fields[name];
    if (!field) {
      errors.push(`${path}.${name}: field missing on ${parent.name} (SDL)`);
      return;
    }
    for (const arg of sel.arguments || []) {
      if (!field.args.some((a: any) => a.name === arg.name.value)) {
        errors.push(`${path}.${name}: unknown argument ${arg.name.value} (SDL)`);
      }
    }
    const inner = unwrap(field.type);
    const hasSub = !!sel.selectionSet;
    if (isScalarType(inner) || isEnumType(inner)) {
      if (hasSub) errors.push(`${path}.${name}: sub-selection on leaf ${inner.name}`);
    } else if (isObjectType(inner)) {
      if (!hasSub) errors.push(`${path}.${name}: object type ${inner.name} requires a selection set`);
      else checkSelectionSet(field.type, sel.selectionSet, `${path}.${name}`, errors);
    } else if (isUnionType(inner)) {
      if (!hasSub) errors.push(`${path}.${name}: union type ${inner.name} requires a selection set`);
      else checkSelectionSet(field.type, sel.selectionSet, `${path}.${name}`, errors);
    } else if (hasSub) {
      errors.push(`${path}.${name}: sub-selection on non-selectable ${inner}`);
    }
  }
}

function validateDoc(doc: any, label: string): string[] {
  const errors: string[] = [];
  const ast = parse(typeof doc === 'string' ? doc : src(doc));
  for (const def of ast.definitions) {
    if (def.kind !== Kind.OPERATION_DEFINITION) continue;
    const root = def.operation === 'query' ? schema.getQueryType() : schema.getMutationType();
    if (!root) {
      errors.push(`${label}: no root type`);
      continue;
    }
    // variable types must resolve against the SDL
    for (const vd of def.variableDefinitions || []) {
      const t = typeFromAST(schema, vd.type as any);
      if (!t) errors.push(`${label}: variable $${vd.variable.name.value} type unresolvable in SDL`);
    }
    checkSelectionSet(root, def.selectionSet, label, errors);
  }
  return errors;
}

describe('W3 rework: changed documents are SDL-valid', () => {
  const docs: Array<[any, string]> = [
    [CREATE_PROJECT, 'CREATE_PROJECT'],
    [GET_PROJECTS, 'GET_PROJECTS'],
    [GET_PROJECT_MEMBERS, 'GET_PROJECT_MEMBERS'],
    [INVITE_PROJECT_MEMBER, 'add_project_member_by_email'],
    [SINGLE_ROLE_PM, 'update_project_member (projectMember)'],
    [SINGLE_ROLE_PMS, 'update_project_member (projectMembers)'],
    [ADD_PROJECT_MEMBER, 'add_project_member'],
    [UPDATE_MEMBER_ROLE, 'update_member_role→update_project_member'],
    [UPDATE_MULTIPLE_MEMBER_ROLES, 'update_multiple_members'],
    [REMOVE_MULTIPLE_PROJECT_MEMBERS, 'remove_multiple_project_members'],
    [REORDER_TASKS, 'reorder_tasks'],
    [PROJECT_PHASES_DOC, 'projectPhases (increment 1)'],
    [SET_TASK_TAXONOMY_DOC, 'setTaskTaxonomy (increment 1)'],
    [RESOURCE_MEMBERS_DOC, 'resourceMembers (increment 1)'],
    [IMPORT_DRY_RUN_DOC, 'importDryRun (increment 1)'],
    [SCHEDULE_PROJECTION_DOC, 'projectScheduleProjection (increment 1)'],
  ];

  it.each(docs)('%s — every selection/argument exists in backend/schema.graphql', (_doc, label) => {
    expect(validateDoc(_doc, label as string)).toEqual([]);
  });

  it('BD-1: UPDATE_MULTIPLE_MEMBER_ROLES members selection is exactly { user_id role joined_at user { id ... } }', () => {
    const ast = parse(src(UPDATE_MULTIPLE_MEMBER_ROLES));
    const mut: any = ast.definitions[0];
    const membersField = mut.selectionSet.selections[0].selectionSet.selections.find(
      (s: any) => s.name.value === 'members'
    );
    const names = membersField.selectionSet.selections.map((s: any) => s.name.value).sort();
    expect(names).toEqual(['joined_at', 'role', 'user', 'user_id']);
    const userField = membersField.selectionSet.selections.find((s: any) => s.name.value === 'user');
    const userNames = userField.selectionSet.selections.map((s: any) => s.name.value);
    expect(userNames).toContain('id'); // MemberUserResponse.id, NOT user_id
    expect(userNames).not.toContain('user_id');
  });

  it('BD-2: buildCreateTaskInput covers every required CreateTaskInput field', () => {
    const inputType: any = schema.getType('CreateTaskInput');
    const required = Object.values(inputType.getFields())
      .filter((f: any) => isNonNullType(f.type))
      .map((f: any) => f.name);
    const built = buildCreateTaskInput(
      ({
        title: 't',
        description: 'd',
        status: 'TODO',
        priority: 'HIGH',
        startDate: null,
        dueDate: null,
        assignee: null,
        effort: 1,
        type: null,
        category: null,
        progressType: 'code',
        tags: [],
        priorityOrder: undefined, // form may omit it
      } as any),
      'p1'
    );
    for (const req of required) {
      expect(built).toHaveProperty(req);
      expect((built as any)[req]).not.toBeUndefined();
    }
    expect(required).toContain('priority_order');
    expect((built as any).priority_order).toBe(0);
    expect(buildCreateTaskInput({ priorityOrder: 7 } as any, 'p').priority_order).toBe(7);
  });

  it('BD-3: task status options restricted to canonical TODO/DOING/DONE/CLOSE (⊆ SDL enum)', () => {
    const values = TASK_STATUS_OPTIONS.map((o: { value: string }) => o.value);
    expect(values.sort()).toEqual(['CLOSE', 'DOING', 'DONE', 'TODO']);
    const sdlEnum: any = schema.getType('TaskStatus');
    expect(values.every((v) => sdlEnum.getValues().some((sv: any) => sv.value === v))).toBe(true);
  });
});

describe('Increment 1: scheduling/WBS SDL surface', () => {
  it('projectScheduleProjection: source enum CURRENT_TASK_FIELDS exists', () => {
    const sourceEnum: any = schema.getType('ScheduleProjectionSource');
    expect(sourceEnum).toBeDefined();
    expect(sourceEnum.getValues().map((v: any) => v.name)).toContain('CURRENT_TASK_FIELDS');
  });

  it('ScheduleWbsRow is a union with a DISTINCT heading type carrying no task identity', () => {
    const union: any = schema.getType('ScheduleWbsRow');
    expect(union).toBeDefined();
    const memberNames = union.getTypes().map((t: any) => t.name).sort();
    expect(memberNames).toEqual(['ScheduleSourceHeading', 'ScheduleTaskEntry']);
    const heading: any = schema.getType('ScheduleSourceHeading');
    expect(Object.keys(heading.getFields())).not.toContain('task_id');
    expect(Object.keys(heading.getFields())).not.toContain('progress');
    expect(Object.keys(heading.getFields())).not.toContain('effort_hours');
    const taskEntry: any = schema.getType('ScheduleTaskEntry');
    expect(Object.keys(taskEntry.getFields())).toContain('task_id');
  });

  it('SchedulePhaseGroup exposes explicit Unphased identity (nullable phase_id + is_unphased)', () => {
    const group: any = schema.getType('SchedulePhaseGroup');
    expect(Object.keys(group.getFields()).sort()).toContain('is_unphased');
    expect(Object.keys(group.getFields()).sort()).toContain('phase_key');
    expect(group.getFields().phase_id.type.toString()).not.toContain('!');
  });

  it('decimal truth is a String (legacy effort as normalized display decimal string)', () => {
    const totals: any = schema.getType('ScheduleTotals');
    expect(totals.getFields().effort_hours.type.toString()).toBe('String!');
    const report: any = schema.getType('ImportDryRunReport');
    expect(report.getFields().total_effort_hours.type.toString()).toBe('String!');
  });

  it('increment 1 adds no capacity/allocation/meeting surface', () => {
    const names = Object.keys(schema.getTypeMap());
    ['Allocation', 'Segment', 'Meeting', 'CapacityCalendar'].forEach((t) =>
      expect(names).not.toContain(t)
    );
    expect(
      (schema.getType('ScheduleProjectionSource') as any)
        .getValues()
        .map((v: any) => v.name)
    ).not.toContain('CAPACITY_SCHEDULER');
  });
});
