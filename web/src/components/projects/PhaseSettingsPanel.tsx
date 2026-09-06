'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProjectPhase } from '@/types/taxonomy';
import type {
  ArchiveStrategyInput,
  CreateTermInput,
  UpdateTermTranslationsInput,
} from '@/graphql/mutations/taxonomies';

/**
 * Increment 1 — multilingual phase administration panel.
 *
 * Focused settings surface: seed defaults, create a phase with translations
 * (en/vi/ja), edit display order + translations, archive with explicit
 * strategy (reassign to an active phase XOR convert to Unphased).
 * Labels are never identifiers: editing translations never changes
 * phase_id/phase_key.
 */

export interface PhaseSettingsPanelProps {
  projectId: string;
  phases: ProjectPhase[];
  ensureDefaultPhases: () => Promise<number>;
  createPhase: (input: CreateTermInput) => Promise<unknown>;
  updatePhase: (input: UpdateTermTranslationsInput) => Promise<unknown>;
  archivePhase: (phaseId: string, strategy: ArchiveStrategyInput) => Promise<unknown>;
  busy?: boolean;
  className?: string;
}

const LOCALES = ['en', 'vi', 'ja'] as const;

interface DraftTranslations {
  en: string;
  vi: string;
  ja: string;
}

const emptyTranslations = (): DraftTranslations => ({ en: '', vi: '', ja: '' });

export function PhaseSettingsPanel({
  projectId,
  phases,
  ensureDefaultPhases,
  createPhase,
  updatePhase,
  archivePhase,
  busy = false,
  className = '',
}: PhaseSettingsPanelProps) {
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newOrder, setNewOrder] = useState(phases.length + 1);
  const [newColor, setNewColor] = useState('');
  const [newTranslations, setNewTranslations] = useState<DraftTranslations>(emptyTranslations);
  const [error, setError] = useState<string | null>(null);

  // Per-phase editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editOrder, setEditOrder] = useState(0);
  const [editTranslations, setEditTranslations] = useState<DraftTranslations>(emptyTranslations);

  // Archive strategy state
  const [archiveTarget, setArchiveTarget] = useState<string | null>(null);
  const [archiveStrategy, setArchiveStrategy] = useState<'reassign' | 'unphased'>('unphased');
  const [archiveReassignTo, setArchiveReassignTo] = useState('');

  const run = async (action: () => Promise<unknown>) => {
    try {
      setError(null);
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const startEdit = (phase: ProjectPhase) => {
    const current = (locale: string) =>
      phase.translations.find((tr) => tr.locale === locale)?.name ?? '';
    setEditingId(phase.phase_id);
    setEditOrder(phase.display_order);
    setEditTranslations({ en: current('en'), vi: current('vi'), ja: current('ja') });
  };

  const submitCreate = () =>
    run(async () => {
      const translations = LOCALES.filter((l) => newTranslations[l].trim())
        .map((l) => ({ locale: l, name: newTranslations[l].trim() }));
      await createPhase({
        project_id: projectId,
        term_key: newKey.trim(),
        display_order: newOrder,
        color: newColor.trim() || null,
        translations: translations.length ? translations : [{ locale: 'en', name: newKey.trim() }],
      });
      setShowCreate(false);
      setNewKey('');
      setNewTranslations(emptyTranslations());
    });

  const submitEdit = (phase: ProjectPhase) =>
    run(async () => {
      const translations = LOCALES.filter((l) => editTranslations[l].trim())
        .map((l) => ({ locale: l, name: editTranslations[l].trim() }));
      await updatePhase({
        project_id: projectId,
        term_id: phase.phase_id,
        display_order: editOrder,
        translations: translations.length ? translations : undefined,
      });
      setEditingId(null);
    });

  const submitArchive = (phaseId: string) =>
    run(async () => {
      const strategy: ArchiveStrategyInput =
        archiveStrategy === 'reassign'
          ? { reassign_to: archiveReassignTo }
          : { unphased: true };
      await archivePhase(phaseId, strategy);
      setArchiveTarget(null);
    });

  return (
    <section
      data-testid="phase-settings-panel"
      aria-label={t('scheduling.phaseSettings')}
      className={`border border-slate-200 rounded-lg p-3 bg-slate-50 ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-slate-700">{t('scheduling.phaseSettings')}</h3>
        <div className="flex gap-2">
          <button
            type="button"
            data-testid="phase-seed-defaults"
            disabled={busy}
            onClick={() => void run(ensureDefaultPhases)}
            className="px-2 py-1 text-xs rounded bg-slate-200 hover:bg-slate-300"
          >
            {t('scheduling.seedDefaults')}
          </button>
          <button
            type="button"
            data-testid="phase-add-toggle"
            disabled={busy}
            onClick={() => setShowCreate((v) => !v)}
            className="px-2 py-1 text-xs rounded bg-blue-100 hover:bg-blue-200"
          >
            {t('scheduling.addPhase')}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-600 mb-2">
          {t('scheduling.saveFailed')}: {error}
        </p>
      )}

      {showCreate && (
        <div data-testid="phase-create-form" className="mb-3 p-2 border rounded bg-white text-xs">
          <div className="flex flex-wrap gap-2 mb-2">
            <label>
              {t('scheduling.phaseKey')}
              <input
                data-testid="phase-create-key"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="ml-1 px-1 border rounded w-28"
              />
            </label>
            <label>
              {t('scheduling.displayOrder')}
              <input
                type="number"
                data-testid="phase-create-order"
                value={newOrder}
                onChange={(e) => setNewOrder(Number(e.target.value))}
                className="ml-1 px-1 border rounded w-16"
              />
            </label>
            <label>
              {t('scheduling.color')}
              <input
                data-testid="phase-create-color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                placeholder="#0ea5e9"
                className="ml-1 px-1 border rounded w-24"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {LOCALES.map((l) => (
              <label key={l}>
                {l.toUpperCase()}
                <input
                  data-testid={`phase-create-translation-${l}`}
                  value={newTranslations[l]}
                  onChange={(e) =>
                    setNewTranslations((prev) => ({ ...prev, [l]: e.target.value }))
                  }
                  className="ml-1 px-1 border rounded w-28"
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            data-testid="phase-create-submit"
            disabled={busy || !newKey.trim()}
            onClick={() => void submitCreate()}
            className="px-2 py-1 rounded bg-blue-600 text-white"
          >
            {t('common.save')}
          </button>
        </div>
      )}

      <ul data-testid="phase-settings-list" className="space-y-1">
        {phases.map((phase) => (
          <li
            key={phase.phase_id}
            data-phase-id={phase.phase_id}
            className="p-2 border rounded bg-white text-xs flex flex-wrap items-center gap-2"
          >
            <span className="font-mono text-slate-400">#{phase.display_order}</span>
            <span className="font-medium text-slate-700">{phase.name}</span>
            <span className="text-slate-400">{phase.phase_key}</span>

            {editingId === phase.phase_id ? (
              <span className="flex flex-wrap items-center gap-1" data-testid={`phase-edit-form-${phase.phase_id}`}>
                <input
                  type="number"
                  aria-label={t('scheduling.displayOrder')}
                  value={editOrder}
                  onChange={(e) => setEditOrder(Number(e.target.value))}
                  className="px-1 border rounded w-14"
                />
                {LOCALES.map((l) => (
                  <input
                    key={l}
                    aria-label={`${l.toUpperCase()} ${t('scheduling.phaseName')}`}
                    value={editTranslations[l]}
                    onChange={(e) =>
                      setEditTranslations((prev) => ({ ...prev, [l]: e.target.value }))
                    }
                    placeholder={l.toUpperCase()}
                    className="px-1 border rounded w-24"
                  />
                ))}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submitEdit(phase)}
                  className="px-2 py-0.5 rounded bg-blue-600 text-white"
                >
                  {t('common.save')}
                </button>
                <button type="button" onClick={() => setEditingId(null)} className="px-2 py-0.5 rounded bg-slate-200">
                  {t('common.cancel')}
                </button>
              </span>
            ) : (
              <>
                <button
                  type="button"
                  data-testid={`phase-edit-${phase.phase_id}`}
                  disabled={busy}
                  onClick={() => startEdit(phase)}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200"
                >
                  {t('common.edit')}
                </button>
                <button
                  type="button"
                  data-testid={`phase-archive-${phase.phase_id}`}
                  disabled={busy}
                  onClick={() => {
                    setArchiveTarget(phase.phase_id);
                    setArchiveStrategy('unphased');
                    setArchiveReassignTo(phases.find((p) => p.phase_id !== phase.phase_id)?.phase_id ?? '');
                  }}
                  className="px-2 py-0.5 rounded bg-red-100 hover:bg-red-200 text-red-700"
                >
                  {t('scheduling.archive')}
                </button>
              </>
            )}

            {archiveTarget === phase.phase_id && (
              <span className="flex items-center gap-1" data-testid={`phase-archive-form-${phase.phase_id}`}>
                <select
                  aria-label={t('scheduling.archiveStrategy')}
                  value={archiveStrategy}
                  onChange={(e) => setArchiveStrategy(e.target.value as 'reassign' | 'unphased')}
                  className="px-1 border rounded"
                >
                  <option value="unphased">{t('scheduling.moveUnphased')}</option>
                  <option value="reassign">{t('scheduling.reassignTo')}</option>
                </select>
                {archiveStrategy === 'reassign' && (
                  <select
                    aria-label={t('scheduling.reassignTo')}
                    value={archiveReassignTo}
                    onChange={(e) => setArchiveReassignTo(e.target.value)}
                    className="px-1 border rounded"
                  >
                    {phases
                      .filter((p) => p.phase_id !== phase.phase_id)
                      .map((p) => (
                        <option key={p.phase_id} value={p.phase_id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                )}
                <button
                  type="button"
                  disabled={busy || (archiveStrategy === 'reassign' && !archiveReassignTo)}
                  onClick={() => void submitArchive(phase.phase_id)}
                  className="px-2 py-0.5 rounded bg-red-600 text-white"
                >
                  {t('scheduling.archiveConfirm')}
                </button>
                <button type="button" onClick={() => setArchiveTarget(null)} className="px-2 py-0.5 rounded bg-slate-200">
                  {t('common.cancel')}
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>

      {phases.length === 0 && (
        <p className="text-xs text-slate-500">{t('scheduling.noPhases')}</p>
      )}
    </section>
  );
}

export default PhaseSettingsPanel;
