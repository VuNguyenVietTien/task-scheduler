import { gql } from '@apollo/client';

/**
 * Increment 1 — taxonomy (project phase) reads.
 * Backend contract: Task 1.3 report §4 (exact SDL operation/field names).
 */

export interface GqlPhaseTranslation {
  locale: string;
  name: string;
}

export interface GqlProjectPhase {
  phase_id: string;
  project_id: string;
  phase_key: string;
  display_order: number;
  is_active: boolean;
  translations: GqlPhaseTranslation[];
}

export interface GetProjectPhasesData {
  project_phases: GqlProjectPhase[];
}

export interface GetProjectPhasesVars {
  projectId: string;
  includeArchived?: boolean;
}

export const GET_PROJECT_PHASES = gql`
  query GetProjectPhases($projectId: ID!, $includeArchived: Boolean) {
    project_phases(project_id: $projectId, include_archived: $includeArchived) {
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
  }
`;
