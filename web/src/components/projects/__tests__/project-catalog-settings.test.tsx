import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ProjectCatalogSelect, ProjectCatalogSettingsPanel } from '../ProjectCatalogSettingsPanel';
import type { ProjectCatalogItem, ProjectCatalogKind, ProjectCatalogLabel } from '@/types/project-catalog';

const mockMutate = jest.fn();
const mockRefetch = jest.fn();
let mockError: Error | undefined;
let mockItems: Record<ProjectCatalogKind, ProjectCatalogItem[]>;

jest.mock('@apollo/client', () => ({
  ...jest.requireActual('@apollo/client'),
  useMutation: () => [mockMutate],
}));
jest.mock('@/hooks/useProjectCatalogs', () => ({
  useProjectCatalogs: (_projectId: string, kind: ProjectCatalogKind) => ({
    items: mockItems[kind], loading: false, error: mockError, refetch: mockRefetch,
  }),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en', resolvedLanguage: 'en' } }) }));

const item = (id: string, kind: ProjectCatalogKind, order: number, labels: ProjectCatalogLabel[]): ProjectCatalogItem => ({
  catalog_item_id: id, project_id: 'project-1', kind, display_order: order, labels,
});

beforeEach(() => {
  mockMutate.mockReset().mockResolvedValue({ data: {} });
  mockRefetch.mockReset().mockResolvedValue({ data: {} });
  mockError = undefined;
  mockItems = {
    PROGRESS_TYPE: [
      item('progress-a', 'PROGRESS_TYPE', 0, [{ locale: 'en', name: 'Create' }, { locale: 'fr', name: 'Créer' }]),
      item('progress-b', 'PROGRESS_TYPE', 1, [{ locale: 'en', name: 'Review' }]),
    ],
    CATEGORY: [],
    TASK_TYPE: [],
  };
});

test('shows exactly three fixed language fields for every editable item', () => {
  render(<ProjectCatalogSettingsPanel projectId="project-1" canManage />);
  const row = screen.getByTestId('catalog-item-progress-a');
  expect(within(row).getByLabelText('English (en)')).toHaveValue('Create');
  expect(within(row).getByLabelText('Japanese (ja)')).toHaveValue('');
  expect(within(row).getByLabelText('Vietnamese (vi)')).toHaveValue('');
  expect(within(row).queryByRole('button', { name: 'Add language' })).not.toBeInTheDocument();
  expect(within(row).queryByLabelText('Label locale')).not.toBeInTheDocument();
});

test('rejects mismatched paste counts, then previews aligned translations and submits missing values safely', async () => {
  render(<ProjectCatalogSettingsPanel projectId="project-1" canManage />);
  fireEvent.change(screen.getByLabelText('Categories English (en) paste values'), { target: { value: ' Alpha, Cafe\u0301\r\n' } });
  fireEvent.change(screen.getByLabelText('Categories Japanese (ja) paste values'), { target: { value: 'アルファ' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Preview' })[1]);
  expect(screen.getByText('Each non-empty language list must contain the same number of values.')).toBeInTheDocument();
  expect(screen.queryByLabelText('Categories preview')).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Categories Japanese (ja) paste values'), { target: { value: 'アルファ\tカフェ' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Preview' })[1]);
  const preview = screen.getByLabelText('Categories preview');
  expect(within(preview).getByLabelText('Categories preview row 1 English (en)')).toHaveValue('Alpha');
  expect(within(preview).getByLabelText('Categories preview row 2 English (en)')).toHaveValue('Café');
  expect(within(preview).getByLabelText('Categories preview row 2 Japanese (ja)')).toHaveValue('カフェ');
  expect(within(preview).getByLabelText('Categories preview row 2 Vietnamese (vi)')).toHaveValue('');
  fireEvent.change(within(preview).getByLabelText('Categories preview row 2 Japanese (ja)'), { target: { value: '' } });
  fireEvent.click(within(preview).getByRole('button', { name: 'Add 2 values' }));

  await waitFor(() => expect(mockMutate).toHaveBeenCalledWith({ variables: { input: {
    project_id: 'project-1', kind: 'CATEGORY', items: [
      { labels: [{ locale: 'en', name: 'Alpha' }, { locale: 'ja', name: 'アルファ' }] },
      { labels: [{ locale: 'en', name: 'Café' }] },
    ],
  } } }));
});

test('rejects an all-blank preview row and duplicate same-language values', () => {
  render(<ProjectCatalogSettingsPanel projectId="project-1" canManage />);
  fireEvent.change(screen.getByLabelText('Task types English (en) paste values'), { target: { value: 'One, Two' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Preview' })[2]);
  const preview = screen.getByLabelText('Task types preview');
  fireEvent.change(within(preview).getByLabelText('Task types preview row 2 English (en)'), { target: { value: '' } });
  fireEvent.click(within(preview).getByRole('button', { name: 'Add 2 values' }));
  expect(screen.getByText('Each item needs at least one non-empty translation.')).toBeInTheDocument();
  expect(mockMutate).not.toHaveBeenCalled();

  fireEvent.change(within(preview).getByLabelText('Task types preview row 2 English (en)'), { target: { value: 'One' } });
  fireEvent.click(within(preview).getByRole('button', { name: 'Add 2 values' }));
  expect(screen.getByText('Duplicate values in the same language are not allowed.')).toBeInTheDocument();
  expect(mockMutate).not.toHaveBeenCalled();
});

test('replaces supported labels under the stable item ID and preserves extra locales', async () => {
  render(<ProjectCatalogSettingsPanel projectId="project-1" canManage />);
  const row = screen.getByTestId('catalog-item-progress-a');
  fireEvent.change(within(row).getByLabelText('English (en)'), { target: { value: 'Create work' } });
  fireEvent.change(within(row).getByLabelText('Japanese (ja)'), { target: { value: '作成' } });
  fireEvent.change(within(row).getByLabelText('Vietnamese (vi)'), { target: { value: 'Tạo' } });
  fireEvent.click(within(row).getByRole('button', { name: 'Save labels' }));

  await waitFor(() => expect(mockMutate).toHaveBeenCalledWith({ variables: { input: {
    catalog_item_id: 'progress-a',
    labels: [
      { locale: 'en', name: 'Create work' },
      { locale: 'ja', name: '作成' },
      { locale: 'vi', name: 'Tạo' },
      { locale: 'fr', name: 'Créer' },
    ],
  } } }));
});

test('failed save keeps edits and reports failure truthfully', async () => {
  mockMutate.mockRejectedValueOnce(new Error('network'));
  render(<ProjectCatalogSettingsPanel projectId="project-1" canManage />);
  const row = screen.getByTestId('catalog-item-progress-a');
  fireEvent.change(within(row).getByLabelText('Japanese (ja)'), { target: { value: '作成' } });
  fireEvent.click(within(row).getByRole('button', { name: 'Save labels' }));
  expect(await screen.findByText('The catalog could not be saved. Please try again.')).toBeInTheDocument();
  expect(within(row).getByLabelText('Japanese (ja)')).toHaveValue('作成');
});

test('successful mutation with failed refetch remains a saved result', async () => {
  mockRefetch.mockRejectedValueOnce(new Error('offline'));
  render(<ProjectCatalogSettingsPanel projectId="project-1" canManage />);
  fireEvent.click(within(screen.getByTestId('catalog-item-progress-a')).getByRole('button', { name: 'Save labels' }));
  expect(await screen.findByText('Saved, but the latest list could not be loaded. Retry the refresh.')).toBeInTheDocument();
});

test('reorders with complete current and expected ID vectors', async () => {
  render(<ProjectCatalogSettingsPanel projectId="project-1" canManage />);
  fireEvent.click(within(screen.getByTestId('catalog-item-progress-a')).getByRole('button', { name: 'Move down' }));
  await waitFor(() => expect(mockMutate).toHaveBeenCalledWith({ variables: { input: {
    project_id: 'project-1', kind: 'PROGRESS_TYPE', ordered_catalog_item_ids: ['progress-b', 'progress-a'], expected_catalog_item_ids: ['progress-a', 'progress-b'],
  } } }));
});

test('read-only viewers see fixed values but no catalog write controls', () => {
  render(<ProjectCatalogSettingsPanel projectId="project-1" canManage={false} />);
  expect(screen.getByText('Create')).toBeInTheDocument();
  expect(screen.getByText('You have read-only access.')).toBeInTheDocument();
  expect(screen.getByTestId('catalog-item-progress-a')).toHaveTextContent('English (en)');
  expect(screen.queryByText('Paste values')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save labels' })).not.toBeInTheDocument();
});

test('shows catalog read failure separately and retries', () => {
  mockError = new Error('offline');
  render(<ProjectCatalogSettingsPanel projectId="project-1" canManage={false} />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Retry' })[0]);
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});

test('task catalog selector emits stable UUID set and explicit null clear', () => {
  const onChange = jest.fn();
  const { rerender } = render(<ProjectCatalogSelect projectId="project-1" kind="PROGRESS_TYPE" label="Progress type" value={null} legacyLabel="study" onChange={onChange} />);
  const select = screen.getByRole('combobox', { name: 'Progress type' });
  expect(screen.getByText('Current legacy value: study')).toBeInTheDocument();
  fireEvent.change(select, { target: { value: 'progress-a' } });
  fireEvent.change(select, { target: { value: '' } });
  expect(onChange.mock.calls).toEqual([['progress-a'], [null]]);
  rerender(<ProjectCatalogSelect projectId="project-1" kind="PROGRESS_TYPE" label="Progress type" value="progress-a" onChange={onChange} />);
  expect(screen.getByRole('combobox', { name: 'Progress type' })).toHaveValue('progress-a');
});

test('project switch clears an unsaved preview', () => {
  const { rerender } = render(<ProjectCatalogSettingsPanel projectId="project-1" canManage />);
  fireEvent.change(screen.getByLabelText('Categories English (en) paste values'), { target: { value: 'Draft' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Preview' })[1]);
  expect(within(screen.getByLabelText('Categories preview')).getByDisplayValue('Draft')).toBeInTheDocument();
  rerender(<ProjectCatalogSettingsPanel projectId="project-2" canManage />);
  expect(screen.queryByLabelText('Categories preview')).not.toBeInTheDocument();
});
