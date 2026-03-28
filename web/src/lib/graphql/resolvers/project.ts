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
      return memberService.updateMember(ctx.supabaseAdmin, project_id as string, user_id as string, (role as string).toLowerCase());
    },
    remove_project_member: async (_: unknown, args: { project_id: string; user_id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return memberService.removeMember(ctx.supabaseAdmin, args.project_id, args.user_id);
    },
  },
  Project: {
    owner: async (parent: { owner_id: string }, _: unknown, ctx: GraphQLContext) => {
      return userService.getUser(ctx.supabaseAdmin, parent.owner_id);
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
    user: (parent: { user: unknown }) => parent.user,
  },
};
