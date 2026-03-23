import { gql } from '@apollo/client';

export const CREATE_SYSTEM = gql`
  mutation CreateSystem($input: CreateSystemInput!) {
    createSystem(input: $input) {
      id
      name
    }
  }
`;

export const CREATE_MODULE = gql`
  mutation CreateModule($input: CreateModuleInput!) {
    createModule(input: $input) {
      id
      name
    }
  }
`;

export const CREATE_DOCUMENT = gql`
  mutation CreateDocument($input: CreateDocumentInput!) {
    createDocument(input: $input) {
      id
      name
      status
    }
  }
`;

export const UPDATE_DOCUMENT = gql`
  mutation UpdateDocument($input: UpdateDocumentInput!) {
    updateDocument(input: $input) {
      id
      name
      status
    }
  }
`;

export const DELETE_DOCUMENT = gql`
  mutation DeleteDocument($id: UUID!) {
    deleteDocument(id: $id)
  }
`;

export const CREATE_SCREEN = gql`
  mutation CreateScreen($input: CreateScreenInput!) {
    createScreen(input: $input) {
      id
      name
      breakpoint
    }
  }
`;

/** Paste a new SVG design into a screen (creates or replaces svg_content + svg_layers). */
export const PASTE_DESIGN = gql`
  mutation PasteDesign($input: PasteDesignInput!) {
    pasteDesign(input: $input) {
      id
      name
      svgContent
      svgLayers
      frameWidth
      frameHeight
    }
  }
`;

/** Update an existing screen's SVG content and layer tree in-place. */
export const UPDATE_DESIGN_FROM_PASTE = gql`
  mutation UpdateDesignFromPaste(
    $screenId: UUID!
    $svgContent: String!
    $svgLayers: JSON!
  ) {
    updateDesignFromPaste(
      screenId: $screenId
      svgContent: $svgContent
      svgLayers: $svgLayers
    ) {
      id
      svgContent
      svgLayers
    }
  }
`;

export const CREATE_COMPONENT = gql`
  mutation CreateComponent($input: CreateComponentInput!) {
    createComponent(input: $input) {
      id
      customId
      name
    }
  }
`;

export const UPDATE_COMPONENT = gql`
  mutation UpdateComponent($input: UpdateComponentInput!) {
    updateComponent(input: $input) {
      id
      customId
      name
      descriptions
    }
  }
`;

export const DELETE_COMPONENT = gql`
  mutation DeleteComponent($id: UUID!) {
    deleteComponent(id: $id)
  }
`;

export const CREATE_FIELD_MAPPING = gql`
  mutation CreateFieldMapping($input: CreateFieldMappingInput!) {
    createFieldMapping(input: $input) {
      id
      dbTable
      dbColumn
    }
  }
`;

export const DELETE_FIELD_MAPPING = gql`
  mutation DeleteFieldMapping($id: UUID!) {
    deleteFieldMapping(id: $id)
  }
`;

export const ADD_TAG = gql`
  mutation AddEntityTag(
    $tagId: UUID!
    $entityType: String!
    $entityId: UUID!
  ) {
    addEntityTag(
      tagId: $tagId
      entityType: $entityType
      entityId: $entityId
    ) {
      id
    }
  }
`;

export const REMOVE_TAG = gql`
  mutation RemoveEntityTag(
    $tagId: UUID!
    $entityType: String!
    $entityId: UUID!
  ) {
    removeEntityTag(
      tagId: $tagId
      entityType: $entityType
      entityId: $entityId
    )
  }
`;
