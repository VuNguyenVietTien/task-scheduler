export type ProjectCatalogKind = 'PROGRESS_TYPE' | 'CATEGORY' | 'TASK_TYPE';

export interface ProjectCatalogLabel {
  locale: string;
  name: string;
}

export interface ProjectCatalogItem {
  catalog_item_id: string;
  project_id: string;
  kind: ProjectCatalogKind;
  display_order: number;
  labels: ProjectCatalogLabel[];
}

export interface ProjectCatalogItemDraft {
  labels: ProjectCatalogLabel[];
}
