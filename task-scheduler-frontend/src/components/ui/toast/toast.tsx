'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Toast, ToastContextType } from './use-toast';

interface ToastProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const ToastComponent = ({ toast, onDismiss }: ToastProps) => {
  const [progress, setProgress] = useState(100);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Fade in animation
    const fadeInTimer = setTimeout(() => {
      setIsVisible(true);
    }, 10);

    // Progress bar animation
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - (100 / (toast.duration || 3000)) * 10;
      });
    }, 10);

    // Auto dismiss
    const dismissTimer = setTimeout(() => {
      handleDismiss();
    }, toast.duration || 3000);

    return () => {
      clearTimeout(fadeInTimer);
      clearInterval(interval);
      clearTimeout(dismissTimer);
    };
  }, [toast.duration]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 300);
  };

  const getVariantClass = () => {
    switch (toast.variant) {
      case 'success':
        return 'bg-green-500 text-white';
      case 'error':
        return 'bg-red-500 text-white';
      case 'warning':
        return 'bg-yellow-500 text-white';
      case 'info':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-gray-800 text-white';
    }
  };

  return (
    <div
      className={`min-w-[300px] max-w-md p-4 rounded-lg shadow-lg flex flex-col relative overflow-hidden transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      } ${getVariantClass()}`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-semibold text-sm">{toast.title}</h3>
          {toast.description && (
            <p className="text-sm mt-1 opacity-90">{toast.description}</p>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="text-white opacity-70 hover:opacity-100 transition-opacity"
        >
          ×
        </button>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 h-1 bg-white bg-opacity-30 w-full">
        <div
          className="h-1 bg-white bg-opacity-90 transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export const ToastContainer = ({
  toasts,
  dismiss,
}: {
  toasts: Toast[];
  dismiss: (id: string) => void;
}) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  if (!isMounted) return null;

  const container = document.getElementById('toast-container') || document.body;

  return createPortal(
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 items-end">
      {toasts.map((toast) => (
        <ToastComponent key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>,
    container
  );
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toastContainerElement, setToastContainerElement] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create a div for the toast container if it doesn't exist
    if (!document.getElementById('toast-container')) {
      const containerElement = document.createElement('div');
      containerElement.id = 'toast-container';
      document.body.appendChild(containerElement);
      setToastContainerElement(containerElement);
    }

    return () => {
      // Clean up when the component unmounts
      if (toastContainerElement) {
        document.body.removeChild(toastContainerElement);
      }
    };
  }, []);

  return <>{children}</>;
}; 