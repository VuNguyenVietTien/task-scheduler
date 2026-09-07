import { useQuery } from '@apollo/client';
import { PROJECT_CATALOG_ITEMS } from '@/graphql/queries/catalogs';
import type { ProjectCatalogItem, ProjectCatalogKind } from '@/types/project-catalog';

interface CatalogQueryData {
  project_catalog_items: ProjectCatalogItem[];
}

export function useProjectCatalogs(projectId: string | undefined, kind: ProjectCatalogKind) {
  const query = useQuery<CatalogQueryData>(PROJECT_CATALOG_ITEMS, {
    variables: { projectId: projectId ?? '', kind },
    skip: !projectId,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  });

  return {
    items: projectId
      ? (query.data?.project_catalog_items ?? []).filter((item) => item.project_id === projectId)
      : [],
    loading: query.loading,
    error: query.error,
    refetch: query.refetch,
  };
}
