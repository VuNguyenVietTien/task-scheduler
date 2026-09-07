import { parseProjectCatalogPaste, resolveProjectCatalogLabel } from '../project-catalog';
import type { ProjectCatalogItem } from '@/types/project-catalog';

test('paste parser normalizes, trims, drops blanks, and keeps first exact duplicate', () => {
  expect(parseProjectCatalogPaste(' Café, Cafe\u0301\r\n, Beta\nBeta ')).toEqual(['Café', 'Beta']);
});

test('label resolution uses exact locale, language prefix, sorted first label, then ID', () => {
  const base: ProjectCatalogItem = {
    catalog_item_id: 'stable-id', project_id: 'project', kind: 'CATEGORY', display_order: 0,
    labels: [{ locale: 'vi', name: 'Việt' }, { locale: 'en-GB', name: 'English' }, { locale: 'ja', name: '日本語' }],
  };
  expect(resolveProjectCatalogLabel(base, 'vi')).toBe('Việt');
  expect(resolveProjectCatalogLabel(base, 'en-US')).toBe('English');
  expect(resolveProjectCatalogLabel(base, 'fr')).toBe('English');
  expect(resolveProjectCatalogLabel({ ...base, labels: [] }, 'en')).toBe('stable-id');
});
