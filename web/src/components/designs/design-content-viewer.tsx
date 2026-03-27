'use client';
import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { sanitizeSvg } from '@/lib/svg-sanitizer';
import FrameOverlayCanvas, { Frame } from './frame-overlay-canvas';

type InteractionMode = 'draw' | 'select';
type Rect = { x: number; y: number; width: number; height: number };

interface Props {
  screen: any;
  selectedComponentId: string | null;
  mode: InteractionMode;
  onFrameCreate: (rect: Rect) => void;
  onFrameUpdate: (id: string, rect: Rect) => void;
  onFrameSelect: (id: string | null) => void;
  onFrameDelete: (id: string) => void;
}

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.1;

export default function DesignContentViewer({
  screen,
  selectedComponentId,
  mode,
  onFrameCreate,
  onFrameUpdate,
  onFrameSelect,
  onFrameDelete,
}: Props) {
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [contentDims, setContentDims] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const isImage = screen.contentType === 'image';

  // Optimistic local overrides: applied immediately on move/resize,
  // cleared when server data catches up via screen.components change.
  const [frameOverrides, setFrameOverrides] = useState<Record<string, Rect>>({});

  // Clear overrides when server data arrives (components prop changes)
  useEffect(() => {
    setFrameOverrides({});
  }, [screen.components]);

  // Ctrl+wheel zoom — prevent default browser zoom
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(prev => {
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((prev + delta) * 100) / 100));
      });
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Measure content natural dimensions
  useEffect(() => {
    if (isImage) {
      const img = new Image();
      img.onload = () => setContentDims({ width: img.naturalWidth, height: img.naturalHeight });
      img.src = screen.svgContent;
    } else if (svgContainerRef.current && screen.svgContent) {
      const sanitized = sanitizeSvg(screen.svgContent);
      svgContainerRef.current.innerHTML = sanitized;
      const svgEl = svgContainerRef.current.querySelector('svg');
      if (svgEl) {
        svgEl.style.width = '100%';
        svgEl.style.height = 'auto';
        const vb = svgEl.getAttribute('viewBox');
        if (vb) {
          const parts = vb.split(/[\s,]+/);
          setContentDims({ width: parseFloat(parts[2]) || 0, height: parseFloat(parts[3]) || 0 });
        } else {
          setContentDims({
            width: parseFloat(svgEl.getAttribute('width') || '0') || svgEl.getBoundingClientRect().width,
            height: parseFloat(svgEl.getAttribute('height') || '0') || svgEl.getBoundingClientRect().height,
          });
        }
      }
    }
  }, [screen.svgContent, isImage]);

  const width = contentDims.width || screen.frameWidth || 0;
  const height = contentDims.height || screen.frameHeight || 0;

  // Map components to frames, applying local overrides for optimistic rendering
  const frames: Frame[] = useMemo(() => {
    return (screen.components || [])
      .filter((c: any) => {
        const pos = frameOverrides[c.id] || c.position;
        return pos && (pos.width > 0 || pos.height > 0);
      })
      .map((c: any, index: number) => {
        const pos = frameOverrides[c.id] || c.position;
        return {
          id: c.id,
          x: pos?.x ?? 0,
          y: pos?.y ?? 0,
          width: pos?.width ?? 0,
          height: pos?.height ?? 0,
          label: c.customId || String(index + 1),
        };
      });
  }, [screen.components, frameOverrides]);

  // Wrap onFrameUpdate to also set optimistic override
  const handleFrameUpdate = useCallback((id: string, rect: Rect) => {
    setFrameOverrides(prev => ({ ...prev, [id]: rect }));
    onFrameUpdate(id, rect);
  }, [onFrameUpdate]);

  const zoomIn = useCallback(() => setZoom(z => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 100) / 100)), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 100) / 100)), []);
  const zoomReset = useCallback(() => setZoom(1), []);

  return (
    <div className="relative h-full flex flex-col">
      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-white/90 border rounded shadow-sm px-1 py-0.5">
        <button onClick={zoomOut} className="px-1.5 py-0.5 text-sm hover:bg-gray-100 rounded" title="Zoom out">−</button>
        <button onClick={zoomReset} className="px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100 rounded min-w-[3rem] text-center" title="Reset zoom">
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={zoomIn} className="px-1.5 py-0.5 text-sm hover:bg-gray-100 rounded" title="Zoom in">+</button>
      </div>

      {/* Scrollable + zoomable area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto p-4">
        {/*
          Zoom strategy:
          - Inner div has width = zoom * 100% of scroll container
          - Image/SVG fills that width naturally (w-full)
          - No CSS transform needed — the content physically changes size
          - Canvas overlay is absolute-positioned inside, scales with container
          - Scrollbars appear naturally when zoomed > 100%
        */}
        <div
          className="relative"
          style={{ width: `${zoom * 100}%` }}
        >
          {isImage ? (
            <img
              src={screen.svgContent}
              alt={screen.name}
              className="w-full h-auto block"
              draggable={false}
            />
          ) : (
            <div ref={svgContainerRef} />
          )}

          {width > 0 && height > 0 && (
            <FrameOverlayCanvas
              frames={frames}
              contentWidth={width}
              contentHeight={height}
              selectedFrameId={selectedComponentId}
              mode={mode}
              onFrameCreate={onFrameCreate}
              onFrameUpdate={handleFrameUpdate}
              onFrameSelect={onFrameSelect}
              onFrameDelete={onFrameDelete}
            />
          )}
        </div>
      </div>
    </div>
  );
}
