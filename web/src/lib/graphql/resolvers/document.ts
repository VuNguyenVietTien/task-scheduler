import { documentService } from '@/services/document-service';
import { requireAuth } from '../utils/error-handler';
import type { GraphQLContext } from '../context';

export const documentResolvers = {
  Query: {
    documents: async (_: unknown, args: { module_id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return documentService.getDocuments(ctx.supabaseAdmin, args.module_id);
    },
    document: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return documentService.getDocument(ctx.supabaseAdmin, args.id);
    },
  },
  Mutation: {
    create_document: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return documentService.createDocument(ctx.supabaseAdmin, args.input, ctx.user.id);
    },
    update_document: async (_: unknown, args: { input: { id: string } & Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      const { id, ...rest } = args.input;
      return documentService.updateDocument(ctx.supabaseAdmin, id, rest, ctx.user.id);
    },
    delete_document: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return documentService.deleteDocument(ctx.supabaseAdmin, args.id);
    },
  },
  Document: {
    screens: async (parent: { id: string }, _: unknown, ctx: GraphQLContext) => {
      const { screenService } = await import('@/services/screen-service');
      return screenService.getScreens(ctx.supabaseAdmin, parent.id);
    },
    tags: async (parent: { id: string }, _: unknown, ctx: GraphQLContext) => {
      const { tagService } = await import('@/services/tag-service');
      return tagService.getTags(ctx.supabaseAdmin, 'document', parent.id);
    },
    flows: async (parent: { id: string }, _: unknown, ctx: GraphQLContext) => {
      const { flowService } = await import('@/services/flow-service');
      return flowService.getFlows(ctx.supabaseAdmin, parent.id);
    },
    document_versions: async (parent: { id: string }, _: unknown, ctx: GraphQLContext) => {
      const { data } = await ctx.supabaseAdmin
        .from('document_audit')
        .select('*')
        .eq('entity_id', parent.id)
        .order('changed_at', { ascending: false });
      return data || [];
    },
    external_links: async (parent: { id: string }, _: unknown, ctx: GraphQLContext) => {
      const { externalLinkService } = await import('@/services/external-link-service');
      return externalLinkService.getExternalLinks(ctx.supabaseAdmin, parent.id);
    },
  },
};
