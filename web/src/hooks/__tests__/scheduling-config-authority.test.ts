import { renderHook } from '@testing-library/react';
import { useProjectSchedulingConfig } from '../useProjectSchedulingConfig';
const mockUseQuery = jest.fn();
jest.mock('@apollo/client', () => ({ ...jest.requireActual('@apollo/client'), useQuery: (...args: unknown[]) => mockUseQuery(...args) }));
const complete = [
  { data: { capacity_settings: [], day_offs: [] }, loading: false },
  { data: { resource_groups: [] }, loading: false },
  { data: { recurring_commitments: [] }, loading: false },
  { data: { resource_members: [] }, loading: false },
];
test.each(['loading', 'error', 'missing'])('R10 %s queries cannot masquerade as confirmed empty config', state => {
  let index = 0;
  mockUseQuery.mockImplementation(() => index++ % 4 === 0 ? state === 'loading' ? { loading: true } : state === 'error' ? { loading: false, error: new Error('failed') } : { loading: false, data: {} } : complete[(index - 1) % 4]);
  const { result } = renderHook(() => useProjectSchedulingConfig('p'));
  expect(Boolean(result.current.loading || result.current.error)).toBe(true);
});
test('R10 confirmed empty query results legitimately use weekday defaults', () => {
  let index = 0; mockUseQuery.mockImplementation(() => complete[index++ % 4]);
  const { result } = renderHook(() => useProjectSchedulingConfig('p'));
  expect(result.current.loading).toBe(false); expect(result.current.error).toBeFalsy();
  expect(result.current.capacityFor('rm')(new Date(2026, 8, 7))).toBe(8);
});
