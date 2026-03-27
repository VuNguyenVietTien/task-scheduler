"use client";

import React from 'react';
import Link from 'next/link';

interface AccountDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

const AccountDropdown: React.FC<AccountDropdownProps> = ({
  isOpen,
  onClose,
  onLogout,
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
      <Link
        href="/profile"
        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
      >
        Your Profile
      </Link>
      <Link
        href="/settings"
        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
      >
        Settings
      </Link>
      <Link
        href="/preferences"
        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
      >
        Preferences
      </Link>
      <hr className="my-1 border-gray-200" />
      <button
        onClick={onLogout}
        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
      >
        Sign out
      </button>
    </div>
  );
};

export default AccountDropdown;
