'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import {
  buildCloneTree,
  createCloneSelectionInput,
  defaultCloneSelection,
  getCloneCheckboxState,
  getClonePreview,
  getSelectedCloneRootIds,
  parseCloneQuantity,
  updateCloneSelection,
  type CloneTaskSelectionInput,
  type CloneTreeNode,
} from '@/utils/cloneTask';

const QUANTITY_ERROR = 'Enter a whole number greater than 0.';

export interface TaskCloneDialogProps {
  open: boolean;
  nodes: readonly CloneTreeNode[];
  sourceTaskId: string;
  loading?: boolean;
  submitting?: boolean;
  serverError?: string | null;
  loadError?: string | null;
  requiresRefresh?: boolean;
  retrying?: boolean;
  onRetry?: () => void;
  onClose: () => void;
  onSubmit: (input: CloneTaskSelectionInput) => void | Promise<void>;
}

export function TaskCloneDialog({
  open,
  nodes,
  sourceTaskId,
  loading = false,
  submitting = false,
  serverError,
  loadError,
  requiresRefresh = false,
  retrying = false,
  onRetry,
  onClose,
  onSubmit,
}: TaskCloneDialogProps) {
  const tree = useMemo(() => buildCloneTree(nodes, sourceTaskId), [nodes, sourceTaskId]);
  const treeKey = tree.items
    .map(({ node }) => `${node.task_id}:${node.parent_task_id ?? ''}`)
    .join('\u0000');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quantityValue, setQuantityValue] = useState('1');
  const [destination, setDestination] = useState<'parent' | 'root'>('parent');
  const [destinationParentId, setDestinationParentId] = useState('');
  const submitLocked = useRef(false);

  useEffect(() => {
    if (!open) return;
    setSelected(defaultCloneSelection(tree));
    setQuantityValue('1');
    setDestination('parent');
    setDestinationParentId('');
  }, [open, sourceTaskId, treeKey]);

  const sourceProjectId = nodes.find((node) => node.task_id === sourceTaskId)?.project_id;
  const sourceTreeIds = new Set(tree.items.map(({ node }) => node.task_id));
  const eligibleParents = nodes.filter((node) => !node.is_deleted
    && node.project_id === sourceProjectId
    && !sourceTreeIds.has(node.task_id));
  const orphanedRoots = !selected.has(sourceTaskId) ? getSelectedCloneRootIds(tree, selected) : [];
  const needsDestination = orphanedRoots.length > 0;
  const quantity = parseCloneQuantity(quantityValue);
  const preview = quantity && selected.size
    ? getClonePreview(selected.size, quantity, needsDestination ? orphanedRoots.length : 1)
    : null;
  const unavailable = !loading && !loadError && tree.items.length === 0;
  const destinationMissing = needsDestination && destination === 'parent' && !destinationParentId;
  const disabled = loading || submitting || retrying || unavailable || Boolean(loadError)
    || requiresRefresh || quantity === null || selected.size === 0 || destinationMissing;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (disabled || submitLocked.current || quantity === null) return;
    submitLocked.current = true;
    try {
      await onSubmit(createCloneSelectionInput(
        tree,
        selected,
        quantity,
        needsDestination
          ? destination === 'parent' ? { parentTaskId: destinationParentId } : { withoutParent: true }
          : undefined
      ));
    } catch {
      // Parent owns transport/error messaging; retaining local state enables retry.
    } finally {
      submitLocked.current = false;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? () => {} : onClose}
      preventBackdropClose={submitting}
      title="Clone task"
    >
      <form className="mt-4 w-[min(36rem,80vw)] space-y-4" onSubmit={handleSubmit}>
        {loading ? (
          <p className="text-sm text-slate-600" role="status">Loading task tree…</p>
        ) : loadError ? (
          <p className="text-sm text-red-700" role="alert">Could not load task tree: {loadError}</p>
        ) : unavailable ? (
          <p className="text-sm text-red-700" role="alert">Source task is unavailable.</p>
        ) : (
          <fieldset className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 p-3" disabled={submitting}>
            <legend className="px-1 text-sm font-medium text-slate-800">Tasks to copy</legend>
            <div className="space-y-1" role="tree" aria-label="Tasks to copy">
              {tree.items.map(({ node, depth }) => {
                const state = getCloneCheckboxState(tree, selected, node.task_id);
                const isRoot = node.task_id === sourceTaskId;
                return (
                  <label
                    key={node.task_id}
                    role="treeitem"
                    aria-level={depth + 1}
                    className="flex min-h-8 items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50"
                    style={{ marginLeft: `${depth * 1.25}rem` }}
                  >
                    <input
                      type="checkbox"
                      checked={state.checked}
                      disabled={submitting}
                      aria-checked={state.indeterminate ? 'mixed' : state.checked}
                      ref={(element) => {
                        if (element) element.indeterminate = state.indeterminate;
                      }}
                      onChange={(event) => {
                        setSelected((current) => updateCloneSelection(tree, current, node.task_id, event.target.checked));
                      }}
                    />
                    <span>{node.title}</span>
                    {isRoot && <span className="text-xs text-slate-500">Uncheck to clone selected children elsewhere.</span>}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {needsDestination && (
          <fieldset className="rounded-lg border border-slate-200 p-3" disabled={submitting}>
            <legend className="px-1 text-sm font-medium text-slate-800">Destination</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="clone-destination" checked={destination === 'parent'} onChange={() => setDestination('parent')} />
              Clone under an existing parent
            </label>
            {destination === 'parent' && (
              <select
                aria-label="Destination parent"
                value={destinationParentId}
                onChange={(event) => setDestinationParentId(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                required
              >
                <option value="">Select a parent task</option>
                {eligibleParents.map((node) => <option key={node.task_id} value={node.task_id}>{node.title}</option>)}
              </select>
            )}
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="radio" name="clone-destination" checked={destination === 'root'} onChange={() => setDestination('root')} />
              Clone without parent
            </label>
          </fieldset>
        )}

        <div>
          <label htmlFor="clone-quantity" className="block text-sm font-medium text-slate-800">
            Number of copies
          </label>
          <input
            id="clone-quantity"
            type="number"
            required
            min="1"
            step="1"
            value={quantityValue}
            disabled={submitting}
            aria-invalid={quantity === null}
            aria-describedby={quantity === null ? 'clone-quantity-error' : 'clone-preview'}
            onChange={(event) => setQuantityValue(event.target.value)}
            className="mt-1 w-32 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
          />
          {quantity === null ? (
            <p id="clone-quantity-error" className="mt-1 text-sm text-red-700" role="alert">{QUANTITY_ERROR}</p>
          ) : preview ? (
            <p id="clone-preview" className="mt-1 text-sm text-slate-600">
              {preview.parentCount} {needsDestination
                ? preview.parentCount === 1 ? 'root' : 'roots'
                : preview.parentCount === 1 ? 'parent' : 'parents'} +{' '}
              {preview.childCount} {preview.childCount === 1 ? 'child' : 'children'} ={' '}
              {preview.totalCount} {preview.totalCount === 1 ? 'task' : 'tasks'}
            </p>
          ) : null}
        </div>

        {serverError && <p className="text-sm text-red-700" role="alert">{serverError}</p>}
        {(loadError || requiresRefresh) && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying || submitting}
            className="rounded-md border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {retrying ? 'Refreshing task list…' : 'Refresh task list'}
          </button>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={disabled}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting
              ? 'Creating…'
              : preview
                ? `Create ${quantity} ${quantity === 1 ? 'copy' : 'copies'} (${preview.totalCount} ${preview.totalCount === 1 ? 'task' : 'tasks'})`
                : 'Create copies'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
