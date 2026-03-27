'use client';
import { useEffect, useRef } from 'react';

interface Props {
  mermaidDefinition: string;
  onNodeClick?: (nodeId: string) => void;
}

/**
 * Renders a Mermaid diagram from a definition string.
 * Falls back to displaying the raw source if parsing fails.
 * Optionally calls onNodeClick with the node id when a diagram node is clicked.
 */
export default function MermaidFlowViewer({ mermaidDefinition, onNodeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !mermaidDefinition) return;

    const renderMermaid = async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'strict',
        });

        // Use a unique id so concurrent renders don't collide.
        const diagramId = `mermaid-diagram-${Date.now()}`;
        const { svg } = await mermaid.render(diagramId, mermaidDefinition);

        if (containerRef.current) {
          containerRef.current.innerHTML = svg;

          if (onNodeClick) {
            containerRef.current.querySelectorAll('.node').forEach((node) => {
              (node as HTMLElement).style.cursor = 'pointer';
              node.addEventListener('click', () => {
                // Strip the "flowchart-" prefix and trailing counter added by Mermaid.
                const rawId = node.getAttribute('id') ?? '';
                const nodeId = rawId.replace(/^flowchart-/, '').replace(/-\d+$/, '');
                if (nodeId) onNodeClick(nodeId);
              });
            });
          }
        }
      } catch {
        if (containerRef.current) {
          // Use textContent to prevent XSS via malicious mermaid definitions
          const pre = document.createElement('pre');
          pre.className = 'text-red-500 text-xs p-2 whitespace-pre-wrap';
          pre.textContent = mermaidDefinition;
          containerRef.current.innerHTML = '';
          containerRef.current.appendChild(pre);
        }
      }
    };

    renderMermaid();
  }, [mermaidDefinition, onNodeClick]);

  return <div ref={containerRef} className="p-4 overflow-auto" />;
}
