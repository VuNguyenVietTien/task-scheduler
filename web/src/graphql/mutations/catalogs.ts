import { gql } from '@apollo/client';

const CATALOG_ITEM_FIELDS = gql`
  fragment CatalogItemFields on ProjectCatalogItem {
    catalog_item_id
    project_id
    kind
    display_order
    labels {
      locale
      name
    }
  }
`;

export const CREATE_PROJECT_CATALOG_ITEMS = gql`
  mutation CreateProjectCatalogItems($input: CreateProjectCatalogItemsInput!) {
    create_project_catalog_items(input: $input) {
      ...CatalogItemFields
    }
  }
  ${CATALOG_ITEM_FIELDS}
`;

export const UPDATE_PROJECT_CATALOG_ITEM = gql`
  mutation UpdateProjectCatalogItem($input: UpdateProjectCatalogItemInput!) {
    update_project_catalog_item(input: $input) {
      ...CatalogItemFields
    }
  }
  ${CATALOG_ITEM_FIELDS}
`;

export const DELETE_PROJECT_CATALOG_ITEM = gql`
  mutation DeleteProjectCatalogItem($catalog_item_id: ID!) {
    delete_project_catalog_item(catalog_item_id: $catalog_item_id) {
      catalog_item_id
      project_id
      kind
      affected_task_ids
    }
  }
`;

export const REORDER_PROJECT_CATALOG_ITEMS = gql`
  mutation ReorderProjectCatalogItems($input: ReorderProjectCatalogItemsInput!) {
    reorder_project_catalog_items(input: $input) {
      ...CatalogItemFields
    }
  }
  ${CATALOG_ITEM_FIELDS}
`;
