import type { ProjectCatalogItem } from '@/types/project-catalog';

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
    .split(/[,\r\n]+/)
    .map((entry) => entry.normalize('NFC').trim())
    .filter((entry) => entry.length > 0 && !seen.has(entry) && Boolean(seen.add(entry)));
}
