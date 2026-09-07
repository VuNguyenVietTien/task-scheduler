import { gql } from '@apollo/client';

export const PROJECT_CATALOG_ITEMS = gql`
  query ProjectCatalogItems($projectId: ID!, $kind: ProjectCatalogKind!) {
    project_catalog_items(project_id: $projectId, kind: $kind) {
      catalog_item_id
      project_id
      kind
      display_order
      labels {
        locale
        name
      }
    }
  }
`;
