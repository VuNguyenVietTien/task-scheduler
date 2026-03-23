'use client';
import { useState } from 'react';
import { useMutation, gql } from '@apollo/client';
import MermaidFlowViewer from './mermaid-flow-viewer';

const CREATE_FLOW = gql`
  mutation CreateFlow($input: CreateFlowInput!) {
    createFlow(input: $input) {
      id
      name
      mermaidDefinition
    }
  }
`;

const UPDATE_FLOW = gql`
  mutation UpdateFlow($input: UpdateFlowInput!) {
    updateFlow(input: $input) {
      id
      name
      mermaidDefinition
    }
  }
`;

const DEFAULT_MERMAID = `flowchart TD
  A[Start] --> B[Step 1]
  B --> C[End]`;

interface ExistingFlow {
  id: string;
  name: string;
  mermaidDefinition: string;
  description?: string;
}

interface Props {
  documentId: string;
  /** When provided the editor is in update mode; otherwise create mode. */
  flow?: ExistingFlow;
  onSaved: () => void;
}

/**
 * Side-by-side Mermaid source editor with live preview.
 * Supports both creating a new flow and editing an existing one.
 */
export default function FlowEditor({ documentId, flow, onSaved }: Props) {
  const [name, setName] = useState(flow?.name ?? '');
  const [mermaid, setMermaid] = useState(flow?.mermaidDefinition ?? DEFAULT_MERMAID);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createFlow] = useMutation(CREATE_FLOW);
  const [updateFlow] = useMutation(UPDATE_FLOW);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Flow name is required.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (flow) {
        await updateFlow({
          variables: {
            input: { id: flow.id, name, mermaidDefinition: mermaid },
          },
        });
      } else {
        await createFlow({
          variables: {
            input: {
              documentId,
              name,
              mermaidDefinition: mermaid,
              flowType: 'business',
            },
          },
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save flow.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border rounded p-4">
      {/* Header row */}
      <div className="flex gap-2 mb-4 items-center">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Flow name"
          className="flex-1 px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : flow ? 'Update' : 'Create'}
        </button>
      </div>

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      {/* Editor + preview */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Mermaid Source</label>
          <textarea
            value={mermaid}
            onChange={(e) => setMermaid(e.target.value)}
            rows={12}
            className="w-full p-3 border rounded font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-400"
            spellCheck={false}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Preview</label>
          <div className="border rounded min-h-[200px] bg-white overflow-auto">
            <MermaidFlowViewer mermaidDefinition={mermaid} />
          </div>
        </div>
      </div>
    </div>
  );
}
