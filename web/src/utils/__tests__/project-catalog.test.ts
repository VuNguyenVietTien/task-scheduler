import {
  parseProjectCatalogPaste,
  parseProjectCatalogTranslationPaste,
  resolveProjectCatalogLabel,
} from '../project-catalog';
import type { ProjectCatalogItem } from '@/types/project-catalog';

test('paste parser handles comma, tabs, LF and CRLF while normalizing and deduplicating', () => {
  expect(parseProjectCatalogPaste(' Café, Cafe\u0301\r\n, Beta\tBeta ')).toEqual(['Café', 'Beta']);
});

test('translation paste aligns equal columns and preserves interior blanks', () => {
  expect(parseProjectCatalogTranslationPaste({
    en: 'Create, Review\r\nRelease',
    ja: '作成,,リリース',
    vi: '',
  })).toEqual({ rows: [
    { en: 'Create', ja: '作成', vi: '' },
    { en: 'Review', ja: '', vi: '' },
    { en: 'Release', ja: 'リリース', vi: '' },
  ] });
});

test('translation paste preserves missing first and last translations without shifting item identity', () => {
  expect(parseProjectCatalogTranslationPaste({ en: 'Alpha,Beta,', ja: ',二,三', vi: '' })).toEqual({ rows: [
    { en: 'Alpha', ja: '', vi: '' },
    { en: 'Beta', ja: '二', vi: '' },
    { en: '', ja: '三', vi: '' },
  ] });
});

test('translation paste rejects mismatched non-empty counts and empty input', () => {
  expect(parseProjectCatalogTranslationPaste({ en: 'One,Two', ja: '一', vi: '' })).toEqual({
    rows: [], error: 'Each non-empty language list must contain the same number of values.',
  });
  expect(parseProjectCatalogTranslationPaste({ en: ' \r\n ', ja: '', vi: '\t' })).toEqual({
    rows: [], error: 'Enter at least one non-empty value.',
  });
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
