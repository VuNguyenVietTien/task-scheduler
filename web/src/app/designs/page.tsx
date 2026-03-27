'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_SYSTEMS } from '@/graphql/queries/designs';
import { CREATE_SYSTEM } from '@/graphql/mutations/designs';
import Link from 'next/link';

export default function DesignsPage() {
  const [projectId] = useState('1'); // TODO: get from context
  const { data, loading, refetch } = useQuery(GET_SYSTEMS, { variables: { projectId } });
  const [createSystem] = useMutation(CREATE_SYSTEM);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createSystem({ variables: { input: { projectId, name, description: null } } });
    setName('');
    setShowForm(false);
    refetch();
  };

  if (loading) return <div className="p-6">Loading systems...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Design Systems</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          New System
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 border rounded bg-gray-50 flex gap-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="System name"
            className="flex-1 px-3 py-2 border rounded"
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <button onClick={handleCreate} className="px-4 py-2 bg-green-600 text-white rounded">
            Create
          </button>
          <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded">
            Cancel
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.systems?.map((system: any) => (
          <Link
            key={system.id}
            href={`/designs/${system.id}`}
            className="block p-4 border rounded hover:border-blue-500 hover:shadow-md transition-all"
          >
            <h3 className="font-semibold text-lg">{system.name}</h3>
            <p className="text-sm text-gray-500">{system.description || 'No description'}</p>
            <p className="text-xs text-gray-400 mt-2">{system.modules?.length || 0} modules</p>
          </Link>
        ))}
        {(!data?.systems || data.systems.length === 0) && (
          <p className="text-gray-500 col-span-full">No systems yet. Create one to get started.</p>
        )}
      </div>
    </div>
  );
}
