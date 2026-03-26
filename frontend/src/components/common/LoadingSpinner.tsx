import React from 'react';
import { Spinner } from '@/components/ui/Spinner';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className = ''
}) => {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <Spinner size={size} className={className} />
    </div>
  );
}; 