import { projectService } from '@/lib/services/project-service';
import { memberService } from '@/lib/services/member-service';
import { userService } from '@/lib/services/user-service';
import { requireAuth } from '../utils/error-handler';
import type { GraphQLContext } from '../context';

export const projectResolvers = {
  Query: {
    project: async (_: unknown, args: { project_id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return projectService.getProject(ctx.supabaseAdmin, args.project_id);
    },
    projects: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return projectService.getProjectsForUser(ctx.supabaseAdmin, ctx.user.id);
    },
    project_members: async (_: unknown, args: { project_id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return memberService.getMembers(ctx.supabaseAdmin, args.project_id);
    },
    my_project_role: async (_: unknown, args: { project_id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return memberService.getMemberRole(ctx.supabaseAdmin, args.project_id, ctx.user.id);
    },
  },
  Mutation: {
    create_project: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      const input = {
        ...args.input,
        owner_id: ctx.user.id,
        // DB enums are lowercase
        priority: typeof args.input.priority === 'string' ? args.input.priority.toLowerCase() : args.input.priority,
        status: typeof args.input.status === 'string' ? args.input.status.toLowerCase() : args.input.status,
        visibility: typeof args.input.visibility === 'string' ? args.input.visibility.toLowerCase() : args.input.visibility,
      };
      try {
        const result = await projectService.createProject(ctx.supabaseAdmin, input);
        return result;
      } catch (e: any) {
        console.error('[create_project] error:', e?.message || e);
        // Re-throw with descriptive message so modal shows it
        throw new Error(e?.message || String(e));
      }
    },
    update_project: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      const { project_id, ...rest } = args.input;
      const input = {
        ...rest,
        ...(rest.priority && { priority: (rest.priority as string).toLowerCase() }),
        ...(rest.status && { status: (rest.status as string).toLowerCase() }),
        ...(rest.visibility && { visibility: (rest.visibility as string).toLowerCase() }),
      };
      return projectService.updateProject(ctx.supabaseAdmin, project_id as string, input);
    },
    invite_project_member: async (_: unknown, args: { project_id: string; email: string; role: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      const callerRole = (await memberService.getMemberRole(ctx.supabaseAdmin, args.project_id, ctx.user.id) ?? '').toLowerCase();
      // Accept 'manager' and legacy 'admin' role as equivalent
      if (!['manager', 'admin'].includes(callerRole)) throw new Error('Only managers can invite members');
      const user = await memberService.getUserByEmail(ctx.supabaseAdmin, args.email);
      if (!user) throw new Error('No account found with this email');
      const alreadyMember = await memberService.isMember(ctx.supabaseAdmin, args.project_id, user.user_id);
      if (alreadyMember) throw new Error('User is already a member of this project');
      await memberService.addMember(ctx.supabaseAdmin, {
        project_id: args.project_id,
        user_id: user.user_id,
        role: args.role.toLowerCase(),
      });
      // Fetch full member data with user join for proper GraphQL response
      return memberService.getMember(ctx.supabaseAdmin, args.project_id, user.user_id);
    },
    add_project_member: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      const input = {
        ...args.input,
        ...(args.input.role && { role: (args.input.role as string).toLowerCase() }),
      };
      return memberService.addMember(ctx.supabaseAdmin, input);
    },
    update_project_member: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      const { project_id, user_id, role } = args.input;
      const callerRole = (await memberService.getMemberRole(ctx.supabaseAdmin, project_id as string, ctx.user.id) ?? '').toLowerCase();
      if (!['manager', 'admin'].includes(callerRole)) throw new Error('Only managers can edit member roles');
      return memberService.updateMember(ctx.supabaseAdmin, project_id as string, user_id as string, (role as string).toLowerCase());
    },
    update_multiple_members: async (_: unknown, args: { project_id: string; updates: { userId: string; role: string }[] }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      const callerRole = (await memberService.getMemberRole(ctx.supabaseAdmin, args.project_id, ctx.user.id) ?? '').toLowerCase();
      if (!['manager', 'admin'].includes(callerRole)) throw new Error('Only managers can edit member roles');
      const results = await Promise.all(
        args.updates.map(({ userId, role }) =>
          memberService.updateMember(ctx.supabaseAdmin, args.project_id, userId, role.toLowerCase())
            .then(() => memberService.getMember(ctx.supabaseAdmin, args.project_id, userId))
        )
      );
      return { success_count: results.length, members: results };
    },
    remove_project_member: async (_: unknown, args: { project_id: string; user_id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return memberService.removeMember(ctx.supabaseAdmin, args.project_id, args.user_id);
    },
    update_member_position: async (_: unknown, args: { project_id: string; user_id: string; position?: string | null }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      const callerRole = (await memberService.getMemberRole(ctx.supabaseAdmin, args.project_id, ctx.user.id) ?? '').toLowerCase();
      if (!['manager', 'admin'].includes(callerRole)) throw new Error('Only managers can update member position');
      await memberService.updateMemberPosition(ctx.supabaseAdmin, args.project_id, args.user_id, args.position ?? null);
      return memberService.getMember(ctx.supabaseAdmin, args.project_id, args.user_id);
    },
  },
  Project: {
    owner: async (parent: { owner_id: string }, _: unknown, ctx: GraphQLContext) => {
      return userService.getUser(ctx.supabaseAdmin, parent.owner_id);
    },
    user_role: async (parent: { project_id: string }, _: unknown, ctx: GraphQLContext) => {
      if (!ctx.user) return null;
      return memberService.getMemberRole(ctx.supabaseAdmin, parent.project_id, ctx.user.id);
    },
    members: async (parent: { project_id: string }, _: unknown, ctx: GraphQLContext) => {
      return memberService.getMembers(ctx.supabaseAdmin, parent.project_id);
    },
    // Convert lowercase DB enum values to uppercase for GraphQL schema
    status: (parent: { status: string }) => parent.status?.toUpperCase() ?? null,
    priority: (parent: { priority: string }) => parent.priority?.toUpperCase() ?? null,
    visibility: (parent: { visibility: string }) => parent.visibility?.toUpperCase() ?? null,
  },
  ProjectMember: {
    role: (parent: { role: string }) => parent.role?.toUpperCase() ?? null,
    position: (parent: { position?: string | null }) => parent.position ?? null,
    user: (parent: { user: unknown }) => parent.user,
  },
};
