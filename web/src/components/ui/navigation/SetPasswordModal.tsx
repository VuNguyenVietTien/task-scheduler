"use client";

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newPassword: string) => Promise<void>;
}

const SetPasswordModal: React.FC<SetPasswordModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError(t('setPasswordModal.passwordMinLength'));
      return;
    }
    if (password !== confirm) {
      setError(t('setPasswordModal.passwordMismatch'));
      return;
    }

    try {
      setLoading(true);
      await onSubmit(password);
      setSuccess(true);
      setPassword('');
      setConfirm('');
      setTimeout(() => { setSuccess(false); onClose(); }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('setPasswordModal.failedToSetPassword'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setConfirm('');
    setError('');
    setSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          {t('setPasswordModal.title')}
        </h2>

        {success ? (
          <p className="text-sm text-green-600 text-center py-2">
            {t('setPasswordModal.passwordUpdated')}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}
            <div>
              <label htmlFor="sp-password" className="block text-sm text-gray-700 mb-1">
                {t('setPasswordModal.newPassword')}
              </label>
              <input
                id="sp-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder={t('setPasswordModal.passwordPlaceholder')}
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <label htmlFor="sp-confirm" className="block text-sm text-gray-700 mb-1">
                {t('setPasswordModal.confirmPassword')}
              </label>
              <input
                id="sp-confirm"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder={t('setPasswordModal.confirmPlaceholder')}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                {t('setPasswordModal.cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('setPasswordModal.savingPassword') : t('setPasswordModal.savePassword')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default SetPasswordModal;
