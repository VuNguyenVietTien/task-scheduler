'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { CREATE_COMPONENT, UPDATE_COMPONENT, DELETE_COMPONENT } from '@/graphql/mutations/designs';
import DesignContentViewer from './design-content-viewer';
import ComponentDescriptionTable from './component-description-table';

type InteractionMode = 'draw' | 'select';

interface Props {
  screen: any;
  onRefresh: () => void;
}

export default function DesignViewerSplitPane({ screen, onRefresh }: Props) {
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [splitRatio, setSplitRatio] = useState(0.6);
  const [locale, setLocale] = useState<'en' | 'vi' | 'ja'>('en');
  const [mode, setMode] = useState<InteractionMode>('select');
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  const [createComponent] = useMutation(CREATE_COMPONENT);
  const [updateComponent] = useMutation(UPDATE_COMPONENT);
  const [deleteComponent] = useMutation(DELETE_COMPONENT);

  // Split pane resize handlers
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setSplitRatio(Math.max(0.3, Math.min(0.8, ratio)));
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove, handleMouseUp]);

  // Frame overlay callbacks
  const nextIdRef = useRef((screen.components?.length || 0) + 1);
  // Keep ref in sync when components change from server
  useEffect(() => {
    const maxId = (screen.components || []).reduce((max: number, c: any) => {
      const num = parseInt(c.customId, 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    nextIdRef.current = maxId + 1;
  }, [screen.components]);

  const handleFrameCreate = useCallback(async (rect: { x: number; y: number; width: number; height: number }) => {
    const customId = String(nextIdRef.current++);
    const nextIndex = parseInt(customId, 10);
    try {
      const result = await createComponent({
        variables: {
          input: {
            screenId: screen.id,
            customId,
            name: `Component ${nextIndex}`,
            componentType: 'frame',
            position: rect,
          },
        },
      });
      onRefresh();
      if (result.data?.createComponent?.id) {
        setSelectedComponentId(result.data.createComponent.id);
      }
    } catch (err) {
      console.error('[DesignViewer] Failed to create component from frame:', err);
    }
  }, [createComponent, screen.id, screen.components?.length, onRefresh]);

  const handleFrameUpdate = useCallback((componentId: string, rect: { x: number; y: number; width: number; height: number }) => {
    // Debounced persist — no refetch during drag to avoid flicker
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      try {
        await updateComponent({
          variables: { input: { id: componentId, position: rect } },
        });
      } catch (err) {
        console.error('[DesignViewer] Failed to update component position:', err);
      }
    }, 250);
  }, [updateComponent]);

  const handleFrameDelete = useCallback(async (componentId: string) => {
    try {
      await deleteComponent({ variables: { id: componentId } });
      if (selectedComponentId === componentId) setSelectedComponentId(null);
      onRefresh();
    } catch (err) {
      console.error('[DesignViewer] Failed to delete component:', err);
    }
  }, [deleteComponent, selectedComponentId, onRefresh]);

  const handleFrameSelect = useCallback((id: string | null) => {
    setSelectedComponentId(id);
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="p-2 border-b flex items-center gap-3 bg-gray-50">
        {/* Mode toggle */}
        <div className="flex rounded border overflow-hidden">
          <button
            onClick={() => setMode('select')}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              mode === 'select' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Select
          </button>
          <button
            onClick={() => setMode('draw')}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              mode === 'draw' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Draw
          </button>
        </div>

        <select
          value={locale}
          onChange={e => setLocale(e.target.value as 'en' | 'vi' | 'ja')}
          className="px-2 py-1 border rounded text-sm"
        >
          <option value="en">English</option>
          <option value="vi">Tiếng Việt</option>
          <option value="ja">日本語</option>
        </select>
        <span className="text-xs text-gray-500">{screen.components?.length || 0} components</span>
        {mode === 'draw' && (
          <span className="text-xs text-blue-600">Click and drag on the design to draw a frame</span>
        )}
      </div>

      {/* Split pane */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        <div style={{ width: `${splitRatio * 100}%` }} className="overflow-auto">
          <DesignContentViewer
            screen={screen}
            selectedComponentId={selectedComponentId}
            mode={mode}
            onFrameCreate={handleFrameCreate}
            onFrameUpdate={handleFrameUpdate}
            onFrameSelect={handleFrameSelect}
            onFrameDelete={handleFrameDelete}
          />
        </div>
        <div
          onMouseDown={handleMouseDown}
          className="w-1 bg-gray-300 hover:bg-blue-400 cursor-col-resize flex-shrink-0"
        />
        <div style={{ width: `${(1 - splitRatio) * 100}%` }} className="overflow-auto">
          <ComponentDescriptionTable
            components={screen.components || []}
            selectedComponentId={selectedComponentId}
            onRowClick={setSelectedComponentId}
            locale={locale}
            onRefresh={onRefresh}
            onDelete={handleFrameDelete}
          />
        </div>
      </div>
    </div>
  );
}
