'use client';
import { useState, useRef, useCallback } from 'react';
import DesignFrameInteractiveSvg from './design-frame-interactive-svg';
import ComponentDescriptionTable from './component-description-table';

interface Props {
  screen: any;
  onRefresh: () => void;
}

export default function DesignViewerSplitPane({ screen, onRefresh }: Props) {
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [splitRatio, setSplitRatio] = useState(0.6);
  const [locale, setLocale] = useState<'en' | 'vi' | 'ja'>('en');
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="p-2 border-b flex items-center gap-3 bg-gray-50">
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
      </div>

      {/* Split pane */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        <div style={{ width: `${splitRatio * 100}%` }} className="overflow-auto">
          <DesignFrameInteractiveSvg
            svgContent={screen.svgContent}
            components={screen.components || []}
            selectedComponentId={selectedComponentId}
            onElementClick={setSelectedComponentId}
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
          />
        </div>
      </div>
    </div>
  );
}
