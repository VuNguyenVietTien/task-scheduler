'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  CREATE_PROJECT_CATALOG_ITEMS,
  REORDER_PROJECT_CATALOG_ITEMS,
  UPDATE_PROJECT_CATALOG_ITEM,
} from '@/graphql/mutations/catalogs';
import { useProjectCatalogs } from '@/hooks/useProjectCatalogs';
import type { ProjectCatalogItem, ProjectCatalogKind, ProjectCatalogLabel } from '@/types/project-catalog';
import { parseProjectCatalogPaste, resolveProjectCatalogLabel } from '@/utils/project-catalog';

const KINDS: Array<{ kind: ProjectCatalogKind; title: string }> = [
  { kind: 'PROGRESS_TYPE', title: 'Progress types' },
  { kind: 'CATEGORY', title: 'Categories' },
  { kind: 'TASK_TYPE', title: 'Task types' },
];

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/conflict/i.test(message)) return 'This catalog changed. Reload it and try again.';
  if (/forbidden/i.test(message)) return 'You do not have permission to change this catalog.';
  return 'The catalog could not be saved. Please try again.';
}

async function refreshAfterSave(refetch: () => Promise<unknown>, setNotice: (value: string) => void) {
  try {
    await refetch();
    setNotice('Saved.');
  } catch {
    setNotice('Saved, but the latest list could not be loaded. Retry the refresh.');
  }
}

function CatalogItemEditor({
  item,
  index,
  count,
  locale,
  canManage,
  busy,
  onSave,
  onMove,
}: {
  item: ProjectCatalogItem;
  index: number;
  count: number;
  locale: string;
  canManage: boolean;
  busy: boolean;
  onSave: (item: ProjectCatalogItem, labels: ProjectCatalogLabel[]) => Promise<void>;
  onMove: (index: number, direction: -1 | 1) => Promise<void>;
}) {
  const [labels, setLabels] = useState(item.labels);
  useEffect(() => setLabels(item.labels), [item]);

  const updateLabel = (labelIndex: number, field: keyof ProjectCatalogLabel, value: string) => {
    setLabels((current) => current.map((label, i) => i === labelIndex ? { ...label, [field]: value } : label));
  };

  return (
    <li className="rounded border border-slate-200 bg-white p-3" data-testid={`catalog-item-${item.catalog_item_id}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <strong className="text-sm text-slate-800">{resolveProjectCatalogLabel(item, locale)}</strong>
        {canManage && (
          <div className="flex gap-1">
            <button type="button" aria-label="Move up" disabled={busy || index === 0} onClick={() => void onMove(index, -1)} className="rounded border px-2 py-1 disabled:opacity-40">↑</button>
            <button type="button" aria-label="Move down" disabled={busy || index === count - 1} onClick={() => void onMove(index, 1)} className="rounded border px-2 py-1 disabled:opacity-40">↓</button>
          </div>
        )}
      </div>
      <div className="space-y-2">
        {labels.map((label, labelIndex) => (
          <div key={`${item.catalog_item_id}-${labelIndex}`} className="grid grid-cols-[8rem_1fr] gap-2">
            <input aria-label="Label locale" value={label.locale} disabled={!canManage || busy} onChange={(event) => updateLabel(labelIndex, 'locale', event.target.value)} className="rounded border px-2 py-1 text-sm disabled:bg-slate-50" />
            <input aria-label="Label name" value={label.name} disabled={!canManage || busy} onChange={(event) => updateLabel(labelIndex, 'name', event.target.value)} className="rounded border px-2 py-1 text-sm disabled:bg-slate-50" />
          </div>
        ))}
      </div>
      {canManage && (
        <div className="mt-2 flex gap-2">
          <button type="button" disabled={busy || labels.length >= 20} onClick={() => setLabels((current) => [...current, { locale, name: '' }])} className="rounded border px-2 py-1 text-sm disabled:opacity-40">Add language</button>
          <button type="button" disabled={busy} onClick={() => void onSave(item, labels)} className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-40">Save labels</button>
        </div>
      )}
    </li>
  );
}

function CatalogKindPanel({ projectId, kind, title, locale, canManage }: { projectId: string; kind: ProjectCatalogKind; title: string; locale: string; canManage: boolean }) {
  const { items, loading, error, refetch } = useProjectCatalogs(projectId, kind);
  const orderedItems = useMemo(() => [...items].sort((a, b) => a.display_order - b.display_order || a.catalog_item_id.localeCompare(b.catalog_item_id)), [items]);
  const [paste, setPaste] = useState('');
  const [pasteLocale, setPasteLocale] = useState(locale);
  const [preview, setPreview] = useState<Array<{ key: number; name: string }>>([]);
  const [nextKey, setNextKey] = useState(0);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [createItems] = useMutation(CREATE_PROJECT_CATALOG_ITEMS);
  const [updateItem] = useMutation(UPDATE_PROJECT_CATALOG_ITEM);
  const [reorderItems] = useMutation(REORDER_PROJECT_CATALOG_ITEMS);

  useEffect(() => {
    setPaste('');
    setPreview([]);
    setNotice('');
    setPasteLocale(locale);
  }, [projectId, kind, locale]);

  const buildPreview = () => {
    const names = parseProjectCatalogPaste(paste);
    setPreview(names.map((name, index) => ({ key: nextKey + index, name })));
    setNextKey((value) => value + names.length);
    setNotice(names.length ? '' : 'Enter at least one non-empty value.');
  };

  const addPreview = async () => {
    const localeValue = pasteLocale.normalize('NFC').trim();
    const names = preview.map((entry) => entry.name.normalize('NFC').trim());
    if (!localeValue || names.some((name) => !name) || new Set(names).size !== names.length) {
      setNotice('Locale and values are required, and preview values must be unique.');
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      await createItems({ variables: { input: { project_id: projectId, kind, items: names.map((name) => ({ labels: [{ locale: localeValue, name }] })) } } });
      setPaste('');
      setPreview([]);
      await refreshAfterSave(refetch, setNotice);
    } catch (saveError) {
      setNotice(friendlyError(saveError));
    } finally {
      setBusy(false);
    }
  };

  const saveLabels = async (item: ProjectCatalogItem, labels: ProjectCatalogLabel[]) => {
    const normalized = labels.map((label) => ({ locale: label.locale.normalize('NFC').trim(), name: label.name.normalize('NFC').trim() }));
    if (normalized.some((label) => !label.locale || !label.name) || new Set(normalized.map((label) => label.locale)).size !== normalized.length) {
      setNotice('Every language needs one unique locale and a non-empty name.');
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      await updateItem({ variables: { input: { catalog_item_id: item.catalog_item_id, labels: normalized } } });
      await refreshAfterSave(refetch, setNotice);
    } catch (saveError) {
      setNotice(friendlyError(saveError));
    } finally {
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
      {!!orderedItems.length && <ol className="mt-3 space-y-2">{orderedItems.map((item, index) => <CatalogItemEditor key={item.catalog_item_id} item={item} index={index} count={orderedItems.length} locale={locale} canManage={canManage} busy={busy} onSave={saveLabels} onMove={move} />)}</ol>}

      {canManage && (
        <div className="mt-4 border-t border-slate-200 pt-3">
          <div className="grid gap-2 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
            <label className="text-sm font-medium text-slate-700">Locale<input aria-label={`${title} paste locale`} value={pasteLocale} onChange={(event) => setPasteLocale(event.target.value)} className="mt-1 w-full rounded border px-2 py-1" /></label>
            <label className="text-sm font-medium text-slate-700">Paste values<textarea aria-label={`${title} paste values`} value={paste} onChange={(event) => setPaste(event.target.value)} rows={3} placeholder="One, two or one per line" className="mt-1 w-full rounded border px-2 py-1" /></label>
            <button type="button" onClick={buildPreview} disabled={busy} className="rounded border bg-white px-3 py-2 text-sm disabled:opacity-40">Preview</button>
          </div>
          {!!preview.length && (
            <div className="mt-3" aria-label={`${title} preview`}>
              <p className="text-sm font-medium text-slate-700">Review before adding</p>
              <ul className="mt-2 space-y-2">{preview.map((entry) => <li key={entry.key} className="flex gap-2"><input aria-label="Preview value" value={entry.name} onChange={(event) => setPreview((current) => current.map((candidate) => candidate.key === entry.key ? { ...candidate, name: event.target.value } : candidate))} className="flex-1 rounded border px-2 py-1" /><button type="button" aria-label={`Remove ${entry.name}`} onClick={() => setPreview((current) => current.filter((candidate) => candidate.key !== entry.key))} className="rounded border px-2 py-1">Remove</button></li>)}</ul>
              <button type="button" disabled={busy} onClick={() => void addPreview()} className="mt-2 rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-40">Add {preview.length} values</button>
            </div>
          )}
        </div>
      )}
      {notice && <p role="status" className={`mt-2 text-sm ${notice.startsWith('Saved') ? 'text-green-700' : 'text-red-700'}`}>{notice}</p>}
    </section>
  );
}

export function ProjectCatalogSettingsPanel({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  return <div className="space-y-4"><div><h1 className="text-xl font-semibold text-slate-900">Project settings</h1><p className="text-sm text-slate-600">Configure task labels for this project. IDs remain stable when labels or order change.</p>{!canManage && <p className="mt-1 text-sm text-slate-600">You have read-only access.</p>}</div>{KINDS.map(({ kind, title }) => <CatalogKindPanel key={`${projectId}-${kind}`} projectId={projectId} kind={kind} title={title} locale={locale} canManage={canManage} />)}</div>;
}

export function ProjectCatalogSelect({ projectId, kind, value, legacyLabel, onChange, disabled, label }: { projectId: string | undefined; kind: ProjectCatalogKind; value?: string | null; legacyLabel?: string | null; onChange: (value: string | null) => void; disabled?: boolean; label: string }) {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const { items, loading, error, refetch } = useProjectCatalogs(projectId, kind);
  const ordered = useMemo(() => [...items].sort((a, b) => a.display_order - b.display_order || a.catalog_item_id.localeCompare(b.catalog_item_id)), [items]);
  const current = value ? ordered.find((item) => item.catalog_item_id === value) : undefined;

  return <div><select aria-label={label} value={value ?? ''} disabled={disabled || loading || Boolean(error)} onChange={(event) => onChange(event.target.value || null)} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50"><option value="">Not set</option>{value && !current && <option value={value} disabled>{legacyLabel || value}</option>}{ordered.map((item) => <option key={item.catalog_item_id} value={item.catalog_item_id}>{resolveProjectCatalogLabel(item, locale)}</option>)}</select>{loading && <p role="status" className="mt-1 text-xs text-slate-500">Loading {label.toLowerCase()}…</p>}{error && <p role="alert" className="mt-1 text-xs text-red-700">Could not load choices. <button type="button" onClick={() => void refetch()} className="underline">Retry</button></p>}{!loading && !error && !ordered.length && <p className="mt-1 text-xs text-slate-500">No values configured. {projectId && <Link href={`/projects/${projectId}?tab=settings`} className="text-blue-600 underline">Open Project settings</Link>}</p>}{!value && legacyLabel && <p className="mt-1 text-xs text-slate-500">Current legacy value: {legacyLabel}</p>}</div>;
}
