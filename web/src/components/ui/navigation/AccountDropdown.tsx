"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';

interface AccountDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  onSettingsOpen: () => void;
  onSetPasswordOpen: () => void;
}

const AccountDropdown: React.FC<AccountDropdownProps> = ({
  isOpen,
  onClose,
  onLogout,
  onSettingsOpen,
  onSetPasswordOpen,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
      <button
        onClick={() => { onSettingsOpen(); onClose(); }}
        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
      >
        {t('profile.settings')}
      </button>
      <button
        onClick={() => { onSetPasswordOpen(); onClose(); }}
        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
      >
        {t('profile.setPassword')}
      </button>
      <hr className="my-1 border-gray-200" />
      <button
        onClick={onLogout}
        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
      >
        {t('profile.signOut')}
      </button>
    </div>
  );
};

export default AccountDropdown;
