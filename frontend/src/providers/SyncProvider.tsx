'use client';

import { useStorageSync } from '@/hooks/useStorageSync';

export function SyncProvider({ children }: { children: React.ReactNode }) {
  // Set up storage sync listener
  useStorageSync();

  // We don't need to wrap the children in any context
  // just need to set up the event listener
  return <>{children}</>;
}

// Higher-order function to enable sync for specific components
export function withSync<P extends object>(
  WrappedComponent: React.ComponentType<P>
) {
  return function WithSyncComponent(props: P) {
    useStorageSync();
    return <WrappedComponent {...props} />;
  };
}
