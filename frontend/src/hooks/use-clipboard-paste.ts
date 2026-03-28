import { useState, useCallback } from 'react';

export interface PasteResult {
  content: string;
  contentType: 'svg' | 'image';
  layers: SVGLayer[];
  width: number;
  height: number;
}

export interface SVGLayer {
  svgElementId: string;
  tagName: string;
  label: string;
  bbox: { x: number; y: number; width: number; height: number };
  children: SVGLayer[];
}

const MEANINGFUL_TAGS = ['g', 'rect', 'text', 'circle', 'ellipse', 'path', 'image'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export function useClipboardPaste(onPaste?: (result: PasteResult) => void) {
  const [isPasting, setIsPasting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    setError(null);
    setIsPasting(true);

    try {
      // IMPORTANT: Read event.clipboardData SYNCHRONOUSLY first — it's cleared after the event handler returns.
      let svgFromEvent: string | null = null;

      if (event.clipboardData) {
        const types = Array.from(event.clipboardData.types);
        console.log('[Paste] Clipboard event types:', types);

        // Check all types for embedded SVG
        for (const type of types) {
          const data = event.clipboardData.getData(type);
          if (data?.includes('<svg')) {
            const match = data.match(/<svg[\s\S]*?<\/svg>/i);
            if (match) {
              console.log('[Paste] Found SVG in event type:', type);
              svgFromEvent = match[0];
              break;
            }
          }
        }

        // Check for SVG files in clipboard
        if (!svgFromEvent && event.clipboardData.files.length > 0) {
          for (const file of Array.from(event.clipboardData.files)) {
            if (file.type === 'image/svg+xml') {
              svgFromEvent = await file.text();
              console.log('[Paste] Found SVG file in clipboard');
              break;
            }
          }
        }

        // Check for image files (PNG/JPG) in clipboard
        if (!svgFromEvent && event.clipboardData.files.length > 0) {
          for (const file of Array.from(event.clipboardData.files)) {
            if (file.type === 'image/png' || file.type === 'image/jpeg') {
              if (file.size > MAX_IMAGE_SIZE) {
                setError(`Image too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 5MB.`);
                return;
              }
              console.log('[Paste] Found image file in clipboard:', file.type);
              const result = await readImageFile(file);
              onPaste?.(result);
              return;
            }
          }
        }
      }

      if (svgFromEvent) {
        onPaste?.(parseSvg(svgFromEvent));
        return;
      }

      // Fallback: try async Clipboard API
      if (navigator.clipboard?.read) {
        try {
          const items = await navigator.clipboard.read();
          for (const item of items) {
            // Check SVG first
            if (item.types.includes('image/svg+xml')) {
              const blob = await item.getType('image/svg+xml');
              const svgText = await blob.text();
              console.log('[Paste] Found SVG via Clipboard API');
              onPaste?.(parseSvg(svgText));
              return;
            }
            // Check for image blobs
            for (const mimeType of ['image/png', 'image/jpeg']) {
              if (item.types.includes(mimeType)) {
                const blob = await item.getType(mimeType);
                if (blob.size > MAX_IMAGE_SIZE) {
                  setError(`Image too large (${(blob.size / 1024 / 1024).toFixed(1)}MB). Max 5MB.`);
                  return;
                }
                console.log('[Paste] Found image via Clipboard API:', mimeType);
                const file = new File([blob], 'pasted-image', { type: mimeType });
                const result = await readImageFile(file);
                onPaste?.(result);
                return;
              }
            }
          }
        } catch {
          // Clipboard API blocked — already tried event fallback above
        }
      }

      setError('No SVG or image found in clipboard. Paste an SVG from Figma, or a PNG/JPG screenshot.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to paste content');
    } finally {
      setIsPasting(false);
    }
  }, [onPaste]);

  return { isPasting, error, handlePaste };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function readImageFile(file: File): Promise<PasteResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        resolve({
          content: dataUrl,
          contentType: 'image',
          layers: [],
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.onerror = () => reject(new Error('Failed to load pasted image'));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('Failed to read pasted file'));
    reader.readAsDataURL(file);
  });
}

function parseSvg(svgText: string): PasteResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');
  if (!svgEl) throw new Error('Invalid SVG content');

  let width = 0;
  let height = 0;
  const viewBox = svgEl.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/);
    width = parseFloat(parts[2]) || 0;
    height = parseFloat(parts[3]) || 0;
  }
  if (!width) width = parseFloat(svgEl.getAttribute('width') || '0');
  if (!height) height = parseFloat(svgEl.getAttribute('height') || '0');

  return { content: svgText, contentType: 'svg', layers: extractLayers(svgEl), width, height };
}

function extractLayers(element: Element, depth = 0): SVGLayer[] {
  if (depth > 4) return [];
  const layers: SVGLayer[] = [];

  for (const child of Array.from(element.children)) {
    const tagName = child.tagName.toLowerCase();
    if (!MEANINGFUL_TAGS.includes(tagName)) continue;

    const id = child.getAttribute('id') || '';
    const label =
      id ||
      child.getAttribute('class') ||
      child.getAttribute('aria-label') ||
      tagName;

    layers.push({
      svgElementId: id,
      tagName,
      label,
      bbox: { x: 0, y: 0, width: 0, height: 0 },
      children: tagName === 'g' ? extractLayers(child, depth + 1) : [],
    });
  }

  return layers;
}
