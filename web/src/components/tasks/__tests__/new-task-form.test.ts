import { buildCreateTaskInput, createTaskFormSchema } from '../NewTaskForm';

describe('NewTaskForm create input', () => {
  it('accepts a title alone and sends blank optional fields as null', () => {
    const data = createTaskFormSchema.parse({ title: '  Title only  ' });
    const input = buildCreateTaskInput(data, 'project-id', 'parent-id');

    expect(data.title).toBe('Title only');
    expect(input).toMatchObject({
      title: 'Title only',
      project_id: 'project-id',
      parent_task_id: 'parent-id',
      description: null,
      assignee_id: null,
      assignee_resource_member_id: null,
      start_date: null,
      due_date: null,
      effort: null,
      tags: null,
    });
  });

  it('preserves a supplied start date and subtask parent linkage', () => {
    const data = createTaskFormSchema.parse({
      title: 'Child task',
      startDate: '2030-01-02T03:04',
    });
    const input = buildCreateTaskInput(data, 'project-id', 'parent-id');

    expect(input.parent_task_id).toBe('parent-id');
    expect(input.start_date).toBe(new Date('2030-01-02T03:04').toISOString());
  });

  it('rejects a whitespace-only title and invalid optional values', () => {
    expect(createTaskFormSchema.safeParse({ title: '   ' }).success).toBe(false);
    expect(createTaskFormSchema.safeParse({ title: 'Task', dueDate: 'not-a-date' }).success).toBe(false);
    expect(createTaskFormSchema.safeParse({ title: 'Task', effort: -1 }).success).toBe(false);
  });
});
