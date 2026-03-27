'use client';
import { useRef, useEffect, useCallback, useState } from 'react';

export interface Frame {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color?: string;
}

type InteractionMode = 'draw' | 'select';

interface Props {
  frames: Frame[];
  contentWidth: number;
  contentHeight: number;
  selectedFrameId: string | null;
  mode: InteractionMode;
  onFrameCreate: (rect: { x: number; y: number; width: number; height: number }) => void;
  onFrameUpdate: (id: string, rect: { x: number; y: number; width: number; height: number }) => void;
  onFrameSelect: (id: string | null) => void;
  onFrameDelete: (id: string) => void;
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const HANDLE_SIZE = 8;
const FRAME_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function getFrameColor(index: number): string {
  return FRAME_COLORS[index % FRAME_COLORS.length];
}

export default function FrameOverlayCanvas({
  frames,
  contentWidth,
  contentHeight,
  selectedFrameId,
  mode,
  onFrameCreate,
  onFrameUpdate,
  onFrameSelect,
  onFrameDelete,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    type: 'draw' | 'move' | 'resize';
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    frameId?: string;
    handle?: ResizeHandle;
    origRect?: { x: number; y: number; width: number; height: number };
  } | null>(null);

  // Convert viewport coords to content coords
  const toContentCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !contentWidth || !contentHeight) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = contentWidth / rect.width;
    const scaleY = contentHeight / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, [contentWidth, contentHeight]);

  // Convert content coords to viewport coords for rendering
  const toViewport = useCallback((x: number, y: number, w: number, h: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !contentWidth || !contentHeight) return { x: 0, y: 0, w: 0, h: 0 };
    const scaleX = canvas.width / contentWidth;
    const scaleY = canvas.height / contentHeight;
    return { x: x * scaleX, y: y * scaleY, w: w * scaleX, h: h * scaleY };
  }, [contentWidth, contentHeight]);

  // Find which frame is under the cursor
  const hitTest = useCallback((cx: number, cy: number): string | null => {
    // Iterate in reverse to pick topmost
    for (let i = frames.length - 1; i >= 0; i--) {
      const f = frames[i];
      if (cx >= f.x && cx <= f.x + f.width && cy >= f.y && cy <= f.y + f.height) {
        return f.id;
      }
    }
    return null;
  }, [frames]);

  // Find resize handle under cursor
  const hitTestHandle = useCallback((cx: number, cy: number): ResizeHandle | null => {
    if (!selectedFrameId) return null;
    const frame = frames.find(f => f.id === selectedFrameId);
    if (!frame) return null;

    const canvas = canvasRef.current;
    if (!canvas || !contentWidth) return null;
    // Handle size in content coords
    const hs = (HANDLE_SIZE / (canvas.width / contentWidth)) * 1.5;

    const handles: { handle: ResizeHandle; hx: number; hy: number }[] = [
      { handle: 'nw', hx: frame.x, hy: frame.y },
      { handle: 'n', hx: frame.x + frame.width / 2, hy: frame.y },
      { handle: 'ne', hx: frame.x + frame.width, hy: frame.y },
      { handle: 'e', hx: frame.x + frame.width, hy: frame.y + frame.height / 2 },
      { handle: 'se', hx: frame.x + frame.width, hy: frame.y + frame.height },
      { handle: 's', hx: frame.x + frame.width / 2, hy: frame.y + frame.height },
      { handle: 'sw', hx: frame.x, hy: frame.y + frame.height },
      { handle: 'w', hx: frame.x, hy: frame.y + frame.height / 2 },
    ];

    for (const { handle, hx, hy } of handles) {
      if (Math.abs(cx - hx) <= hs && Math.abs(cy - hy) <= hs) return handle;
    }
    return null;
  }, [frames, selectedFrameId, contentWidth]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const pos = toContentCoords(e.clientX, e.clientY);

    if (mode === 'draw') {
      setDragState({ type: 'draw', startX: pos.x, startY: pos.y, currentX: pos.x, currentY: pos.y });
      return;
    }

    // Select mode
    const handle = hitTestHandle(pos.x, pos.y);
    if (handle && selectedFrameId) {
      const frame = frames.find(f => f.id === selectedFrameId)!;
      setDragState({
        type: 'resize',
        startX: pos.x,
        startY: pos.y,
        currentX: pos.x,
        currentY: pos.y,
        frameId: selectedFrameId,
        handle,
        origRect: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
      });
      return;
    }

    const hitId = hitTest(pos.x, pos.y);
    onFrameSelect(hitId);

    if (hitId) {
      const frame = frames.find(f => f.id === hitId)!;
      setDragState({
        type: 'move',
        startX: pos.x,
        startY: pos.y,
        currentX: pos.x,
        currentY: pos.y,
        frameId: hitId,
        origRect: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
      });
    }
  }, [mode, toContentCoords, hitTest, hitTestHandle, selectedFrameId, frames, onFrameSelect]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState) return;
    const pos = toContentCoords(e.clientX, e.clientY);
    setDragState(prev => prev ? { ...prev, currentX: pos.x, currentY: pos.y } : null);
  }, [dragState, toContentCoords]);

  const handleMouseUp = useCallback(() => {
    if (!dragState) return;

    if (dragState.type === 'draw') {
      const x = Math.min(dragState.startX, dragState.currentX);
      const y = Math.min(dragState.startY, dragState.currentY);
      const w = Math.abs(dragState.currentX - dragState.startX);
      const h = Math.abs(dragState.currentY - dragState.startY);
      // Ignore tiny accidental clicks
      if (w > 5 && h > 5) {
        onFrameCreate({ x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) });
      }
    } else if (dragState.type === 'move' && dragState.frameId && dragState.origRect) {
      const dx = dragState.currentX - dragState.startX;
      const dy = dragState.currentY - dragState.startY;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        onFrameUpdate(dragState.frameId, {
          x: Math.round(dragState.origRect.x + dx),
          y: Math.round(dragState.origRect.y + dy),
          width: dragState.origRect.width,
          height: dragState.origRect.height,
        });
      }
    } else if (dragState.type === 'resize' && dragState.frameId && dragState.origRect && dragState.handle) {
      const newRect = computeResize(dragState.origRect, dragState.handle, dragState.currentX - dragState.startX, dragState.currentY - dragState.startY);
      onFrameUpdate(dragState.frameId, newRect);
    }

    setDragState(null);
  }, [dragState, onFrameCreate, onFrameUpdate]);

  // Keyboard handler for delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFrameId) {
        // Don't delete if user is typing in an input
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
        e.preventDefault();
        onFrameDelete(selectedFrameId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFrameId, onFrameDelete]);

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Match canvas size to container
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all frames
    frames.forEach((frame, index) => {
      let { x, y, width, height } = frame;

      // Apply drag state for live preview
      if (dragState?.frameId === frame.id) {
        if (dragState.type === 'move' && dragState.origRect) {
          const dx = dragState.currentX - dragState.startX;
          const dy = dragState.currentY - dragState.startY;
          x = dragState.origRect.x + dx;
          y = dragState.origRect.y + dy;
        } else if (dragState.type === 'resize' && dragState.origRect && dragState.handle) {
          const resized = computeResize(dragState.origRect, dragState.handle, dragState.currentX - dragState.startX, dragState.currentY - dragState.startY);
          x = resized.x; y = resized.y; width = resized.width; height = resized.height;
        }
      }

      const vp = toViewport(x, y, width, height);
      const isSelected = frame.id === selectedFrameId;
      const color = frame.color || getFrameColor(index);

      // Semi-transparent fill
      ctx.fillStyle = color + '1A'; // ~10% opacity
      ctx.fillRect(vp.x, vp.y, vp.w, vp.h);

      // Border
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.setLineDash(isSelected ? [] : [6, 3]);
      ctx.strokeRect(vp.x, vp.y, vp.w, vp.h);
      ctx.setLineDash([]);

      // Label
      ctx.font = '12px monospace';
      ctx.fillStyle = color;
      const labelBg = 'rgba(255,255,255,0.85)';
      const label = frame.label || '';
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = labelBg;
      ctx.fillRect(vp.x, vp.y - 18, textWidth + 8, 18);
      ctx.fillStyle = color;
      ctx.fillText(label, vp.x + 4, vp.y - 5);

      // Resize handles for selected frame
      if (isSelected) {
        const handles = [
          { hx: vp.x, hy: vp.y },
          { hx: vp.x + vp.w / 2, hy: vp.y },
          { hx: vp.x + vp.w, hy: vp.y },
          { hx: vp.x + vp.w, hy: vp.y + vp.h / 2 },
          { hx: vp.x + vp.w, hy: vp.y + vp.h },
          { hx: vp.x + vp.w / 2, hy: vp.y + vp.h },
          { hx: vp.x, hy: vp.y + vp.h },
          { hx: vp.x, hy: vp.y + vp.h / 2 },
        ];
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        handles.forEach(({ hx, hy }) => {
          ctx.fillRect(hx - HANDLE_SIZE / 2, hy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
          ctx.strokeRect(hx - HANDLE_SIZE / 2, hy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
        });
      }
    });

    // Draw in-progress rectangle
    if (dragState?.type === 'draw') {
      const x = Math.min(dragState.startX, dragState.currentX);
      const y = Math.min(dragState.startY, dragState.currentY);
      const w = Math.abs(dragState.currentX - dragState.startX);
      const h = Math.abs(dragState.currentY - dragState.startY);
      const vp = toViewport(x, y, w, h);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(vp.x, vp.y, vp.w, vp.h);
      ctx.setLineDash([]);
      ctx.fillStyle = '#3b82f61A';
      ctx.fillRect(vp.x, vp.y, vp.w, vp.h);
    }
  }, [frames, selectedFrameId, dragState, toViewport]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ cursor: mode === 'draw' ? 'crosshair' : 'default' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function computeResize(
  orig: { x: number; y: number; width: number; height: number },
  handle: ResizeHandle,
  dx: number,
  dy: number,
): { x: number; y: number; width: number; height: number } {
  let { x, y, width, height } = orig;
  const minSize = 10;

  switch (handle) {
    case 'nw': x += dx; y += dy; width -= dx; height -= dy; break;
    case 'n': y += dy; height -= dy; break;
    case 'ne': width += dx; y += dy; height -= dy; break;
    case 'e': width += dx; break;
    case 'se': width += dx; height += dy; break;
    case 's': height += dy; break;
    case 'sw': x += dx; width -= dx; height += dy; break;
    case 'w': x += dx; width -= dx; break;
  }

  // Enforce minimum size, clamping position to prevent inversion
  if (width < minSize) {
    if (handle === 'nw' || handle === 'w' || handle === 'sw') x = orig.x + orig.width - minSize;
    width = minSize;
  }
  if (height < minSize) {
    if (handle === 'nw' || handle === 'n' || handle === 'ne') y = orig.y + orig.height - minSize;
    height = minSize;
  }

  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}
