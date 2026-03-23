'use client';
import { useCallback } from 'react';
import { useMutation } from '@apollo/client';
import { PASTE_DESIGN } from '@/graphql/mutations/designs';
import { useClipboardSvgPaste, SVGPasteResult } from '@/hooks/use-clipboard-svg-paste';

interface Props {
  screenId: string;
  documentId: string;
  onPasted: () => void;
}

export default function PasteDesignZone({ screenId: _screenId, documentId, onPasted }: Props) {
  const [pasteDesign] = useMutation(PASTE_DESIGN);

  const handlePaste = useCallback(
    async (result: SVGPasteResult) => {
      await pasteDesign({
        variables: {
          input: {
            documentId,
            screenName: 'Pasted Screen',
            svgContent: result.svgContent,
            svgLayers: result.layers,
            breakpoint: 'pc',
          },
        },
      });
      onPasted();
    },
    [pasteDesign, documentId, onPasted],
  );

  const { isPasting, error, handlePaste: onClipboardPaste } = useClipboardSvgPaste(handlePaste);

  return (
    <div
      className="flex-1 flex items-center justify-center"
      onPaste={onClipboardPaste as unknown as React.ClipboardEventHandler}
      tabIndex={0}
    >
      <div className="text-center p-12 border-2 border-dashed border-gray-300 rounded-lg max-w-lg">
        <div className="text-6xl mb-4">📋</div>
        <h2 className="text-xl font-semibold mb-2">Paste Design Here</h2>
        <p className="text-gray-500 mb-4">
          Copy a frame from Figma or Google Stitch, then press{' '}
          <kbd className="px-2 py-1 bg-gray-100 rounded font-mono text-sm">Ctrl+V</kbd>
        </p>
        {isPasting && <p className="text-blue-600">Processing SVG...</p>}
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>
    </div>
  );
}
