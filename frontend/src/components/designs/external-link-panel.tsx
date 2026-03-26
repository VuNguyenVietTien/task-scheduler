'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';

const GET_ENTITY_LINKS = gql`
  query GetExternalLinks($entityType: String!, $entityId: UUID!) {
    externalLinks(entityType: $entityType, entityId: $entityId) {
      id provider externalId externalUrl syncStatus lastSyncedAt
    }
  }
`;

const LINK_EXTERNAL = gql`
  mutation LinkExternal($input: LinkExternalInput!) {
    linkExternal(input: $input) { id provider externalId externalUrl }
  }
`;

const UNLINK_EXTERNAL = gql`
  mutation UnlinkExternal($id: UUID!) {
    unlinkExternal(id: $id)
  }
`;

interface Props {
  entityType: string;
  entityId: string;
}

const PROVIDER_ICONS: Record<string, string> = {
  jira: '🎯',
  trello: '📋',
  github: '🔗',
};

export default function ExternalLinkPanel({ entityType, entityId }: Props) {
  const { data, loading, refetch } = useQuery(GET_ENTITY_LINKS, {
    variables: { entityType, entityId },
  });
  const [linkExternal] = useMutation(LINK_EXTERNAL);
  const [unlinkExternal] = useMutation(UNLINK_EXTERNAL);

  const [showForm, setShowForm] = useState(false);
  const [provider, setProvider] = useState('jira');
  const [externalId, setExternalId] = useState('');
  const [externalUrl, setExternalUrl] = useState('');

  const handleLink = async () => {
    if (!externalId.trim()) return;
    await linkExternal({
      variables: {
        input: {
          entityType,
          entityId,
          provider,
          externalId,
          externalUrl: externalUrl || null,
        },
      },
    });
    setExternalId('');
    setExternalUrl('');
    setShowForm(false);
    refetch();
  };

  const handleUnlink = async (id: string) => {
    await unlinkExternal({ variables: { id } });
    refetch();
  };

  return (
    <div className="border rounded p-3">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-sm">External Links</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded"
        >
          + Link
        </button>
      </div>

      {showForm && (
        <div className="mb-3 p-2 bg-gray-50 rounded space-y-2">
          <div className="flex gap-2">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="px-2 py-1 border rounded text-sm"
            >
              <option value="jira">Jira</option>
              <option value="trello">Trello</option>
              <option value="github">GitHub</option>
            </select>
            <input
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              placeholder="Issue key (e.g. PROJ-123)"
              className="flex-1 px-2 py-1 border rounded text-sm"
            />
          </div>
          <input
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="URL (optional)"
            className="w-full px-2 py-1 border rounded text-sm"
          />
          <div className="flex gap-1">
            <button
              onClick={handleLink}
              className="text-xs px-2 py-1 bg-green-600 text-white rounded"
            >
              Link
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-xs px-2 py-1 border rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && <p className="text-xs text-gray-500">Loading...</p>}

      <div className="space-y-1">
        {data?.externalLinks?.map((link: any) => (
          <div
            key={link.id}
            className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs"
          >
            <div className="flex items-center gap-2">
              <span>{PROVIDER_ICONS[link.provider] ?? '🔗'}</span>
              {link.externalUrl ? (
                <a
                  href={link.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {link.externalId}
                </a>
              ) : (
                <span>{link.externalId}</span>
              )}
              <span className="text-gray-400">{link.syncStatus}</span>
            </div>
            <button
              onClick={() => handleUnlink(link.id)}
              className="text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        ))}
        {(!data?.externalLinks || data.externalLinks.length === 0) && !loading && (
          <p className="text-xs text-gray-400">No links yet</p>
        )}
      </div>
    </div>
  );
}
