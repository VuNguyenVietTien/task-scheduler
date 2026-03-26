'use client';
import { useRef, useEffect, useCallback } from 'react';
import { sanitizeSvg } from '@/lib/svg-sanitizer';

interface Props {
  svgContent: string;
  components: any[];
  selectedComponentId: string | null;
  onElementClick: (componentId: string) => void;
}

export default function DesignFrameInteractiveSvg({
  svgContent,
  components,
  selectedComponentId,
  onElementClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback((g: Element) => {
    (g as SVGElement).style.outline = '2px dashed #94a3b8';
  }, []);

  const handleMouseLeave = useCallback((g: Element) => {
    (g as SVGElement).style.outline = 'none';
  }, []);

  // Render SVG and wire up click handlers
  useEffect(() => {
    if (!containerRef.current || !svgContent) return;
    const sanitized = sanitizeSvg(svgContent);
    containerRef.current.innerHTML = sanitized;

    const svgEl = containerRef.current.querySelector('svg');
    if (!svgEl) return;
    svgEl.style.width = '100%';
    svgEl.style.height = 'auto';

    // Add click handlers to mapped elements
    components.forEach(comp => {
      if (!comp.svgElementId) return;
      const el = svgEl.querySelector(`#${CSS.escape(comp.svgElementId)}`);
      if (!el) return;
      (el as HTMLElement).style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onElementClick(comp.id);
      });
    });

    // Hover hint on unmapped g[id] elements
    const allGroups = svgEl.querySelectorAll('g[id]');
    allGroups.forEach(g => {
      const isMapped = components.some(c => c.svgElementId === g.getAttribute('id'));
      if (!isMapped) {
        (g as HTMLElement).style.cursor = 'crosshair';
        g.addEventListener('mouseenter', () => handleMouseEnter(g));
        g.addEventListener('mouseleave', () => handleMouseLeave(g));
      }
    });
  }, [svgContent, components, onElementClick, handleMouseEnter, handleMouseLeave]);

  // Sync highlight when selected component changes
  useEffect(() => {
    if (!containerRef.current) return;
    const svgEl = containerRef.current.querySelector('svg');
    if (!svgEl) return;

    // Reset previous highlight
    svgEl.querySelectorAll('[data-selected]').forEach(el => {
      el.removeAttribute('data-selected');
      (el as SVGElement).style.outline = 'none';
    });

    if (!selectedComponentId) return;
    const comp = components.find(c => c.id === selectedComponentId);
    if (!comp?.svgElementId) return;
    const el = svgEl.querySelector(`#${CSS.escape(comp.svgElementId)}`);
    if (!el) return;
    el.setAttribute('data-selected', 'true');
    (el as SVGElement).style.outline = '3px solid #3b82f6';
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedComponentId, components]);

  return <div ref={containerRef} className="p-4" />;
}
