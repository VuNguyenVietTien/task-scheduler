export interface SVGLayer {
  svgElementId: string;
  tagName: string;
  label: string;
  bbox: { x: number; y: number; width: number; height: number };
  children: SVGLayer[];
}

const WALKABLE_TAGS = new Set([
  'g', 'rect', 'text', 'circle', 'ellipse', 'path',
  'image', 'polygon', 'polyline', 'line',
]);

/**
 * Extract layer hierarchy from an SVG element already mounted in the DOM.
 * Must be called after the SVG is rendered so that `getBBox()` returns real values.
 */
export function extractLayersFromDom(svgElement: SVGSVGElement): SVGLayer[] {
  return walkSvgDom(svgElement, 0);
}

// ── helpers ───────────────────────────────────────────────────────────────────

function walkSvgDom(element: Element, depth: number): SVGLayer[] {
  if (depth > 4) return [];
  const layers: SVGLayer[] = [];

  for (const child of Array.from(element.children)) {
    const tagName = child.tagName.toLowerCase();
    if (!WALKABLE_TAGS.has(tagName)) continue;

    const id = child.getAttribute('id') ?? '';
    const label =
      id ||
      child.getAttribute('data-name') ||
      child.getAttribute('class') ||
      tagName;

    let bbox = { x: 0, y: 0, width: 0, height: 0 };
    try {
      if (child instanceof SVGGraphicsElement) {
        const rect = child.getBBox();
        bbox = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }
    } catch {
      // getBBox throws for hidden / detached elements – keep zero bbox
    }

    layers.push({
      svgElementId: id,
      tagName,
      label,
      bbox,
      children: tagName === 'g' ? walkSvgDom(child, depth + 1) : [],
    });
  }

  return layers;
}
