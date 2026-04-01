'use client';

import '@/i18n/i18n-config';
import { ReactNode } from 'react';

export function I18nProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
