/**
 * Scheduling / taxonomy domain types for Project Schedule Gantt modes.
 *
 * Pure type-only module — no runtime dependencies, safe for later GraphQL
 * producers (Increment 1: current task fields; Increment 3: capacity scheduler).
 */

/** Which Gantt presentation mode is active. Switching modes is presentation-only. */
export type ScheduleDisplayMode = 'WBS_DETAIL' | 'MASTER_SCHEDULE';

/** Configured display phase used to order Master Schedule groups. */
export interface PhaseDescriptor {
  phase_id: string;
  name: string;
  /** Lower sorts earlier in Master Schedule phase order. */
  display_order: number;
}

/**
 * Non-task source heading (e.g. issue-1115 tracker-Phase headings) shown in
 * WBS Detail as a display-only row. Has no task semantics: no task ID, no
 * effort, no progress, no assignee, no bar callbacks, no dependency role,
 * and no Master Schedule contribution.
 */
export interface WbsSourceHeading {
  source_heading_id: string;
  title: string;
  /** Zero-based indent depth in the WBS tree presentation. */
  depth: number;
}

/** Multilingual label of a taxonomy term, one per locale. */
export interface PhaseTranslation {
  locale: string;
  name: string;
}

/**
 * UI-facing project phase (ProjectPhaseType) with the locale-resolved label
 * attached as `name`. `phase_key`/`phase_id` are identifiers and never change
 * when translations are edited (labels are never identifiers).
 */
export interface ProjectPhase {
  phase_id: string;
  project_id: string;
  phase_key: string;
  display_order: number;
  is_active: boolean;
  translations: PhaseTranslation[];
  /** Locale-resolved display name (fallback: first translation, then key). */
  name: string;
}

/**
 * Pick the best translation for a locale: exact match, then language prefix,
 * then the first available translation. Never fabricates a label.
 */
export function pickPhaseName(
  translations: readonly PhaseTranslation[],
  locale: string
): string {
  if (translations.length === 0) return '';
  const exact = translations.find((t) => t.locale === locale);
  if (exact) return exact.name;
  const lang = locale.split('-')[0];
  const prefix = translations.find((t) => t.locale.split('-')[0] === lang);
  if (prefix) return prefix.name;
  return translations[0].name;
}
