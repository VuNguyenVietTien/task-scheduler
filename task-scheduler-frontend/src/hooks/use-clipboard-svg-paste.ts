import { useState, useCallback } from 'react';

export interface SVGPasteResult {
  svgContent: string;
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

export function useClipboardSvgPaste(onPaste?: (result: SVGPasteResult) => void) {
  const [isPasting, setIsPasting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    setError(null);
    setIsPasting(true);

    try {
      // Attempt Clipboard API (requires user permission / HTTPS)
      if (navigator.clipboard && navigator.clipboard.read) {
        try {
          const items = await navigator.clipboard.read();
          for (const item of items) {
            if (item.types.includes('image/svg+xml')) {
              const blob = await item.getType('image/svg+xml');
              const svgText = await blob.text();
              onPaste?.(parseSvg(svgText));
              return;
            }
          }
        } catch {
          // Clipboard API blocked – fall through to event.clipboardData
        }
      }

      // Fallback: use synchronous clipboardData from the paste event
      if (event.clipboardData) {
        const html = event.clipboardData.getData('text/html');
        if (html?.includes('<svg')) {
          const match = html.match(/<svg[\s\S]*?<\/svg>/i);
          if (match) {
            onPaste?.(parseSvg(match[0]));
            return;
          }
        }

        const text = event.clipboardData.getData('text/plain');
        if (text?.includes('<svg')) {
          onPaste?.(parseSvg(text));
          return;
        }
      }

      setError('No SVG found in clipboard. Copy a frame from Figma or Google Stitch first.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to paste SVG');
    } finally {
      setIsPasting(false);
    }
  }, [onPaste]);

  return { isPasting, error, handlePaste };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function parseSvg(svgText: string): SVGPasteResult {
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

  return { svgContent: svgText, layers: extractLayers(svgEl), width, height };
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
      // bbox is calculated on-render via svg-layer-parser.ts once mounted in DOM
      bbox: { x: 0, y: 0, width: 0, height: 0 },
      children: tagName === 'g' ? extractLayers(child, depth + 1) : [],
    });
  }

  return layers;
}
