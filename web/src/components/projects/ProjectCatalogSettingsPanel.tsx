'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  CREATE_PROJECT_CATALOG_ITEMS,
  DELETE_PROJECT_CATALOG_ITEM,
  REORDER_PROJECT_CATALOG_ITEMS,
  UPDATE_PROJECT_CATALOG_ITEM,
} from '@/graphql/mutations/catalogs';
import { useProjectCatalogs } from '@/hooks/useProjectCatalogs';
import {
  PROJECT_CATALOG_LOCALES,
  type ProjectCatalogItem,
  type ProjectCatalogKind,
  type ProjectCatalogLabel,
  type ProjectCatalogLocale,
  type ProjectCatalogTranslationDraft,
} from '@/types/project-catalog';
import { parseProjectCatalogTranslationPaste, resolveProjectCatalogLabel } from '@/utils/project-catalog';

const KINDS: Array<{ kind: ProjectCatalogKind; title: string }> = [
  { kind: 'PROGRESS_TYPE', title: 'Progress types' },
  { kind: 'CATEGORY', title: 'Categories' },
  { kind: 'TASK_TYPE', title: 'Task types' },
];
const LANGUAGES: Array<{ locale: ProjectCatalogLocale; label: string }> = [
  { locale: 'en', label: 'English (en)' },
  { locale: 'ja', label: 'Japanese (ja)' },
  { locale: 'vi', label: 'Vietnamese (vi)' },
];
const emptyTranslations = (): ProjectCatalogTranslationDraft => ({ en: '', ja: '', vi: '' });

function fixedTranslations(item: ProjectCatalogItem): ProjectCatalogTranslationDraft {
  return Object.fromEntries(PROJECT_CATALOG_LOCALES.map((locale) => [
    locale,
    item.labels.find((label) => label.locale === locale)?.name ?? '',
  ])) as ProjectCatalogTranslationDraft;
}

function friendlyError(error: unknown): string {
  const graphQLError = (error as { graphQLErrors?: Array<{ message?: string }> })?.graphQLErrors?.[0]?.message;
  const message = graphQLError || (error instanceof Error ? error.message : String(error));
  if (/conflict/i.test(message)) return 'This catalog changed. Reload it and try again.';
  if (/forbidden|must be a manager/i.test(message)) return 'You do not have permission to change this catalog.';
  if (/network|fetch|offline/i.test(message)) return 'The catalog could not be saved. Please try again.';
  return message || 'The catalog could not be saved. Please try again.';
}

async function refreshAfterSave(refetch: () => Promise<unknown>, setNotice: (value: string) => void) {
  try {
    await refetch();
    setNotice('Saved.');
  } catch {
    setNotice('Saved, but the latest list could not be loaded. Retry the refresh.');
  }
}

function TranslationFields({
  values,
  disabled,
  labelPrefix,
  onChange,
}: {
  values: ProjectCatalogTranslationDraft;
  disabled: boolean;
  labelPrefix?: string;
  onChange: (locale: ProjectCatalogLocale, value: string) => void;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-3">
      {LANGUAGES.map(({ locale, label }) => (
        <label key={locale} className="text-sm font-medium text-slate-700">
          {label}
          <input
            aria-label={labelPrefix ? `${labelPrefix} ${label}` : label}
            value={values[locale]}
            disabled={disabled}
            onChange={(event) => onChange(locale, event.target.value)}
            className="mt-1 w-full rounded border px-2 py-1 text-sm disabled:bg-slate-50"
          />
        </label>
      ))}
    </div>
  );
}

function CatalogItemEditor({
  item,
  index,
  count,
  locale,
  canManage,
  busy,
  deleting,
  onSave,
  onDelete,
  onMove,
}: {
  item: ProjectCatalogItem;
  index: number;
  count: number;
  locale: string;
  canManage: boolean;
  busy: boolean;
  deleting: boolean;
  onSave: (item: ProjectCatalogItem, values: ProjectCatalogTranslationDraft) => Promise<void>;
  onDelete: (item: ProjectCatalogItem) => Promise<void>;
  onMove: (index: number, direction: -1 | 1) => Promise<void>;
}) {
  const [values, setValues] = useState(() => fixedTranslations(item));
  useEffect(() => setValues(fixedTranslations(item)), [item]);

  return (
    <li className="rounded border border-slate-200 bg-white p-3" data-testid={`catalog-item-${item.catalog_item_id}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <strong className="text-sm text-slate-800">{resolveProjectCatalogLabel(item, locale)}</strong>
        {canManage && (
          <div className="flex gap-1">
            <button type="button" aria-label="Move up" disabled={busy || index === 0} onClick={() => void onMove(index, -1)} className="rounded border px-2 py-1 disabled:opacity-40">↑</button>
            <button type="button" aria-label="Move down" disabled={busy || index === count - 1} onClick={() => void onMove(index, 1)} className="rounded border px-2 py-1 disabled:opacity-40">↓</button>
            <button type="button" aria-label={`Delete ${resolveProjectCatalogLabel(item, locale)}`} disabled={busy} onClick={() => void onDelete(item)} className="rounded border border-red-200 px-2 py-1 text-red-700 disabled:opacity-40">{deleting ? 'Deleting…' : 'Delete'}</button>
          </div>
        )}
      </div>
      <TranslationFields
        values={values}
        disabled={!canManage || busy}
        onChange={(language, value) => setValues((current) => ({ ...current, [language]: value }))}
      />
      {canManage && (
        <button type="button" disabled={busy} onClick={() => void onSave(item, values)} className="mt-2 rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-40">Save labels</button>
      )}
    </li>
  );
}

function CatalogKindPanel({ projectId, kind, title, locale, canManage, onTasksChanged }: { projectId: string; kind: ProjectCatalogKind; title: string; locale: string; canManage: boolean; onTasksChanged?: () => void | Promise<void> }) {
  const { items, loading, error, refetch } = useProjectCatalogs(projectId, kind);
  const orderedItems = useMemo(() => [...items].sort((a, b) => a.display_order - b.display_order || a.catalog_item_id.localeCompare(b.catalog_item_id)), [items]);
  const [paste, setPaste] = useState<ProjectCatalogTranslationDraft>(emptyTranslations);
  const [preview, setPreview] = useState<Array<{ key: number; values: ProjectCatalogTranslationDraft }>>([]);
  const [nextKey, setNextKey] = useState(0);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [createItems] = useMutation(CREATE_PROJECT_CATALOG_ITEMS);
  const [updateItem] = useMutation(UPDATE_PROJECT_CATALOG_ITEM);
  const [deleteItem] = useMutation(DELETE_PROJECT_CATALOG_ITEM);
  const [reorderItems] = useMutation(REORDER_PROJECT_CATALOG_ITEMS);

  useEffect(() => {
    setPaste(emptyTranslations());
    setPreview([]);
    setNotice('');
  }, [projectId, kind]);

  const buildPreview = () => {
    const parsed = parseProjectCatalogTranslationPaste(paste);
    setPreview(parsed.rows.map((values, index) => ({ key: nextKey + index, values })));
    setNextKey((value) => value + parsed.rows.length);
    setNotice(parsed.error ?? '');
  };

  const addPreview = async () => {
    const rows = preview.map(({ values }) => Object.fromEntries(PROJECT_CATALOG_LOCALES.map((language) => [
      language,
      values[language].normalize('NFC').trim(),
    ])) as ProjectCatalogTranslationDraft);
    if (rows.some((values) => PROJECT_CATALOG_LOCALES.every((language) => !values[language]))) {
      setNotice('Each item needs at least one non-empty translation.');
      return;
    }
    const pairs = rows.flatMap((values) => PROJECT_CATALOG_LOCALES
      .filter((language) => values[language])
      .map((language) => `${language}\0${values[language]}`));
    if (new Set(pairs).size !== pairs.length) {
      setNotice('Duplicate values in the same language are not allowed.');
      return;
    }

    setBusy(true);
    setNotice('');
    try {
      await createItems({ variables: { input: {
        project_id: projectId,
        kind,
        items: rows.map((values) => ({ labels: PROJECT_CATALOG_LOCALES
          .filter((language) => values[language])
          .map((language) => ({ locale: language, name: values[language] })) })),
      } } });
      setPaste(emptyTranslations());
      setPreview([]);
      await refreshAfterSave(refetch, setNotice);
    } catch (saveError) {
      setNotice(friendlyError(saveError));
    } finally {
      setBusy(false);
    }
  };

  const saveLabels = async (item: ProjectCatalogItem, values: ProjectCatalogTranslationDraft) => {
    const supported = PROJECT_CATALOG_LOCALES
      .map((language) => ({ locale: language, name: values[language].normalize('NFC').trim() }))
      .filter((label) => label.name);
    if (!supported.length) {
      setNotice('At least one translation is required.');
      return;
    }
    const extras = item.labels.filter((label) => !PROJECT_CATALOG_LOCALES.includes(label.locale as ProjectCatalogLocale));
    const labels: ProjectCatalogLabel[] = [...supported, ...extras];
    if (labels.length > 20) {
      setNotice('This item has too many preserved language values to save.');
      return;
    }

    setBusy(true);
    setNotice('');
    try {
      await updateItem({ variables: { input: { catalog_item_id: item.catalog_item_id, labels } } });
      await refreshAfterSave(refetch, setNotice);
    } catch (saveError) {
      setNotice(friendlyError(saveError));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: ProjectCatalogItem) => {
    if (!window.confirm(`Delete ${resolveProjectCatalogLabel(item, locale)}? Tasks using it will be cleared.`)) return;
    setBusy(true);
    setDeletingItemId(item.catalog_item_id);
    setNotice('');
    try {
      await deleteItem({ variables: { catalog_item_id: item.catalog_item_id } });
      try {
        await Promise.all([refetch(), Promise.resolve(onTasksChanged?.())]);
        setNotice('Deleted.');
      } catch {
        setNotice('Deleted, but the latest catalog or tasks could not be loaded. Retry the refresh.');
      }
    } catch (deleteError) {
      setNotice(friendlyError(deleteError));
    } finally {
      setDeletingItemId(null);
      setBusy(false);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const next = [...orderedItems];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setBusy(true);
    setNotice('');
    try {
      await reorderItems({ variables: { input: {
        project_id: projectId,
        kind,
        ordered_catalog_item_ids: next.map((item) => item.catalog_item_id),
        expected_catalog_item_ids: orderedItems.map((item) => item.catalog_item_id),
      } } });
      await refreshAfterSave(refetch, setNotice);
    } catch (saveError) {
      setNotice(friendlyError(saveError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby={`catalog-${kind}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h2 id={`catalog-${kind}`} className="text-lg font-semibold text-slate-900">{title}</h2>
      {loading && !items.length && <p role="status" className="mt-2 text-sm text-slate-600">Loading catalog…</p>}
      {error && <div role="alert" className="mt-2 text-sm text-red-700">Could not load this catalog. <button type="button" onClick={() => void refetch()} className="underline">Retry</button></div>}
      {!loading && !error && !orderedItems.length && <p className="mt-2 text-sm text-slate-600">No values configured.</p>}
      {!!orderedItems.length && <ol className="mt-3 space-y-2">{orderedItems.map((item, index) => <CatalogItemEditor key={item.catalog_item_id} item={item} index={index} count={orderedItems.length} locale={locale} canManage={canManage} busy={busy} deleting={deletingItemId === item.catalog_item_id} onSave={saveLabels} onDelete={remove} onMove={move} />)}</ol>}

      {canManage && (
        <div className="mt-4 border-t border-slate-200 pt-3">
          <p className="text-sm font-medium text-slate-700">Paste values</p>
          <p className="mb-2 text-xs text-slate-500">Paste comma-, tab-, or line-separated values into each language. Non-empty columns must have matching counts.</p>
          <div className="grid gap-2 md:grid-cols-3">
            {LANGUAGES.map(({ locale: language, label }) => (
              <label key={language} className="text-sm font-medium text-slate-700">
                {label}
                <textarea aria-label={`${title} ${label} paste values`} value={paste[language]} onChange={(event) => setPaste((current) => ({ ...current, [language]: event.target.value }))} rows={3} className="mt-1 w-full rounded border px-2 py-1" />
              </label>
            ))}
          </div>
          <button type="button" onClick={buildPreview} disabled={busy} className="mt-2 rounded border bg-white px-3 py-2 text-sm disabled:opacity-40">Preview</button>
          {!!preview.length && (
            <div className="mt-3" aria-label={`${title} preview`}>
              <p className="text-sm font-medium text-slate-700">Review aligned translations before adding</p>
              <ul className="mt-2 space-y-2">{preview.map((entry, index) => (
                <li key={entry.key} className="rounded border border-slate-200 bg-white p-2">
                  <TranslationFields
                    values={entry.values}
                    disabled={busy}
                    labelPrefix={`${title} preview row ${index + 1}`}
                    onChange={(language, value) => setPreview((current) => current.map((candidate) => candidate.key === entry.key ? { ...candidate, values: { ...candidate.values, [language]: value } } : candidate))}
                  />
                  <button type="button" aria-label={`Remove row ${index + 1}`} onClick={() => setPreview((current) => current.filter((candidate) => candidate.key !== entry.key))} className="mt-2 rounded border px-2 py-1 text-sm">Remove</button>
                </li>
              ))}</ul>
              <button type="button" disabled={busy} onClick={() => void addPreview()} className="mt-2 rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-40">Add {preview.length} values</button>
            </div>
          )}
        </div>
      )}
      {notice && <p role="status" className={`mt-2 text-sm ${notice.startsWith('Saved') ? 'text-green-700' : 'text-red-700'}`}>{notice}</p>}
    </section>
  );
}

export function ProjectCatalogSettingsPanel({ projectId, canManage, onTasksChanged }: { projectId: string; canManage: boolean; onTasksChanged?: () => void | Promise<void> }) {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  return <div className="space-y-4"><div><h1 className="text-xl font-semibold text-slate-900">Project settings</h1><p className="text-sm text-slate-600">Configure English, Japanese, and Vietnamese task labels for this project. Missing translations fall back deterministically; IDs remain stable when labels, language, or order change.</p>{!canManage && <p className="mt-1 text-sm text-slate-600">You have read-only access.</p>}</div>{KINDS.map(({ kind, title }) => <CatalogKindPanel key={`${projectId}-${kind}`} projectId={projectId} kind={kind} title={title} locale={locale} canManage={canManage} onTasksChanged={onTasksChanged} />)}</div>;
}

export function ProjectCatalogSelect({ projectId, kind, value, legacyLabel, onChange, disabled, label }: { projectId: string | undefined; kind: ProjectCatalogKind; value?: string | null; legacyLabel?: string | null; onChange: (value: string | null) => void; disabled?: boolean; label: string }) {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const { items, loading, error, refetch } = useProjectCatalogs(projectId, kind);
  const ordered = useMemo(() => [...items].sort((a, b) => a.display_order - b.display_order || a.catalog_item_id.localeCompare(b.catalog_item_id)), [items]);
  const current = value ? ordered.find((item) => item.catalog_item_id === value) : undefined;

  return <div><select aria-label={label} value={value ?? ''} disabled={disabled || loading || Boolean(error)} onChange={(event) => onChange(event.target.value || null)} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50"><option value="">Not set</option>{value && !current && <option value={value} disabled>{legacyLabel || value}</option>}{ordered.map((item) => <option key={item.catalog_item_id} value={item.catalog_item_id}>{resolveProjectCatalogLabel(item, locale)}</option>)}</select>{loading && <p role="status" className="mt-1 text-xs text-slate-500">Loading {label.toLowerCase()}…</p>}{error && <p role="alert" className="mt-1 text-xs text-red-700">Could not load choices. <button type="button" onClick={() => void refetch()} className="underline">Retry</button></p>}{!loading && !error && !ordered.length && <p className="mt-1 text-xs text-slate-500">No values configured. {projectId && <Link href={`/projects/${projectId}?tab=settings`} className="text-blue-600 underline">Open Project settings</Link>}</p>}{!value && legacyLabel && <p className="mt-1 text-xs text-slate-500">Current legacy value: {legacyLabel}</p>}</div>;
}
