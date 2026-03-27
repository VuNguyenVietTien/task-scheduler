'use client';
import { useState } from 'react';
import { useLazyQuery, gql } from '@apollo/client';

const FIELD_IMPACT = gql`
  query FieldImpact($dbTable: String!, $dbColumn: String!, $systemId: UUID) {
    fieldImpact(dbTable: $dbTable, dbColumn: $dbColumn, systemId: $systemId) {
      componentId
      componentCustomId
      componentName
      screenId
      screenName
      documentId
      documentName
      dbTable
      dbColumn
    }
  }
`;

const COMPONENT_DEPS = gql`
  query ComponentDependencies($componentId: UUID!) {
    componentDependencies(componentId: $componentId) {
      componentId
      componentCustomId
      componentName
      screenId
      screenName
      documentId
      documentName
      dbTable
      dbColumn
    }
  }
`;

interface ImpactRow {
  componentId: string;
  componentCustomId: string;
  componentName: string;
  screenId: string;
  screenName: string;
  documentId: string;
  documentName: string;
  dbTable: string;
  dbColumn: string;
}

interface Props {
  systemId?: string;
  componentId?: string;
  fieldMappings?: { dbTable: string; dbColumn: string }[];
}

export default function FieldImpactPanel({ systemId, componentId, fieldMappings }: Props) {
  const [activeTab, setActiveTab] = useState<'field' | 'deps'>('field');

  const [fetchFieldImpact, { data: fieldData, loading: fieldLoading }] =
    useLazyQuery<{ fieldImpact: ImpactRow[] }>(FIELD_IMPACT);

  const [fetchDeps, { data: depsData, loading: depsLoading }] =
    useLazyQuery<{ componentDependencies: ImpactRow[] }>(COMPONENT_DEPS);

  const handleFieldSearch = (dbTable: string, dbColumn: string) => {
    fetchFieldImpact({ variables: { dbTable, dbColumn, systemId } });
    setActiveTab('field');
  };

  const handleDepsSearch = () => {
    if (componentId) {
      fetchDeps({ variables: { componentId } });
    }
    setActiveTab('deps');
  };

  const results = activeTab === 'field'
    ? fieldData?.fieldImpact
    : depsData?.componentDependencies;

  const loading = activeTab === 'field' ? fieldLoading : depsLoading;

  return (
    <div className="border rounded p-3">
      <h3 className="font-semibold text-sm mb-2">Impact Analysis</h3>

      {/* Search triggers */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {fieldMappings?.map((fm, i) => (
          <button
            key={i}
            onClick={() => handleFieldSearch(fm.dbTable, fm.dbColumn)}
            className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
          >
            {fm.dbTable}.{fm.dbColumn}
          </button>
        ))}
        {componentId && (
          <button
            onClick={handleDepsSearch}
            className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded hover:bg-purple-100 transition-colors"
          >
            All Dependencies
          </button>
        )}
      </div>

      {/* Results */}
      {loading && <p className="text-xs text-gray-500">Searching...</p>}
      {results && (
        <div className="space-y-1 max-h-48 overflow-auto">
          {results.length === 0 ? (
            <p className="text-xs text-gray-400">No impacts found</p>
          ) : (
            results.map((r, i) => (
              <div
                key={i}
                className="text-xs p-2 bg-gray-50 rounded flex justify-between gap-2"
              >
                <span className="truncate">
                  {r.documentName} → {r.screenName} →{' '}
                  <strong>{r.componentCustomId}</strong> {r.componentName}
                </span>
                <span className="text-gray-400 font-mono shrink-0">
                  {r.dbTable}.{r.dbColumn}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
