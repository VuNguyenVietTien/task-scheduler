'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApolloProvider, useQuery, useMutation } from '@apollo/client';
import { createDesignDocClient } from '@/apollo/design-doc-client';
import { GET_SYSTEMS } from '@/graphql/queries/designs';
import { CREATE_SYSTEM } from '@/graphql/mutations/designs';
import Link from 'next/link';

interface DesignSystem {
  id: string;
  name: string;
  description: string | null;
  modules?: { id: string; name: string }[];
}

interface DocumentsTabProps {
  projectId: string;
}

/**
 * Outer wrapper: provides a dedicated ApolloProvider for design-doc-service.
 * key={projectId} forces re-mount when switching projects.
 */
export function DocumentsTab({ projectId }: DocumentsTabProps) {
  const designClient = useMemo(() => createDesignDocClient(), []);

  return (
    <ApolloProvider client={designClient} key={projectId}>
      <DocumentsTabContent projectId={projectId} />
    </ApolloProvider>
  );
}

/** Inner component: renders system list using the design-doc Apollo client. */
function DocumentsTabContent({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useQuery(GET_SYSTEMS, {
    variables: { projectId },
    skip: !projectId,
  });

  const [createSystem, { loading: creating }] = useMutation(CREATE_SYSTEM);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim() || creating) return;
    setCreateError(null);
    try {
      await createSystem({
        variables: { input: { projectId: projectId, name, description: null } },
      });
      setName('');
      setShowForm(false);
      refetch();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t('docs.failedToCreate'));
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-red-700 dark:text-red-400">
          {t('docs.cannotConnect')}: {error.message}
        </div>
      </div>
    );
  }

  const systems = data?.systems ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-100">{t('docs.designSystems')}</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          {t('docs.newSystem')}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 border border-slate-700 rounded bg-slate-800/50 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('docs.systemNamePlaceholder')}
            className="flex-1 px-3 py-2 border border-slate-600 rounded bg-slate-900 text-slate-100 placeholder-slate-500"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm disabled:opacity-50"
          >
            {creating ? t('docs.creating') : t('docs.create')}
          </button>
          <button
            onClick={() => setShowForm(false)}
            className="px-4 py-2 border border-slate-600 rounded text-slate-300 hover:bg-slate-700 text-sm"
          >
            {t('common.cancel')}
          </button>
        </div>
      )}

      {createError && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded text-red-400 text-sm">
          {createError}
        </div>
      )}

      {systems.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <svg
            className="mx-auto h-12 w-12 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          <p>{t('docs.noDesignSystems')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {systems.map((system: DesignSystem) => (
            <Link
              key={system.id}
              href={`/designs/${system.id}`}
              className="block p-4 border border-slate-700 rounded-lg hover:border-blue-500 hover:shadow-md transition-all bg-slate-800/30"
            >
              <h3 className="font-semibold text-lg text-slate-100">{system.name}</h3>
              <p className="text-sm text-slate-400 mt-1">
                {system.description || t('docs.noDescription')}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                {t('docs.modules', { count: system.modules?.length || 0 })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
