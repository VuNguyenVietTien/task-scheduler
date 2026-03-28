import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DesignDocContext,
  DbSystem,
  DbModule,
  DbDocument,
  DbScreen,
  DbComponent,
  DbFieldMapping,
  DbFlow,
  DbFlowStep,
  DbTag,
  CreateSystemInput,
  CreateModuleInput,
  CreateDocumentInput,
  UpdateDocumentInput,
  CreateScreenInput,
  PasteDesignInput,
  CreateComponentInput,
  UpdateComponentInput,
  CreateFieldMappingInput,
} from './types';

// --- Mappers: DB row → GraphQL object ---

function mapSystem(r: DbSystem) {
  return { id: r.id, projectId: r.project_id, name: r.name, description: r.description, createdAt: r.created_at };
}

function mapModule(r: DbModule) {
  return { id: r.id, name: r.name, description: r.description, sortOrder: r.sort_order };
}

function mapDocument(r: DbDocument) {
  return { id: r.id, name: r.name, status: r.status, description: r.description, createdAt: r.created_at };
}

function mapScreen(r: DbScreen) {
  return {
    id: r.id,
    name: r.name,
    svgContent: r.svg_content,
    svgLayers: r.svg_layers,
    frameWidth: r.frame_width,
    frameHeight: r.frame_height,
    contentType: r.content_type,
    breakpoint: r.breakpoint,
    sortOrder: r.sort_order,
  };
}

function mapComponent(r: DbComponent) {
  return {
    id: r.id,
    customId: r.custom_id,
    name: r.name,
    componentType: r.component_type,
    dataType: r.data_type,
    displayLogic: r.display_logic,
    position: r.position,
    svgElementId: r.svg_element_id,
    descriptions: r.descriptions,
  };
}

function mapFieldMapping(r: DbFieldMapping) {
  return { id: r.id, dbTable: r.db_table, dbColumn: r.db_column, description: r.description };
}

function mapFlow(r: DbFlow) {
  return { id: r.id, name: r.name, flowType: r.flow_type, mermaidDefinition: r.mermaid_definition };
}

function mapFlowStep(r: DbFlowStep) {
  return { stepOrder: r.step_order, label: r.label, screenId: r.screen_id, componentId: r.component_id };
}

function mapTag(r: DbTag) {
  return { id: r.id, name: r.name, color: r.color };
}

// --- Helpers ---

async function getTagsForEntity(sb: SupabaseClient, entityType: string, entityId: string) {
  const { data } = await sb
    .from('entity_tags')
    .select('tag_id, design_tags(id, name, color)')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);
  if (!data) return [];
  // Supabase returns design_tags as array from joined select
  type JoinRow = { tag_id: string; design_tags: { id: string; name: string; color: string | null }[] };
  return (data as JoinRow[])
    .map((row) => {
      const tag = row.design_tags?.[0];
      return tag ? { id: tag.id, name: tag.name, color: tag.color } : null;
    })
    .filter((t): t is { id: string; name: string; color: string | null } => t !== null);
}

// --- Root resolvers ---

export const designDocResolvers = {
  Query: {
    systems: async (_: unknown, args: { projectId: string }, ctx: DesignDocContext) => {
      const { data } = await ctx.supabase
        .from('systems')
        .select('*')
        .eq('project_id', args.projectId)
        .order('created_at', { ascending: true });
      return (data ?? []).map(mapSystem);
    },

    system: async (_: unknown, args: { id: string }, ctx: DesignDocContext) => {
      const { data } = await ctx.supabase.from('systems').select('*').eq('id', args.id).single();
      return data ? mapSystem(data) : null;
    },

    designDocument: async (_: unknown, args: { id: string }, ctx: DesignDocContext) => {
      const { data } = await ctx.supabase.from('design_documents').select('*').eq('id', args.id).single();
      return data ? mapDocument(data) : null;
    },

    screen: async (_: unknown, args: { id: string }, ctx: DesignDocContext) => {
      const { data } = await ctx.supabase.from('screens').select('*').eq('id', args.id).single();
      return data ? mapScreen(data) : null;
    },

    tags: async (_: unknown, __: unknown, ctx: DesignDocContext) => {
      const { data } = await ctx.supabase.from('design_tags').select('*').order('name', { ascending: true });
      return (data ?? []).map(mapTag);
    },

    exportDocumentForAi: async (_: unknown, args: { documentId: string }, ctx: DesignDocContext) => {
      const { data } = await ctx.supabase.from('design_documents').select('*').eq('id', args.documentId).single();
      return data ? mapDocument(data) : null;
    },
  },

  Mutation: {
    createSystem: async (_: unknown, args: { input: CreateSystemInput }, ctx: DesignDocContext) => {
      const { data, error } = await ctx.supabase
        .from('systems')
        .insert({ project_id: args.input.projectId, name: args.input.name, description: args.input.description ?? null, created_by: 'system' })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return mapSystem(data);
    },

    createModule: async (_: unknown, args: { input: CreateModuleInput }, ctx: DesignDocContext) => {
      const { data, error } = await ctx.supabase
        .from('modules')
        .insert({ system_id: args.input.systemId, name: args.input.name, description: args.input.description ?? null, sort_order: args.input.sortOrder ?? null })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return mapModule(data);
    },

    createDocument: async (_: unknown, args: { input: CreateDocumentInput }, ctx: DesignDocContext) => {
      const { data, error } = await ctx.supabase
        .from('design_documents')
        .insert({ module_id: args.input.moduleId, name: args.input.name, status: args.input.status ?? 'draft', description: args.input.description ?? null, created_by: 'system' })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return mapDocument(data);
    },

    updateDocument: async (_: unknown, args: { input: UpdateDocumentInput }, ctx: DesignDocContext) => {
      const { id, name, status, description } = args.input;
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (name !== undefined && name !== null) updates.name = name;
      if (status !== undefined && status !== null) updates.status = status;
      if (description !== undefined) updates.description = description;
      const { data, error } = await ctx.supabase.from('design_documents').update(updates).eq('id', id).select('*').single();
      if (error) throw new Error(error.message);
      return mapDocument(data);
    },

    deleteDocument: async (_: unknown, args: { id: string }, ctx: DesignDocContext) => {
      const { error } = await ctx.supabase.from('design_documents').delete().eq('id', args.id);
      if (error) throw new Error(error.message);
      return true;
    },

    createScreen: async (_: unknown, args: { input: CreateScreenInput }, ctx: DesignDocContext) => {
      const { data, error } = await ctx.supabase
        .from('screens')
        .insert({ document_id: args.input.documentId, name: args.input.name, breakpoint: args.input.breakpoint ?? null, sort_order: args.input.sortOrder ?? null })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return mapScreen(data);
    },

    pasteDesign: async (_: unknown, args: { input: PasteDesignInput }, ctx: DesignDocContext) => {
      const { screenId, svgContent, svgLayers, frameWidth, frameHeight, contentType } = args.input;
      const { data, error } = await ctx.supabase
        .from('screens')
        .update({ svg_content: svgContent, svg_layers: svgLayers, frame_width: frameWidth ?? null, frame_height: frameHeight ?? null, content_type: contentType ?? null, updated_at: new Date().toISOString() })
        .eq('id', screenId)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return mapScreen(data);
    },

    updateDesignFromPaste: async (
      _: unknown,
      args: { screenId: string; svgContent: string; svgLayers: unknown; contentType?: string | null },
      ctx: DesignDocContext
    ) => {
      const { data, error } = await ctx.supabase
        .from('screens')
        .update({ svg_content: args.svgContent, svg_layers: args.svgLayers, content_type: args.contentType ?? null, updated_at: new Date().toISOString() })
        .eq('id', args.screenId)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return mapScreen(data);
    },

    clearScreenDesign: async (_: unknown, args: { id: string }, ctx: DesignDocContext) => {
      const { data, error } = await ctx.supabase
        .from('screens')
        .update({ svg_content: null, svg_layers: null, frame_width: null, frame_height: null, content_type: null, updated_at: new Date().toISOString() })
        .eq('id', args.id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return mapScreen(data);
    },

    createComponent: async (_: unknown, args: { input: CreateComponentInput }, ctx: DesignDocContext) => {
      const i = args.input;
      const { data, error } = await ctx.supabase
        .from('components')
        .insert({ screen_id: i.screenId, custom_id: i.customId, name: i.name, component_type: i.componentType ?? null, data_type: i.dataType ?? null, position: i.position, svg_element_id: i.svgElementId ?? null, descriptions: i.descriptions ?? null })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return mapComponent(data);
    },

    updateComponent: async (_: unknown, args: { input: UpdateComponentInput }, ctx: DesignDocContext) => {
      const { id, ...rest } = args.input;
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (rest.name !== undefined && rest.name !== null) updates.name = rest.name;
      if (rest.componentType !== undefined) updates.component_type = rest.componentType;
      if (rest.dataType !== undefined) updates.data_type = rest.dataType;
      if (rest.displayLogic !== undefined) updates.display_logic = rest.displayLogic;
      if (rest.position !== undefined) updates.position = rest.position;
      if (rest.svgElementId !== undefined) updates.svg_element_id = rest.svgElementId;
      if (rest.descriptions !== undefined) updates.descriptions = rest.descriptions;
      const { data, error } = await ctx.supabase.from('components').update(updates).eq('id', id).select('*').single();
      if (error) throw new Error(error.message);
      return mapComponent(data);
    },

    deleteComponent: async (_: unknown, args: { id: string }, ctx: DesignDocContext) => {
      const { error } = await ctx.supabase.from('components').delete().eq('id', args.id);
      if (error) throw new Error(error.message);
      return true;
    },

    createFieldMapping: async (_: unknown, args: { input: CreateFieldMappingInput }, ctx: DesignDocContext) => {
      const i = args.input;
      const { data, error } = await ctx.supabase
        .from('field_mappings')
        .insert({ component_id: i.componentId, db_table: i.dbTable, db_column: i.dbColumn, description: i.description ?? null })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return mapFieldMapping(data);
    },

    deleteFieldMapping: async (_: unknown, args: { id: string }, ctx: DesignDocContext) => {
      const { error } = await ctx.supabase.from('field_mappings').delete().eq('id', args.id);
      if (error) throw new Error(error.message);
      return true;
    },

    addEntityTag: async (_: unknown, args: { tagId: string; entityType: string; entityId: string }, ctx: DesignDocContext) => {
      const { data, error } = await ctx.supabase
        .from('entity_tags')
        .insert({ tag_id: args.tagId, entity_type: args.entityType, entity_id: args.entityId })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      return { id: data.id };
    },

    removeEntityTag: async (_: unknown, args: { tagId: string; entityType: string; entityId: string }, ctx: DesignDocContext) => {
      const { error } = await ctx.supabase
        .from('entity_tags')
        .delete()
        .eq('tag_id', args.tagId)
        .eq('entity_type', args.entityType)
        .eq('entity_id', args.entityId);
      if (error) throw new Error(error.message);
      return true;
    },
  },

  // --- Nested resolvers ---

  System: {
    modules: async (parent: { id: string }, _: unknown, ctx: DesignDocContext) => {
      const { data } = await ctx.supabase
        .from('modules')
        .select('*')
        .eq('system_id', parent.id)
        .order('sort_order', { ascending: true });
      return (data ?? []).map(mapModule);
    },
  },

  Module: {
    documents: async (parent: { id: string }, _: unknown, ctx: DesignDocContext) => {
      const { data } = await ctx.supabase
        .from('design_documents')
        .select('*')
        .eq('module_id', parent.id)
        .order('created_at', { ascending: true });
      return (data ?? []).map(mapDocument);
    },
  },

  DesignDocument: {
    screens: async (parent: { id: string }, _: unknown, ctx: DesignDocContext) => {
      const { data } = await ctx.supabase
        .from('screens')
        .select('*')
        .eq('document_id', parent.id)
        .order('sort_order', { ascending: true });
      return (data ?? []).map(mapScreen);
    },
    flows: async (parent: { id: string }, _: unknown, ctx: DesignDocContext) => {
      const { data } = await ctx.supabase
        .from('flows')
        .select('*')
        .eq('document_id', parent.id)
        .order('created_at', { ascending: true });
      return (data ?? []).map(mapFlow);
    },
    tags: async (parent: { id: string }, _: unknown, ctx: DesignDocContext) => {
      return getTagsForEntity(ctx.supabase, 'document', parent.id);
    },
  },

  Screen: {
    components: async (parent: { id: string }, _: unknown, ctx: DesignDocContext) => {
      const { data } = await ctx.supabase
        .from('components')
        .select('*')
        .eq('screen_id', parent.id)
        .order('sort_order', { ascending: true });
      return (data ?? []).map(mapComponent);
    },
  },

  Component: {
    fieldMappings: async (parent: { id: string }, _: unknown, ctx: DesignDocContext) => {
      const { data } = await ctx.supabase
        .from('field_mappings')
        .select('*')
        .eq('component_id', parent.id)
        .order('created_at', { ascending: true });
      return (data ?? []).map(mapFieldMapping);
    },
    tags: async (parent: { id: string }, _: unknown, ctx: DesignDocContext) => {
      return getTagsForEntity(ctx.supabase, 'component', parent.id);
    },
  },

  Flow: {
    steps: async (parent: { id: string }, _: unknown, ctx: DesignDocContext) => {
      const { data } = await ctx.supabase
        .from('flow_steps')
        .select('*')
        .eq('flow_id', parent.id)
        .order('step_order', { ascending: true });
      return (data ?? []).map(mapFlowStep);
    },
  },
};
