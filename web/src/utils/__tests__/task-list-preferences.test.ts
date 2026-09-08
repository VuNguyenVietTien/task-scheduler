import {
  DEFAULT_TASK_LIST_COLUMNS,
  loadTaskListPreferences,
  saveTaskListPreferences,
  taskListPreferenceKey,
} from '@/utils/task-list-preferences';

describe('task list preferences', () => {
  beforeEach(() => localStorage.clear());

  it('persists filters and columns in a project/user scoped key', () => {
    const key = taskListPreferenceKey('project-1', 'user-1');
    saveTaskListPreferences(key, { filters: { status: 'DONE', searchQuery: 'ship' }, columns: ['title', 'createdAt'] });

    expect(loadTaskListPreferences(key)).toEqual({
      filters: { status: 'DONE', searchQuery: 'ship' },
      columns: ['title', 'createdAt'],
    });
    expect(loadTaskListPreferences(taskListPreferenceKey('project-2', 'user-1')).columns).toEqual(DEFAULT_TASK_LIST_COLUMNS);
  });

  it.each([
    '{bad json',
    'null',
    JSON.stringify({ filters: null, columns: ['bogus'] }),
    JSON.stringify({ filters: [], columns: {} }),
  ])('falls back for malformed storage: %s', (stored) => {
    localStorage.setItem('bad', stored);
    expect(loadTaskListPreferences('bad')).toEqual({ filters: {}, columns: DEFAULT_TASK_LIST_COLUMNS });
  });

  it('drops invalid filter values and ignores denied storage writes', () => {
    localStorage.setItem('mixed', JSON.stringify({
      filters: { status: ['DONE'], priority: 'BOGUS', searchQuery: 42, projectId: 'project-1' },
      columns: ['title'],
    }));
    expect(loadTaskListPreferences('mixed')).toEqual({ filters: { projectId: 'project-1' }, columns: ['title'] });

    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    expect(() => saveTaskListPreferences('denied', { filters: {}, columns: ['title'] })).not.toThrow();
    setItem.mockRestore();
  });
});
