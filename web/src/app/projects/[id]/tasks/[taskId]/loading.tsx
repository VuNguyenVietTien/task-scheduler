'use client';

import React from 'react';
import { Spinner } from '@/components/ui/Spinner';

export default function TaskLoading() {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-200px)]">
      <Spinner size="lg" />
    </div>
  );
} 