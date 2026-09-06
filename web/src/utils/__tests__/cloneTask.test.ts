/**
 * cloneTaskSubtree tests (requirement 7, manager review #4):
 * recursive grandchildren, parent remap (incl. cloning a child preserves its
 * parent), cycle guard no-hang, missing-newId validation (no child writes
 * against invalid id), partial-failure reporting with no false success.
 */
import { cloneTaskSubtree, type CloneApi, type CloneSourceTask } from '@/utils/cloneTask';

function makeApi(behavior: (input: { title: string; parent_task_id?: string | null }) => string | Error) {
  const calls: { title: string; parent_task_id?: string | null }[] = [];
  const api: CloneApi = {
    createTask: async (input) => {
      calls.push({ title: input.title, parent_task_id: input.parent_task_id });
      const r = behavior(input);
      if (r instanceof Error) throw r;
      return r;
    },
  };
  return { api, calls };
}

const T = (task_id: string, parent_task_id: string | null, title: string): CloneSourceTask =>
  ({ task_id, parent_task_id, title, project_id: 'p1' }) as CloneSourceTask;

describe('cloneTaskSubtree', () => {
  it('clones the full subtree incl. grandchildren with parent remap', async () => {
    // root → child → grandchild
    const tasks = [T('root', null, 'Root'), T('child', 'root', 'Child'), T('gc', 'child', 'Grandchild')];
    const { api, calls } = makeApi((i) => `new-${i.title}`);
    const r = await cloneTaskSubtree(api, tasks, 'root');
    expect(r.ok).toBe(true);
    expect(r.created).toHaveLength(3);
    expect(calls.map((c) => c.title)).toEqual(['Root (copy)', 'Child (copy)', 'Grandchild (copy)']);
    // root keeps null parent; child maps to ROOT CLONE; grandchild maps to CHILD CLONE
    expect(calls[0].parent_task_id).toBeNull();
    expect(calls[1].parent_task_id).toBe('new-Root (copy)');
    expect(calls[2].parent_task_id).toBe('new-Child (copy)');
  });

  it('cloning a CHILD preserves its parent placement (root clone keeps source parent)', async () => {
    const tasks = [T('root', null, 'Root'), T('child', 'root', 'Child')];
    const { api, calls } = makeApi((i) => `new-${i.title}`);
    const r = await cloneTaskSubtree(api, tasks, 'child');
    expect(r.ok).toBe(true);
    expect(calls[0]).toMatchObject({ title: 'Child (copy)', parent_task_id: 'root' });
  });

  it('cycle in parent_task_id does not hang and clones each node once', async () => {
    // a → b → a plus normal child c
    const tasks = [T('a', 'b', 'A'), T('b', 'a', 'B'), T('c', 'a', 'C')];
    const { api, calls } = makeApi((i) => `new-${i.title}`);
    const r = await cloneTaskSubtree(api, tasks, 'a');
    expect(r.ok).toBe(true);
    // a, b, c each exactly once (visited set breaks the a↔b cycle)
    const titles = calls.map((c) => c.title).sort();
    expect(titles).toEqual(['A (copy)', 'B (copy)', 'C (copy)']);
  });

  it('missing newId on the root: NO child writes, failure reported, no false success', async () => {
    const tasks = [T('root', null, 'Root'), T('child', 'root', 'Child')];
    const { api, calls } = makeApi(() => '');
    const r = await cloneTaskSubtree(api, tasks, 'root');
    expect(r.ok).toBe(false);
    expect(r.created).toHaveLength(0);
    expect(calls).toHaveLength(1); // only the root attempt — children never written
    expect(r.failures[0]).toMatchObject({ sourceId: 'root', error: expect.stringContaining('no id') });
  });

  it('partial failure: failed child records error, sibling still cloned, honest ok=false', async () => {
    const tasks = [T('root', null, 'Root'), T('k1', 'root', 'Kid1'), T('k2', 'root', 'Kid2')];
    const { api } = makeApi((i) => (i.title === 'Kid1 (copy)' ? new Error('server exploded') : `new-${i.title}`));
    const r = await cloneTaskSubtree(api, tasks, 'root');
    expect(r.ok).toBe(false);
    expect(r.created).toHaveLength(2); // root + Kid2
    expect(r.failures).toEqual([
      expect.objectContaining({ sourceId: 'k1', title: 'Kid1', error: 'server exploded' }),
    ]);
  });

  it('child under a FAILED parent is skipped with explicit orphan error (no misplacement)', async () => {
    const tasks = [T('root', null, 'Root'), T('bad', 'root', 'Bad'), T('under-bad', 'bad', 'UnderBad')];
    const { api, calls } = makeApi((i) =>
      i.title === 'Bad (copy)' ? new Error('nope') : `new-${i.title}`
    );
    const r = await cloneTaskSubtree(api, tasks, 'root');
    expect(r.ok).toBe(false);
    const titles = calls.map((c) => c.title);
    expect(titles).not.toContain('UnderBad (copy)'); // not silently misplaced
    expect(r.failures.map((f) => f.sourceId).sort()).toEqual(['bad', 'under-bad']);
  });
});
