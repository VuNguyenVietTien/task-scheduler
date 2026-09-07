import React from 'react';
import { act, render, screen } from '@testing-library/react';
import i18n from '@/i18n/i18n-config';
import { ProjectCatalogSelect } from '../ProjectCatalogSettingsPanel';

jest.mock('@/hooks/useProjectCatalogs', () => ({
  useProjectCatalogs: () => ({
    items: [{
      catalog_item_id: 'stable-id',
      project_id: 'project-1',
      kind: 'PROGRESS_TYPE',
      display_order: 0,
      labels: [
        { locale: 'en', name: 'Create' },
        { locale: 'ja', name: '作成' },
        { locale: 'vi', name: 'Tạo' },
      ],
    }],
    loading: false,
    error: undefined,
    refetch: jest.fn(),
  }),
}));

afterAll(async () => {
  await i18n.changeLanguage('en');
});

test('existing i18n language changes rerender selector labels without changing selection ID', async () => {
  await act(async () => { await i18n.changeLanguage('en'); });
  render(<ProjectCatalogSelect projectId="project-1" kind="PROGRESS_TYPE" label="Progress type" value="stable-id" onChange={jest.fn()} />);
  const select = screen.getByRole('combobox', { name: 'Progress type' });
  expect(screen.getByRole('option', { name: 'Create' })).toBeInTheDocument();

  await act(async () => { await i18n.changeLanguage('ja'); });
  expect(screen.getByRole('option', { name: '作成' })).toBeInTheDocument();
  expect(select).toHaveValue('stable-id');

  await act(async () => { await i18n.changeLanguage('vi'); });
  expect(screen.getByRole('option', { name: 'Tạo' })).toBeInTheDocument();
  expect(select).toHaveValue('stable-id');
});
