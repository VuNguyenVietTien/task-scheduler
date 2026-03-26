'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useParams } from 'next/navigation';
import { GET_SYSTEM } from '@/graphql/queries/designs';
import { CREATE_MODULE, CREATE_DOCUMENT } from '@/graphql/mutations/designs';
import Link from 'next/link';

export default function SystemDetailPage() {
  const params = useParams<{ systemId: string }>();
  const systemId = params?.systemId ?? '';
  const { data, loading, refetch } = useQuery(GET_SYSTEM, { variables: { id: systemId } });
  const [createModule] = useMutation(CREATE_MODULE);
  const [createDocument] = useMutation(CREATE_DOCUMENT);
  const [newModuleName, setNewModuleName] = useState('');
  const [newDocModule, setNewDocModule] = useState<string | null>(null);
  const [newDocName, setNewDocName] = useState('');

  if (loading) return <div className="p-6">Loading...</div>;

  const system = data?.system;
  if (!system) return <div className="p-6">System not found</div>;

  const handleCreateModule = async () => {
    if (!newModuleName.trim()) return;
    await createModule({ variables: { input: { systemId, name: newModuleName } } });
    setNewModuleName('');
    refetch();
  };

  const handleCreateDoc = async () => {
    if (!newDocName.trim() || !newDocModule) return;
    await createDocument({ variables: { input: { moduleId: newDocModule, name: newDocName } } });
    setNewDocName('');
    setNewDocModule(null);
    refetch();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <Link href="/designs" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Systems
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-6">{system.name}</h1>

      {/* Module creation */}
      <div className="mb-6 flex gap-2">
        <input
          value={newModuleName}
          onChange={e => setNewModuleName(e.target.value)}
          placeholder="New module name"
          className="flex-1 px-3 py-2 border rounded"
          onKeyDown={e => e.key === 'Enter' && handleCreateModule()}
        />
        <button onClick={handleCreateModule} className="px-4 py-2 bg-blue-600 text-white rounded">
          Add Module
        </button>
      </div>

      {system.modules?.map((mod: any) => (
        <div key={mod.id} className="mb-6 border rounded p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">{mod.name}</h2>
            <button
              onClick={() => setNewDocModule(mod.id)}
              className="text-sm px-3 py-1 bg-green-600 text-white rounded"
            >
              + Document
            </button>
          </div>
          {newDocModule === mod.id && (
            <div className="mb-3 flex gap-2">
              <input
                value={newDocName}
                onChange={e => setNewDocName(e.target.value)}
                placeholder="Document name"
                className="flex-1 px-3 py-2 border rounded"
                onKeyDown={e => e.key === 'Enter' && handleCreateDoc()}
              />
              <button onClick={handleCreateDoc} className="px-3 py-1 bg-green-600 text-white rounded">
                Create
              </button>
              <button onClick={() => setNewDocModule(null)} className="px-3 py-1 border rounded">
                Cancel
              </button>
            </div>
          )}
          <div className="space-y-2">
            {mod.documents?.map((doc: any) => (
              <Link
                key={doc.id}
                href={`/designs/${systemId}/${mod.id}/${doc.id}`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100"
              >
                <span className="font-medium">{doc.name}</span>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    doc.status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : doc.status === 'review'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {doc.status}
                </span>
              </Link>
            ))}
            {(!mod.documents || mod.documents.length === 0) && (
              <p className="text-sm text-gray-400">No documents yet</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
