'use client';

import React, { useState, useRef, useEffect } from 'react';

interface InlineEditableFieldProps {
  /** Current display value */
  value: string;
  /** Called when user commits a change */
  onSave: (newValue: string) => void;
  /** Field type determines the input control */
  type?: 'text' | 'textarea' | 'select' | 'date' | 'number';
  /** Options for select type */
  options?: { value: string; label: string }[];
  /** Placeholder when value is empty */
  placeholder?: string;
  /** Render custom display (badges, avatars, etc.) */
  renderDisplay?: (value: string) => React.ReactNode;
  /** Additional className for the wrapper */
  className?: string;
  /** Number input constraints */
  min?: number;
  max?: number;
  step?: number;
  /** Whether saving is in progress */
  saving?: boolean;
}

/**
 * Inline editable field: click to edit, shows confirm/cancel buttons.
 * Confirm (check) saves changes, Cancel (X) reverts to original value.
 * Shows a subtle hover affordance so user knows the field is clickable.
 */
export function InlineEditableField({
  value,
  onSave,
  type = 'text',
  options,
  placeholder = 'Click de chinh sua',
  renderDisplay,
  className = '',
  min,
  max,
  step,
  saving = false,
}: InlineEditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  // Sync draft when value changes externally
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (type === 'text' || type === 'number') {
        (inputRef.current as HTMLInputElement).select();
      }
    }
  }, [editing, type]);

  const handleCommit = () => {
    setEditing(false);
    if (draft !== value) {
      onSave(draft);
    }
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      e.preventDefault();
      handleCommit();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // For select, commit immediately on change (natural UX for dropdowns)
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVal = e.target.value;
    setDraft(newVal);
    setEditing(false);
    if (newVal !== value) {
      onSave(newVal);
    }
  };

  // Confirm and cancel action buttons shown next to input
  const actionButtons = (
    <div className="flex items-center gap-1 ml-1 flex-shrink-0">
      {/* Confirm button */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleCommit(); }}
        className="p-0.5 rounded hover:bg-green-100 text-green-600 hover:text-green-700 transition-colors"
        title="Xac nhan"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </button>
      {/* Cancel button */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleCancel(); }}
        className="p-0.5 rounded hover:bg-red-100 text-red-500 hover:text-red-600 transition-colors"
        title="Huy"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );

  if (editing) {
    const inputClasses = 'w-full text-sm rounded-md border-slate-300 focus:border-blue-500 focus:ring-blue-500 px-2 py-1';

    if (type === 'select' && options) {
      return (
        <div className="flex items-center gap-1">
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={draft}
            onChange={handleSelectChange}
            onKeyDown={handleKeyDown}
            className={`${inputClasses} ${className}`}
          >
            {options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      );
    }

    if (type === 'textarea') {
      return (
        <div>
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
            className={`${inputClasses} ${className}`}
            placeholder={placeholder}
          />
          <div className="flex justify-end mt-1">{actionButtons}</div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={type}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`${inputClasses} flex-1 ${className}`}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
        />
        {actionButtons}
      </div>
    );
  }

  // Display mode - clickable
  const displayContent = renderDisplay
    ? renderDisplay(value)
    : value || <span className="text-slate-400 italic">{placeholder}</span>;

  return (
    <div
      onClick={() => !saving && setEditing(true)}
      className={`group cursor-pointer rounded px-2 py-1 -mx-2 transition-colors hover:bg-slate-100 ${saving ? 'opacity-50' : ''} ${className}`}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') setEditing(true); }}
      title="Click de chinh sua"
    >
      <div className="flex items-center gap-1">
        <span className="flex-1 text-sm text-slate-900">{displayContent}</span>
        {/* Pencil icon on hover */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </div>
    </div>
  );
}
