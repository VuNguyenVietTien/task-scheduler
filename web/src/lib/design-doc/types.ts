import type { SupabaseClient } from '@supabase/supabase-js';

// Context passed to all resolvers
export interface DesignDocContext {
  supabase: SupabaseClient;
}

// DB row shapes (snake_case from Supabase)
export interface DbSystem {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbModule {
  id: string;
  system_id: string;
  name: string;
  description: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface DbDocument {
  id: string;
  module_id: string;
  name: string;
  status: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbScreen {
  id: string;
  document_id: string;
  name: string;
  svg_content: string | null;
  svg_layers: unknown | null;
  frame_width: number | null;
  frame_height: number | null;
  breakpoint: string | null;
  sort_order: number | null;
  content_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbComponent {
  id: string;
  screen_id: string;
  custom_id: string;
  name: string;
  component_type: string | null;
  data_type: string | null;
  display_logic: string | null;
  position: unknown | null;
  svg_element_id: string | null;
  descriptions: unknown | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface DbFieldMapping {
  id: string;
  component_id: string;
  db_table: string;
  db_column: string;
  description: string | null;
  created_at: string;
}

export interface DbFlow {
  id: string;
  document_id: string;
  name: string;
  description: string | null;
  mermaid_definition: string | null;
  flow_type: string | null;
  created_at: string;
}

export interface DbFlowStep {
  id: string;
  flow_id: string;
  screen_id: string | null;
  component_id: string | null;
  step_order: number;
  label: string | null;
  description: string | null;
  created_at: string;
}

export interface DbTag {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface DbEntityTag {
  id: string;
  tag_id: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
}

// Mutation input types
export interface CreateSystemInput {
  projectId: string;
  name: string;
  description?: string | null;
}

export interface CreateModuleInput {
  systemId: string;
  name: string;
  description?: string | null;
  sortOrder?: number | null;
}

export interface CreateDocumentInput {
  moduleId: string;
  name: string;
  status?: string | null;
  description?: string | null;
}

export interface UpdateDocumentInput {
  id: string;
  name?: string | null;
  status?: string | null;
  description?: string | null;
}

export interface CreateScreenInput {
  documentId: string;
  name: string;
  breakpoint?: string | null;
  sortOrder?: number | null;
}

export interface PasteDesignInput {
  screenId: string;
  svgContent: string;
  svgLayers: unknown;
  frameWidth?: number | null;
  frameHeight?: number | null;
  contentType?: string | null;
}

export interface CreateComponentInput {
  screenId: string;
  customId: string;
  name: string;
  componentType?: string | null;
  dataType?: string | null;
  position: unknown;
  svgElementId?: string | null;
  descriptions?: unknown | null;
}

export interface UpdateComponentInput {
  id: string;
  name?: string | null;
  componentType?: string | null;
  dataType?: string | null;
  displayLogic?: string | null;
  position?: unknown | null;
  svgElementId?: string | null;
  descriptions?: unknown | null;
}

export interface CreateFieldMappingInput {
  componentId: string;
  dbTable: string;
  dbColumn: string;
  description?: string | null;
}
