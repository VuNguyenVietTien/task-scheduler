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
  },
  Mutation: {
    create_project: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return projectService.createProject(ctx.supabaseAdmin, { ...args.input, owner_id: ctx.user.id });
    },
    update_project: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      const { project_id, ...rest } = args.input;
      return projectService.updateProject(ctx.supabaseAdmin, project_id as string, rest);
    },
    add_project_member: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return memberService.addMember(ctx.supabaseAdmin, args.input);
    },
    update_project_member: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      const { project_id, user_id, role } = args.input;
      return memberService.updateMember(ctx.supabaseAdmin, project_id as string, user_id as string, role as string);
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
    members: async (parent: { id: string }, _: unknown, ctx: GraphQLContext) => {
      return memberService.getMembers(ctx.supabaseAdmin, parent.id);
    },
  },
};
