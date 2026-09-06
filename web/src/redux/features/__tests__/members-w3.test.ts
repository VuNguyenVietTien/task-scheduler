/**
 * W3 membersSlice tests — GraphQL bulk/roles/invite ops replace dead REST paths.
 */
import configureStore from '@reduxjs/toolkit';
import { client } from '@/lib/apollo-client';
import membersReducer, {
  fetchProjectMembers,
  addMemberByEmail,
  removeMultipleMembers,
  updateMultipleMemberRoles,
  updateProjectMemberRole,
  updateMultipleProjectMemberRoles,
  removeMultipleProjectMembers,
} from '../membersSlice';

jest.mock('@/lib/apollo-client', () => ({
  client: { query: jest.fn(), mutate: jest.fn() },
}));

const queryMock = client.query as jest.Mock;
const mutateMock = client.mutate as jest.Mock;

// Minimal RTK store
const makeStore = () => {
  const { configureStore: cs } = require('@reduxjs/toolkit');
  return cs({ reducer: { members: membersReducer } });
};

describe('W3: removeMultipleMembers uses GraphQL, not dead /members/bulk REST', () => {
  beforeEach(() => {
    mutateMock.mockReset();
    global.fetch = jest.fn(() => {
      throw new Error('REST /api/projects must not be called');
    });
  });

  it('calls remove_multiple_project_members via client.mutate', async () => {
    mutateMock.mockResolvedValue({
      data: { remove_multiple_project_members: { success_count: 2, failed_count: 0 } },
    });
    const store = makeStore();
    await store.dispatch(removeMultipleMembers({ projectId: 'p1', memberIds: ['u1', 'u2'] }));
    expect(mutateMock).toHaveBeenCalledTimes(1);
    const call = mutateMock.mock.calls[0][0];
    expect(call.mutation.loc.source.body).toContain('remove_multiple_project_members');
    expect(call.variables).toEqual({ projectId: 'p1', memberIds: ['u1', 'u2'] });
    expect(store.getState().members.members).toEqual([]);
  });
});

describe('W3: updateMultipleMemberRoles uses update_multiple_members with snake_case input', () => {
  beforeEach(() => mutateMock.mockReset());

  it('maps userId→user_id and lowercases roles; reads roles via ResolverProjectMember.user_id (BD-1)', async () => {
    mutateMock.mockResolvedValue({
      data: {
        update_multiple_members: {
          success_count: 1,
          members: [
            // ResolverProjectMember: top-level user_id; user: MemberUserResponse { id, ... }
            { user_id: 'u1', role: 'leader', joined_at: '2026-09-01', user: { id: 'u1', email: 'a@b.c', username: 'a', full_name: null, avatar_url: null } },
          ],
        },
      },
    });
    const store = makeStore();
    // fallback role differs from server role: buggy m.user.user_id matching
    // would return 'Member' instead of the server's 'Leader'
    const res = await store.dispatch(
      updateMultipleMemberRoles({ projectId: 'p1', updates: [{ userId: 'u1', role: 'Member' as any }] })
    );
    const call = mutateMock.mock.calls[0][0];
    expect(call.mutation.loc.source.body).toContain('update_multiple_members');
    expect(call.variables.updates).toEqual([{ user_id: 'u1', role: 'member' }]);
    // exact BulkUpdateResponse read mapping
    expect(res.payload).toMatchObject({
      members: [{ userId: 'u1', role: 'Leader' }],
      successCount: 1,
    });
  });
});

describe('W3: addMemberByEmail uses add_project_member_by_email', () => {
  beforeEach(() => mutateMock.mockReset());

  it('sends lowercase role and reads add_project_member_by_email payload', async () => {
    mutateMock.mockResolvedValue({
      data: {
        add_project_member_by_email: {
          role: 'member',
          joined_at: '2026-09-01T00:00:00Z',
          user: {
            user_id: 'u9',
            email: 'a@b.c',
            username: 'a',
            full_name: 'A B',
            avatar_url: null,
          },
        },
      },
    });
    const store = makeStore();
    const res: any = await store.dispatch(
      addMemberByEmail({ projectId: 'p1', email: 'a@b.c', role: 'Member' })
    );
    const call = mutateMock.mock.calls[0][0];
    expect(call.mutation.loc.source.body).toContain('add_project_member_by_email');
    expect(call.variables).toEqual({ project_id: 'p1', email: 'a@b.c', role: 'member' });
    expect(res.payload.userId).toBe('u9');
    expect(res.payload.role).toBe('Member');
    expect(store.getState().members.members).toHaveLength(1);
  });
});

describe('W3: single role update uses positional update_project_member args', () => {
  beforeEach(() => mutateMock.mockReset());

  it('sends project_id/user_id/role variables (no input wrapper)', async () => {
    mutateMock.mockResolvedValue({
      data: { update_project_member: { role: 'guest' } },
    });
    const store = makeStore();
    await store.dispatch(
      updateProjectMemberRole({ projectId: 'p1', userId: 'u1', role: 'Guest' })
    );
    const call = mutateMock.mock.calls[0][0];
    expect(call.variables).toEqual({ project_id: 'p1', user_id: 'u1', role: 'guest' });
    expect(call.mutation.loc.source.body).not.toContain('update_project_member(input:');
  });
});

describe('W3: updateMultipleProjectMemberRoles maps input for Rust op', () => {
  beforeEach(() => mutateMock.mockReset());

  it('maps updates to { user_id, lowercase role } and matches via m.user_id (BD-1)', async () => {
    mutateMock.mockResolvedValue({
      data: {
        update_multiple_members: {
          success_count: 1,
          members: [{ user_id: 'u2', role: 'manager', joined_at: '2026-09-01', user: { id: 'u2' } }],
        },
      },
    });
    const store = makeStore();
    const res: any = await store.dispatch(
      updateMultipleProjectMemberRoles({ projectId: 'p1', updates: [{ userId: 'u2', role: 'Guest' }] })
    );
    const call = mutateMock.mock.calls[0][0];
    expect(call.variables.updates).toEqual([{ user_id: 'u2', role: 'guest' }]);
    // server role wins over the stale fallback → proves m.user_id matching
    expect(res.payload.members[0]).toEqual({ userId: 'u2', role: 'Manager' });
  });

  it('selection uses ResolverProjectMember shape (user_id + user.id), not ProjectMember shape', () => {
    const body = require('@/graphql/mutations/projectMembers').UPDATE_MULTIPLE_MEMBER_ROLES.loc.source.body;
    expect(body).toMatch(/members\s*\{[\s\S]*?user_id[\s\S]*?user\s*\{[\s\S]*?\bid\b/);
    expect(body).not.toMatch(/user\s*\{[\s\S]*?user_id/);
  });
});

describe('W3: fetchProjectMembers tolerant of position-less ProjectMember', () => {
  beforeEach(() => mutateMock.mockReset());

  it('defaults position to null when backend omits it', async () => {
    queryMock.mockResolvedValue({
      data: {
        project_members: [
          {
            role: 'member',
            joined_at: '2026-09-01',
            user: { user_id: 'u1', email: 'a@b.c', username: 'a', full_name: null, avatar_url: null },
          },
        ],
        my_project_role: 'manager',
      },
    });
    const store = makeStore();
    const res: any = await store.dispatch(fetchProjectMembers('p1'));
    expect(res.payload.members[0].position).toBeNull();
    expect(res.payload.myRole).toBe('Manager');
  });
});

describe('W3: removeMultipleProjectMembers keeps GraphQL bulk remove', () => {
  beforeEach(() => mutateMock.mockReset());

  it('parses BulkRemoveResponse counts', async () => {
    mutateMock.mockResolvedValue({
      data: { remove_multiple_project_members: { success_count: 1, failed_count: 1 } },
    });
    const store = makeStore();
    const res: any = await store.dispatch(
      removeMultipleProjectMembers({ projectId: 'p1', memberIds: ['member-u1', 'member-u2'] })
    );
    expect(res.payload.userIds).toEqual(['u1', 'u2']);
    expect(res.payload.successCount).toBe(1);
  });
});
