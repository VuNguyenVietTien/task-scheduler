'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PageHeaderProps {
  backLink?: string;
  backLabel?: string;
  projectName?: string;
  actionButton?: React.ReactNode;
}

export function PageHeader({ backLink, backLabel, projectName, actionButton }: PageHeaderProps) {
  const router = useRouter();

  return (
    <div className="mb-6 space-y-3">
      {(backLink || backLabel) && (
        <div>
          {backLink ? (
            <Link
              href={backLink}
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {backLabel || 'Quay lại'}
            </Link>
          ) : (
            <button
              onClick={() => router.back()}
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {backLabel || 'Quay lại'}
            </button>
          )}
        </div>
      )}
      
      <div className="flex justify-between items-center">
        <div>
          {projectName && (
            <div className="text-sm text-gray-500 mb-1">
              {projectName}
            </div>
          )}
        </div>
        
        {actionButton && (
          <div>{actionButton}</div>
        )}
      </div>
    </div>
  );
} 