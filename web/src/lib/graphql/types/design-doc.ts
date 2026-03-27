export const designDocTypeDefs = `
  type Tag {
    id: ID!
    name: String!
    entity_type: String!
    entity_id: ID!
    created_at: String
  }

  type DocumentVersion {
    id: ID!
    entity_type: String!
    entity_id: ID!
    action: String
    old_data: String
    new_data: String
    changed_by: ID
    changed_at: String
  }

  type ExternalLink {
    id: ID!
    document_id: ID!
    url: String!
    title: String
    link_type: String
    created_at: String
  }

  type FieldMapping {
    id: ID!
    component_id: ID!
    field_name: String!
    field_type: String
    source: String
    created_at: String
  }

  type Component {
    id: ID!
    screen_id: ID!
    name: String!
    component_type: String
    description: String
    metadata: String
    created_at: String
    updated_at: String
    field_mappings: [FieldMapping]
  }

  type Screen {
    id: ID!
    document_id: ID!
    name: String!
    svg_content: String
    svg_layers: String
    frame_width: Float
    frame_height: Float
    content_type: String
    breakpoint: String
    sort_order: Int
    metadata: String
    created_at: String
    updated_at: String
    components: [Component]
    tags: [Tag]
  }

  type Flow {
    id: ID!
    document_id: ID!
    name: String!
    description: String
    steps: String
    position: String
    created_at: String
    updated_at: String
  }

  type Document {
    id: ID!
    module_id: ID!
    name: String!
    status: String
    description: String
    source_tool: String
    last_imported_at: String
    metadata: String
    created_by: ID
    created_at: String
    updated_at: String
    screens: [Screen]
    tags: [Tag]
    flows: [Flow]
    document_versions: [DocumentVersion]
    external_links: [ExternalLink]
  }

  type DesignModule {
    id: ID!
    system_id: ID!
    name: String!
    description: String
    metadata: String
    created_by: ID
    created_at: String
    updated_at: String
    documents: [Document]
    tags: [Tag]
  }

  type DesignSystem {
    id: ID!
    project_id: ID!
    name: String!
    description: String
    metadata: String
    created_by: ID
    created_at: String
    updated_at: String
    modules: [DesignModule]
    tags: [Tag]
  }

  input CreateSystemInput {
    project_id: ID!
    name: String!
    description: String
  }

  input UpdateSystemInput {
    id: ID!
    name: String
    description: String
  }

  input CreateModuleInput {
    system_id: ID!
    name: String!
    description: String
  }

  input UpdateModuleInput {
    id: ID!
    name: String
    description: String
  }

  input CreateDocumentInput {
    module_id: ID!
    name: String!
    description: String
  }

  input UpdateDocumentInput {
    id: ID!
    name: String
    description: String
    status: String
  }

  input CreateScreenInput {
    document_id: ID!
    name: String!
    breakpoint: String
    sort_order: Int
  }

  input UpdateScreenInput {
    id: ID!
    name: String
    svg_content: String
    svg_layers: String
    frame_width: Float
    frame_height: Float
    content_type: String
  }

  input PasteDesignInput {
    document_id: ID!
    screen_name: String!
    svg_content: String!
    svg_layers: String
    breakpoint: String
    frame_width: Float
    frame_height: Float
    content_type: String
  }

  input CreateComponentInput {
    screen_id: ID!
    name: String!
    component_type: String
    description: String
    metadata: String
  }

  input UpdateComponentInput {
    id: ID!
    name: String
    component_type: String
    description: String
    metadata: String
  }

  input CreateFlowInput {
    document_id: ID!
    name: String!
    description: String
    steps: String
    position: String
  }

  input UpdateFlowInput {
    id: ID!
    name: String
    description: String
    steps: String
    position: String
  }

  input CreateTagInput {
    entity_type: String!
    entity_id: ID!
    name: String!
  }

  input CreateExternalLinkInput {
    document_id: ID!
    url: String!
    title: String
    link_type: String
  }

  extend type Query {
    systems(project_id: String!): [DesignSystem!]!
    system(id: ID!): DesignSystem
    module(id: ID!): DesignModule
    documents(module_id: ID!): [Document!]!
    document(id: ID!): Document
    screens(document_id: ID!): [Screen!]!
    screen(id: ID!): Screen
    components(screen_id: ID!): [Component!]!
    tags(entity_type: String!, entity_id: ID!): [Tag!]!
    flows(document_id: ID!): [Flow!]!
    external_links(document_id: ID!): [ExternalLink!]!
  }

  extend type Mutation {
    create_system(input: CreateSystemInput!): DesignSystem!
    update_system(input: UpdateSystemInput!): DesignSystem!
    delete_system(id: ID!): Boolean!
    create_module(input: CreateModuleInput!): DesignModule!
    update_module(input: UpdateModuleInput!): DesignModule!
    delete_module(id: ID!): Boolean!
    create_document(input: CreateDocumentInput!): Document!
    update_document(input: UpdateDocumentInput!): Document!
    delete_document(id: ID!): Boolean!
    create_screen(input: CreateScreenInput!): Screen!
    update_screen(input: UpdateScreenInput!): Screen!
    delete_screen(id: ID!): Boolean!
    paste_design(input: PasteDesignInput!): Screen!
    create_component(input: CreateComponentInput!): Component!
    update_component(input: UpdateComponentInput!): Component!
    delete_component(id: ID!): Boolean!
    create_flow(input: CreateFlowInput!): Flow!
    update_flow(input: UpdateFlowInput!): Flow!
    delete_flow(id: ID!): Boolean!
    create_tag(input: CreateTagInput!): Tag!
    delete_tag(id: ID!): Boolean!
    create_external_link(input: CreateExternalLinkInput!): ExternalLink!
    delete_external_link(id: ID!): Boolean!
  }
`;
