'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useParams } from 'next/navigation';
import { GET_DOCUMENT } from '@/graphql/queries/designs';
import { CREATE_SCREEN } from '@/graphql/mutations/designs';
import Link from 'next/link';

export default function DocumentDetailPage() {
  const params = useParams<{
    systemId: string;
    moduleId: string;
    documentId: string;
  }>();
  const systemId = params?.systemId ?? '';
  const moduleId = params?.moduleId ?? '';
  const documentId = params?.documentId ?? '';
  const { data, loading, refetch } = useQuery(GET_DOCUMENT, { variables: { id: documentId } });
  const [createScreen] = useMutation(CREATE_SCREEN);
  const [showScreenForm, setShowScreenForm] = useState(false);
  const [screenName, setScreenName] = useState('');
  const [breakpoint, setBreakpoint] = useState('pc');

  if (loading) return <div className="p-6">Loading...</div>;
  const doc = data?.designDocument;
  if (!doc) return <div className="p-6">Document not found</div>;

  const handleCreateScreen = async () => {
    if (!screenName.trim()) return;
    await createScreen({ variables: { input: { documentId, name: screenName, breakpoint } } });
    setScreenName('');
    setShowScreenForm(false);
    refetch();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <Link href={`/designs/${systemId}`} className="text-blue-600 hover:underline text-sm">
          &larr; Back
        </Link>
      </div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">{doc.name}</h1>
        <span
          className={`text-xs px-2 py-1 rounded ${
            doc.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {doc.status}
        </span>
      </div>

      {/* Screens section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Screens</h2>
          <button
            onClick={() => setShowScreenForm(true)}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
          >
            + Screen
          </button>
        </div>
        {showScreenForm && (
          <div className="mb-4 p-3 border rounded flex gap-2 items-center">
            <input
              value={screenName}
              onChange={e => setScreenName(e.target.value)}
              placeholder="Screen name"
              className="flex-1 px-3 py-2 border rounded"
            />
            <select
              value={breakpoint}
              onChange={e => setBreakpoint(e.target.value)}
              className="px-3 py-2 border rounded"
            >
              <option value="pc">PC</option>
              <option value="tablet">Tablet</option>
              <option value="mobile">Mobile</option>
            </select>
            <button onClick={handleCreateScreen} className="px-3 py-1 bg-green-600 text-white rounded">
              Create
            </button>
            <button onClick={() => setShowScreenForm(false)} className="px-3 py-1 border rounded">
              Cancel
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {doc.screens?.map((screen: any) => (
            <Link
              key={screen.id}
              href={`/designs/${systemId}/${moduleId}/${documentId}/screens/${screen.id}`}
              className="p-4 border rounded hover:border-blue-500 hover:shadow transition-all"
            >
              <h3 className="font-medium">{screen.name}</h3>
              <span className="text-xs text-gray-500">{screen.breakpoint.toUpperCase()}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Flows section */}
      {doc.flows?.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Business Flows</h2>
          <div className="space-y-2">
            {doc.flows.map((flow: any) => (
              <div key={flow.id} className="p-3 border rounded flex justify-between">
                <span>{flow.name}</span>
                <span className="text-xs text-gray-500">{flow.flowType}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
