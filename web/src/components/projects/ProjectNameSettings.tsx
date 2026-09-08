'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useMutation } from '@apollo/client';
import { GET_PROJECT_BY_ID, GET_USER_PROJECTS, UPDATE_PROJECT_NAME } from '@/graphql/queries/project';

interface Props {
  projectId: string;
  initialName: string;
  canManage: boolean;
  onRenamed: () => void | Promise<void>;
}

export function ProjectNameSettings({ projectId, initialName, canManage, onRenamed }: Props) {
  const [name, setName] = useState(initialName);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [updateProject, { loading }] = useMutation(UPDATE_PROJECT_NAME);

  useEffect(() => setName(initialName), [projectId, initialName]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName || loading) return;
    setMessage(null);
    try {
      const result = await updateProject({
        variables: { projectId, name: nextName },
        refetchQueries: [
          { query: GET_PROJECT_BY_ID, variables: { projectId } },
          { query: GET_USER_PROJECTS },
        ],
        awaitRefetchQueries: true,
      });
      const savedName = result.data?.update_project;
      if (!savedName) throw new Error('Project name was not updated.');
      setName(savedName);
      await onRenamed();
      setMessage({ error: false, text: 'Project name saved' });
    } catch (error) {
      setMessage({ error: true, text: `Save failed: ${(error as Error).message}` });
    }
  };

  return (
    <section className="border rounded-lg p-4 bg-white mb-6">
      <h3 className="text-sm font-semibold mb-2">Project name</h3>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium text-slate-600">
          Name
          <input
            className="block mt-1 px-3 py-2 border rounded text-sm"
            aria-label="Project name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={!canManage || loading}
            required
          />
        </label>
        {canManage && (
          <button
            type="submit"
            className="px-3 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
            disabled={loading || !name.trim() || name.trim() === initialName}
          >
            {loading ? 'Saving…' : 'Save name'}
          </button>
        )}
      </form>
      {message && (
        <p role={message.error ? 'alert' : 'status'} className={`mt-2 text-sm ${message.error ? 'text-red-700' : 'text-green-700'}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
