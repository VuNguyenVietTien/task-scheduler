'use client';
import { useCallback } from 'react';
import { useMutation } from '@apollo/client';
import { PASTE_DESIGN, UPDATE_DESIGN_FROM_PASTE } from '@/graphql/mutations/designs';
import { useClipboardPaste, PasteResult } from '@/hooks/use-clipboard-paste';

interface Props {
  screenId: string;
  documentId: string;
  onPasted: () => void;
}

export default function PasteDesignZone({ screenId, documentId, onPasted }: Props) {
  const [pasteDesign] = useMutation(PASTE_DESIGN);
  const [updateDesign] = useMutation(UPDATE_DESIGN_FROM_PASTE);

  const handlePaste = useCallback(
    async (result: PasteResult) => {
      if (screenId) {
        await updateDesign({
          variables: {
            screenId,
            svgContent: result.content,
            svgLayers: result.layers,
            contentType: result.contentType,
          },
        });
      } else {
        await pasteDesign({
          variables: {
            input: {
              documentId,
              screenName: 'Pasted Screen',
              svgContent: result.content,
              svgLayers: result.layers,
              breakpoint: 'pc',
              frameWidth: result.width || null,
              frameHeight: result.height || null,
              contentType: result.contentType,
            },
          },
        });
      }
      onPasted();
    },
    [screenId, pasteDesign, updateDesign, documentId, onPasted],
  );

  const { isPasting, error, handlePaste: onClipboardPaste } = useClipboardPaste(handlePaste);

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
          Copy a frame from Figma, or paste a PNG/JPG screenshot, then press{' '}
          <kbd className="px-2 py-1 bg-gray-100 rounded font-mono text-sm">Ctrl+V</kbd>
        </p>
        {isPasting && <p className="text-blue-600">Processing paste...</p>}
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>
    </div>
  );
}
