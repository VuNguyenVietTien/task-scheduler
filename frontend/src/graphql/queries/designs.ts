import { gql } from '@apollo/client';

export const GET_SYSTEMS = gql`
  query GetSystems($projectId: String!) {
    systems(projectId: $projectId) {
      id
      projectId
      name
      description
      createdAt
      modules {
        id
        name
        sortOrder
      }
    }
  }
`;

export const GET_SYSTEM = gql`
  query GetSystem($id: UUID!) {
    system(id: $id) {
      id
      projectId
      name
      description
      modules {
        id
        name
        description
        sortOrder
        documents {
          id
          name
          status
          createdAt
        }
      }
    }
  }
`;

export const GET_DOCUMENT = gql`
  query GetDocument($id: UUID!) {
    designDocument(id: $id) {
      id
      name
      status
      description
      createdAt
      screens {
        id
        name
        breakpoint
        sortOrder
      }
      flows {
        id
        name
        flowType
      }
      tags {
        id
        name
        color
      }
    }
  }
`;

export const GET_SCREEN = gql`
  query GetScreen($id: UUID!) {
    screen(id: $id) {
      id
      name
      svgContent
      svgLayers
      frameWidth
      frameHeight
      breakpoint
      components {
        id
        customId
        name
        componentType
        dataType
        displayLogic
        position
        svgElementId
        descriptions
        fieldMappings {
          id
          dbTable
          dbColumn
          description
        }
        tags {
          id
          name
          color
        }
      }
    }
  }
`;

export const GET_TAGS = gql`
  query GetTags {
    tags {
      id
      name
      color
    }
  }
`;

export const EXPORT_DOCUMENT_FOR_AI = gql`
  query ExportDocumentForAI($documentId: UUID!) {
    exportDocumentForAi(documentId: $documentId) {
      id
      name
      status
      description
      screens {
        id
        name
        breakpoint
        components {
          id
          customId
          name
          componentType
          dataType
          displayLogic
          descriptions
          position
          fieldMappings {
            dbTable
            dbColumn
            description
          }
          tags { name }
        }
      }
      flows {
        id
        name
        flowType
        mermaidDefinition
        steps {
          stepOrder
          label
          screenId
          componentId
        }
      }
      tags { name }
    }
  }
`;
