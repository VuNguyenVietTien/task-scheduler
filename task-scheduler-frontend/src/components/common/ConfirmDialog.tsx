import React from 'react';
import { Dialog as HeadlessDialog } from '@headlessui/react';
import { Button } from '@/components/ui/Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'danger';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  variant = 'primary'
}) => {
  return (
    <HeadlessDialog
      open={isOpen}
      onClose={onClose}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black bg-opacity-25" />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center">
          <HeadlessDialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
            <HeadlessDialog.Title
              as="h3"
              className="text-lg font-medium leading-6 text-gray-900"
            >
              {title}
            </HeadlessDialog.Title>
            <div className="mt-2">
              <p className="text-sm text-gray-500">
                {description}
              </p>
            </div>

            <div className="mt-4 flex justify-end space-x-2">
              <Button variant="outline" onClick={onClose}>
                {cancelText}
              </Button>
              <Button variant={variant} onClick={onConfirm}>
                {confirmText}
              </Button>
            </div>
          </HeadlessDialog.Panel>
        </div>
      </div>
    </HeadlessDialog>
  );
}; 