import { gql } from '@apollo/client';
import type { GqlProjectPhase } from '@/graphql/queries/taxonomies';

/**
 * Increment 1 — taxonomy (project phase) writes.
 * Backend contract: Task 1.3 report §4 (exact SDL operation/field names).
 * Labels are never identifiers: order/color/translations are editable,
 * phase_key is project-local and immutable after create.
 */

export const PHASE_FIELDS = gql`
  fragment PhaseFields on ProjectPhaseType {
    phase_id
    project_id
    phase_key
    display_order
    is_active
    translations {
      locale
      name
    }
  }
`;

export interface TranslationInput {
  locale: string;
  name: string;
  description?: string | null;
}

export interface CreateTermInput {
  project_id: string;
  term_key: string;
  display_order: number;
  color?: string | null;
  translations: TranslationInput[];
}

export interface UpdateTermTranslationsInput {
  project_id: string;
  term_id: string;
  display_order?: number | null;
  color?: string | null;
  translations?: TranslationInput[] | null;
}

export interface ArchiveStrategyInput {
  /** Atomically move every referencing task to this active term. */
  reassign_to?: string | null;
  /** Explicit Unphased conversion: referencing tasks lose the attribute. */
  unphased?: boolean | null;
}

export interface EnsureDefaultPhasesData {
  ensure_default_phases: number;
}
export interface EnsureDefaultPhasesVars {
  projectId: string;
}

export const ENSURE_DEFAULT_PHASES = gql`
  mutation EnsureDefaultPhases($projectId: ID!) {
    ensure_default_phases(project_id: $projectId)
  }
`;

export interface CreateProjectPhaseData {
  create_project_phase: GqlProjectPhase;
}
export interface CreateProjectPhaseVars {
  input: CreateTermInput;
}

export const CREATE_PROJECT_PHASE = gql`
  mutation CreateProjectPhase($input: CreateTermInput!) {
    create_project_phase(input: $input) {
      ...PhaseFields
    }
  }
  ${PHASE_FIELDS}
`;

export interface UpdateProjectPhaseTranslationsData {
  update_project_phase_translations: GqlProjectPhase;
}
export interface UpdateProjectPhaseTranslationsVars {
  input: UpdateTermTranslationsInput;
}

export const UPDATE_PROJECT_PHASE_TRANSLATIONS = gql`
  mutation UpdateProjectPhaseTranslations($input: UpdateTermTranslationsInput!) {
    update_project_phase_translations(input: $input) {
      ...PhaseFields
    }
  }
  ${PHASE_FIELDS}
`;

export interface ArchiveProjectPhaseData {
  archive_project_phase: number;
}
export interface ArchiveProjectPhaseVars {
  projectId: string;
  phaseId: string;
  strategy: ArchiveStrategyInput;
}

export const ARCHIVE_PROJECT_PHASE = gql`
  mutation ArchiveProjectPhase($projectId: ID!, $phaseId: ID!, $strategy: ArchiveStrategyInput!) {
    archive_project_phase(project_id: $projectId, phase_id: $phaseId, strategy: $strategy)
  }
`;

export interface SetTaskTaxonomyData {
  set_task_taxonomy: boolean;
}
export interface SetTaskTaxonomyVars {
  taskId: string;
  phaseId?: string | null;
  categoryId?: string | null;
}

/** NULL explicitly means Unphased / uncategorised. */
export const SET_TASK_TAXONOMY = gql`
  mutation SetTaskTaxonomy($taskId: ID!, $phaseId: ID, $categoryId: ID) {
    set_task_taxonomy(task_id: $taskId, phase_id: $phaseId, category_id: $categoryId)
  }
`;
