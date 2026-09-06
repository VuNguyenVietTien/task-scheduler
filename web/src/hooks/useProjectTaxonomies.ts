'use client';

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@apollo/client';
import { client as apolloClient } from '@/lib/apollo-client';
import { GET_PROJECT_PHASES } from '@/graphql/queries/taxonomies';
import type { GetProjectPhasesData, GetProjectPhasesVars } from '@/graphql/queries/taxonomies';
import {
  ENSURE_DEFAULT_PHASES,
  CREATE_PROJECT_PHASE,
  UPDATE_PROJECT_PHASE_TRANSLATIONS,
  ARCHIVE_PROJECT_PHASE,
  SET_TASK_TAXONOMY,
} from '@/graphql/mutations/taxonomies';
import type {
  ArchiveStrategyInput,
  CreateTermInput,
  UpdateTermTranslationsInput,
} from '@/graphql/mutations/taxonomies';
import { pickPhaseName, type ProjectPhase } from '@/types/taxonomy';

/**
 * Increment 1 — project taxonomy (phase) reads/writes for one project.
 *
 * Reads: active phases by default (includeArchived for admin views), with the
 * locale-resolved label attached as `name`. Writes: seed defaults, create,
 * edit order/translations, archive with explicit strategy. All writes refresh
 * the phase read.
 */
export function useProjectTaxonomies(
  projectId: string | null | undefined,
  options?: { includeArchived?: boolean }
) {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const includeArchived = options?.includeArchived ?? false;

  const { data, loading, error, refetch } = useQuery<
    GetProjectPhasesData,
    GetProjectPhasesVars
  >(GET_PROJECT_PHASES, {
    variables: { projectId: projectId ?? '', includeArchived },
    skip: !projectId,
    fetchPolicy: 'cache-and-network',
  });

  /** Exact display order, active first-class list; Unphased is NOT a phase. */
  const phases = useMemo<ProjectPhase[]>(() => {
    const list = data?.project_phases ?? [];
    return list
      .map((p) => ({ ...p, name: pickPhaseName(p.translations, locale) || p.phase_key }))
      .sort((a, b) => a.display_order - b.display_order);
  }, [data, locale]);

  const ensureDefaultPhases = useCallback(async (): Promise<number> => {
    if (!projectId) throw new Error('projectId required');
    const res = await apolloClient.mutate({
      mutation: ENSURE_DEFAULT_PHASES,
      variables: { projectId },
    });
    await refetch();
    return res.data?.ensure_default_phases ?? 0;
  }, [projectId, refetch]);

  const createPhase = useCallback(
    async (input: CreateTermInput): Promise<ProjectPhase> => {
      const res = await apolloClient.mutate({ mutation: CREATE_PROJECT_PHASE, variables: { input } });
      await refetch();
      const p = res.data?.create_project_phase;
      if (!p) throw new Error('create_project_phase returned no phase');
      return { ...p, name: pickPhaseName(p.translations, locale) || p.phase_key };
    },
    [refetch, locale]
  );

  const updatePhase = useCallback(
    async (input: UpdateTermTranslationsInput): Promise<ProjectPhase> => {
      const res = await apolloClient.mutate({
        mutation: UPDATE_PROJECT_PHASE_TRANSLATIONS,
        variables: { input },
      });
      await refetch();
      const p = res.data?.update_project_phase_translations;
      if (!p) throw new Error('update_project_phase_translations returned no phase');
      return { ...p, name: pickPhaseName(p.translations, locale) || p.phase_key };
    },
    [refetch, locale]
  );

  const archivePhase = useCallback(
    async (phaseId: string, strategy: ArchiveStrategyInput): Promise<number> => {
      if (!projectId) throw new Error('projectId required');
      const res = await apolloClient.mutate({
        mutation: ARCHIVE_PROJECT_PHASE,
        variables: { projectId, phaseId, strategy },
      });
      await refetch();
      return res.data?.archive_project_phase ?? 0;
    },
    [projectId, refetch]
  );

  /** NULL explicitly means Unphased (uncategorised). */
  const setTaskPhase = useCallback(async (taskId: string, phaseId: string | null) => {
    await apolloClient.mutate({
      mutation: SET_TASK_TAXONOMY,
      variables: { taskId, phaseId, categoryId: null },
    });
  }, []);

  /** Category assignment shares set_task_taxonomy; kept for completeness. */
  const setTaskCategory = useCallback(async (taskId: string, categoryId: string | null) => {
    await apolloClient.mutate({
      mutation: SET_TASK_TAXONOMY,
      variables: { taskId, phaseId: null, categoryId },
    });
  }, []);

  return {
    phases,
    loading,
    error,
    refetch,
    ensureDefaultPhases,
    createPhase,
    updatePhase,
    archivePhase,
    setTaskPhase,
    setTaskCategory,
  };
}
