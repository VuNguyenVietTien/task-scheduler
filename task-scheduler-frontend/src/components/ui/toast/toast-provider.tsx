'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { ToastContainer } from './toast';
import { useToast, ToastContextType } from './use-toast';

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const { toasts, toast, dismiss, dismissAll } = useToast();

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss, dismissAll }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
};

export const useToastContext = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    console.warn('useToastContext must be used within a ToastProvider. Using fallback implementation.');
    return {
      toasts: [],
      toast: () => '',
      dismiss: () => {},
      dismissAll: () => {}
    };
  }
  return context;
}; 