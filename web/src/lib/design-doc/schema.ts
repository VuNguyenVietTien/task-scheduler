/** GraphQL SDL for design-doc native server (camelCase to match frontend queries). */
export const designDocSchema = /* GraphQL */ `
  scalar UUID
  scalar JSON

  type System {
    id: UUID!
    projectId: String!
    name: String!
    description: String
    createdAt: String
    modules: [Module!]!
  }

  type Module {
    id: UUID!
    name: String!
    description: String
    sortOrder: Int
    documents: [DesignDocument!]
  }

  type DesignDocument {
    id: UUID!
    name: String!
    status: String!
    description: String
    createdAt: String
    screens: [Screen!]!
    flows: [Flow!]!
    tags: [Tag!]!
  }

  type Screen {
    id: UUID!
    name: String!
    svgContent: String
    svgLayers: JSON
    frameWidth: Int
    frameHeight: Int
    contentType: String
    breakpoint: String
    sortOrder: Int
    components: [Component!]!
  }

  type Component {
    id: UUID!
    customId: String!
    name: String!
    componentType: String
    dataType: String
    displayLogic: String
    position: JSON
    svgElementId: String
    descriptions: JSON
    fieldMappings: [FieldMapping!]!
    tags: [Tag!]!
  }

  type FieldMapping {
    id: UUID!
    dbTable: String!
    dbColumn: String!
    description: String
  }

  type Flow {
    id: UUID!
    name: String!
    flowType: String
    mermaidDefinition: String
    steps: [FlowStep!]!
  }

  type FlowStep {
    stepOrder: Int!
    label: String
    screenId: UUID
    componentId: UUID
  }

  type Tag {
    id: UUID!
    name: String!
    color: String
  }

  type EntityTag {
    id: UUID!
  }

  input CreateSystemInput {
    projectId: String!
    name: String!
    description: String
  }

  input CreateModuleInput {
    systemId: UUID!
    name: String!
    description: String
    sortOrder: Int
  }

  input CreateDocumentInput {
    moduleId: UUID!
    name: String!
    status: String
    description: String
  }

  input UpdateDocumentInput {
    id: UUID!
    name: String
    status: String
    description: String
  }

  input CreateScreenInput {
    documentId: UUID!
    name: String!
    breakpoint: String
    sortOrder: Int
  }

  input PasteDesignInput {
    screenId: UUID!
    svgContent: String!
    svgLayers: JSON!
    frameWidth: Int
    frameHeight: Int
    contentType: String
  }

  input CreateComponentInput {
    screenId: UUID!
    customId: String!
    name: String!
    componentType: String
    dataType: String
    position: JSON!
    svgElementId: String
    descriptions: JSON
  }

  input UpdateComponentInput {
    id: UUID!
    name: String
    componentType: String
    dataType: String
    displayLogic: String
    position: JSON
    svgElementId: String
    descriptions: JSON
  }

  input CreateFieldMappingInput {
    componentId: UUID!
    dbTable: String!
    dbColumn: String!
    description: String
  }

  type Query {
    systems(projectId: String!): [System!]!
    system(id: UUID!): System
    designDocument(id: UUID!): DesignDocument
    screen(id: UUID!): Screen
    tags: [Tag!]!
    exportDocumentForAi(documentId: UUID!): DesignDocument
  }

  type Mutation {
    createSystem(input: CreateSystemInput!): System!
    createModule(input: CreateModuleInput!): Module!
    createDocument(input: CreateDocumentInput!): DesignDocument!
    updateDocument(input: UpdateDocumentInput!): DesignDocument!
    deleteDocument(id: UUID!): Boolean!
    createScreen(input: CreateScreenInput!): Screen!
    pasteDesign(input: PasteDesignInput!): Screen!
    updateDesignFromPaste(screenId: UUID!, svgContent: String!, svgLayers: JSON!, contentType: String): Screen!
    clearScreenDesign(id: UUID!): Screen!
    createComponent(input: CreateComponentInput!): Component!
    updateComponent(input: UpdateComponentInput!): Component!
    deleteComponent(id: UUID!): Boolean!
    createFieldMapping(input: CreateFieldMappingInput!): FieldMapping!
    deleteFieldMapping(id: UUID!): Boolean!
    addEntityTag(tagId: UUID!, entityType: String!, entityId: UUID!): EntityTag!
    removeEntityTag(tagId: UUID!, entityType: String!, entityId: UUID!): Boolean!
  }
`;
