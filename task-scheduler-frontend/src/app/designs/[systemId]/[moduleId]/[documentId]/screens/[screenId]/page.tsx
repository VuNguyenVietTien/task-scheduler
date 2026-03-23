'use client';
import { useQuery } from '@apollo/client';
import { useParams } from 'next/navigation';
import { GET_SCREEN } from '@/graphql/queries/designs';
import DesignViewerSplitPane from '@/components/designs/design-viewer-split-pane';
import PasteDesignZone from '@/components/designs/paste-design-zone';
import Link from 'next/link';

export default function ScreenViewerPage() {
  const params = useParams<{
    systemId: string;
    moduleId: string;
    documentId: string;
    screenId: string;
  }>();
  const systemId = params?.systemId ?? '';
  const moduleId = params?.moduleId ?? '';
  const documentId = params?.documentId ?? '';
  const screenId = params?.screenId ?? '';
  const { data, loading, refetch } = useQuery(GET_SCREEN, { variables: { id: screenId } });

  if (loading) return <div className="p-6">Loading screen...</div>;
  const screen = data?.screen;
  if (!screen) return <div className="p-6">Screen not found</div>;

  return (
    <div className="h-screen flex flex-col">
      <div className="p-3 border-b flex items-center gap-3 bg-white">
        <Link
          href={`/designs/${systemId}/${moduleId}/${documentId}`}
          className="text-blue-600 hover:underline text-sm"
        >
          &larr; Back
        </Link>
        <h1 className="font-semibold">{screen.name}</h1>
        <span className="text-xs px-2 py-1 rounded bg-gray-100">
          {screen.breakpoint?.toUpperCase()}
        </span>
      </div>
      {screen.svgContent ? (
        <DesignViewerSplitPane screen={screen} onRefresh={refetch} />
      ) : (
        <PasteDesignZone screenId={screenId} documentId={documentId} onPasted={refetch} />
      )}
    </div>
  );
}
