import DOMPurify from 'dompurify';

/**
 * DOMPurify configuration that allows safe SVG markup while stripping
 * scripts, foreignObject blocks, and event-handler attributes.
 */
const SVG_PURIFY_CONFIG: DOMPurify.Config = {
  USE_PROFILES: { svg: true, svgFilters: true },
  ADD_TAGS: [
    'use', 'defs', 'clipPath', 'mask', 'pattern',
    'linearGradient', 'radialGradient', 'stop', 'filter',
  ],
  ADD_ATTR: [
    'viewBox', 'fill', 'stroke', 'transform', 'd',
    'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height',
    'href', 'xlink:href',
  ],
  FORBID_TAGS: ['script', 'foreignObject'],
  FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover'],
};

/**
 * Sanitize an SVG string using DOMPurify.
 * Safe to call server-side (DOMPurify detects JSDOM / no-op environment).
 */
export function sanitizeSvg(svgContent: string): string {
  return DOMPurify.sanitize(svgContent, SVG_PURIFY_CONFIG) as string;
}
