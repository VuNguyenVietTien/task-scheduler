import { externalLinkService } from '@/services/external-link-service';
import { requireAuth } from '../utils/error-handler';
import type { GraphQLContext } from '../context';

export const externalLinkResolvers = {
  Query: {
    external_links: async (_: unknown, args: { document_id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return externalLinkService.getExternalLinks(ctx.supabaseAdmin, args.document_id);
    },
  },
  Mutation: {
    create_external_link: async (_: unknown, args: { input: Record<string, unknown> }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return externalLinkService.createExternalLink(ctx.supabaseAdmin, args.input);
    },
    delete_external_link: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      requireAuth(ctx.user);
      return externalLinkService.deleteExternalLink(ctx.supabaseAdmin, args.id);
    },
  },
};
