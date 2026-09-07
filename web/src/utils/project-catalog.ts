import {
  PROJECT_CATALOG_LOCALES,
  type ProjectCatalogItem,
  type ProjectCatalogTranslationDraft,
} from '@/types/project-catalog';

export function resolveProjectCatalogLabel(item: ProjectCatalogItem, locale: string): string {
  const labels = [...item.labels].sort((a, b) => a.locale.localeCompare(b.locale) || a.name.localeCompare(b.name));
  const exact = labels.find((label) => label.locale === locale);
  if (exact) return exact.name;

  const language = locale.split('-')[0];
  const prefix = labels.find((label) => label.locale.split('-')[0] === language);
  return prefix?.name ?? labels[0]?.name ?? item.catalog_item_id;
}

export function parseProjectCatalogPaste(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/[,\t\r\n]+/)
    .map((entry) => entry.normalize('NFC').trim())
    .filter((entry) => entry.length > 0 && !seen.has(entry) && Boolean(seen.add(entry)));
}

function parseAlignedColumn(value: string): string[] {
  const entries = value
    .replace(/\r\n?/g, '\n')
    // One final line ending is a clipboard terminator; other empty cells
    // carry row positions and must not shift translations between items.
    .replace(/\n$/, '')
    .split(/[,\t\n]/)
    .map((entry) => entry.normalize('NFC').trim());
  return entries.some(Boolean) ? entries : [];
}

export function parseProjectCatalogTranslationPaste(
  values: ProjectCatalogTranslationDraft,
): { rows: ProjectCatalogTranslationDraft[]; error?: string } {
  const columns = Object.fromEntries(
    PROJECT_CATALOG_LOCALES.map((locale) => [locale, parseAlignedColumn(values[locale])]),
  ) as Record<(typeof PROJECT_CATALOG_LOCALES)[number], string[]>;
  const populatedLengths = PROJECT_CATALOG_LOCALES.map((locale) => columns[locale].length).filter(Boolean);
  if (!populatedLengths.length) return { rows: [], error: 'Enter at least one non-empty value.' };

  const count = Math.max(...populatedLengths);
  if (populatedLengths.some((length) => length !== count)) {
    return { rows: [], error: 'Each non-empty language list must contain the same number of values.' };
  }

  return {
    rows: Array.from({ length: count }, (_, index) => Object.fromEntries(
      PROJECT_CATALOG_LOCALES.map((locale) => [locale, columns[locale][index] ?? '']),
    ) as ProjectCatalogTranslationDraft),
  };
}
