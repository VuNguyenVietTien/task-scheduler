import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ProjectCatalogSelect, ProjectCatalogSettingsPanel } from '../ProjectCatalogSettingsPanel';
import type { ProjectCatalogItem, ProjectCatalogKind } from '@/types/project-catalog';

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

const item = (id: string, kind: ProjectCatalogKind, order: number, name: string): ProjectCatalogItem => ({
  catalog_item_id: id, project_id: 'project-1', kind, display_order: order, labels: [{ locale: 'en', name }],
});

beforeEach(() => {
  mockMutate.mockReset().mockResolvedValue({ data: {} });
  mockRefetch.mockReset().mockResolvedValue({ data: {} });
  mockError = undefined;
  mockItems = {
    PROGRESS_TYPE: [item('progress-a', 'PROGRESS_TYPE', 0, 'Create'), item('progress-b', 'PROGRESS_TYPE', 1, 'Review')],
    CATEGORY: [],
    TASK_TYPE: [],
  };
});

test('renders paste preview, supports edit/remove, and sends one atomic batch', async () => {
  render(<ProjectCatalogSettingsPanel projectId="project-1" canManage />);
  fireEvent.change(screen.getByLabelText('Categories paste values'), { target: { value: ' Alpha, Beta\r\nAlpha, Gamma ' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Preview' })[1]);

  const preview = screen.getByLabelText('Categories preview');
  expect(within(preview).getAllByLabelText('Preview value')).toHaveLength(3);
  fireEvent.change(within(preview).getAllByLabelText('Preview value')[1], { target: { value: 'Beta edited' } });
  fireEvent.click(within(preview).getByRole('button', { name: 'Remove Gamma' }));
  fireEvent.click(within(preview).getByRole('button', { name: 'Add 2 values' }));

  expect(mockMutate).toHaveBeenCalledWith({ variables: { input: {
    project_id: 'project-1', kind: 'CATEGORY', items: [
      { labels: [{ locale: 'en', name: 'Alpha' }] },
      { labels: [{ locale: 'en', name: 'Beta edited' }] },
    ],
  } } });
});

test('replaces complete multilingual labels without changing the item ID', async () => {
  render(<ProjectCatalogSettingsPanel projectId="project-1" canManage />);
  const row = screen.getByTestId('catalog-item-progress-a');
  fireEvent.change(within(row).getByLabelText('Label name'), { target: { value: 'Create work' } });
  fireEvent.click(within(row).getByRole('button', { name: 'Add language' }));
  const locales = within(row).getAllByLabelText('Label locale');
  const names = within(row).getAllByLabelText('Label name');
  fireEvent.change(locales[1], { target: { value: 'vi' } });
  fireEvent.change(names[1], { target: { value: 'Tạo' } });
  fireEvent.click(within(row).getByRole('button', { name: 'Save labels' }));

  expect(mockMutate).toHaveBeenCalledWith({ variables: { input: {
    catalog_item_id: 'progress-a', labels: [{ locale: 'en', name: 'Create work' }, { locale: 'vi', name: 'Tạo' }],
  } } });
});

test('reorders with complete current and expected ID vectors', async () => {
  render(<ProjectCatalogSettingsPanel projectId="project-1" canManage />);
  fireEvent.click(within(screen.getByTestId('catalog-item-progress-a')).getByRole('button', { name: 'Move down' }));
  expect(mockMutate).toHaveBeenCalledWith({ variables: { input: {
    project_id: 'project-1', kind: 'PROGRESS_TYPE', ordered_catalog_item_ids: ['progress-b', 'progress-a'], expected_catalog_item_ids: ['progress-a', 'progress-b'],
  } } });
});

test('read-only viewers see values but no catalog write controls', () => {
  render(<ProjectCatalogSettingsPanel projectId="project-1" canManage={false} />);
  expect(screen.getByText('Create')).toBeInTheDocument();
  expect(screen.getByText('You have read-only access.')).toBeInTheDocument();
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
  fireEvent.change(screen.getByLabelText('Categories paste values'), { target: { value: 'Draft' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Preview' })[1]);
  expect(within(screen.getByLabelText('Categories preview')).getByDisplayValue('Draft')).toBeInTheDocument();
  rerender(<ProjectCatalogSettingsPanel projectId="project-2" canManage />);
  expect(screen.queryByLabelText('Categories preview')).not.toBeInTheDocument();
});
