'use client';

import { useState, KeyboardEvent, ChangeEvent } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Free-text chip input for tags.
 * - Press Enter or type a comma to create a tag.
 * - Press Backspace on empty input to remove the last tag.
 * - Click × on a chip to remove it.
 * - Duplicates are silently ignored.
 */
export function TagInput({ value, onChange, onBlur, placeholder = 'Thêm tag...', className = '', disabled = false }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const addTag = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInputValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Comma triggers tag creation
    if (val.endsWith(',')) {
      addTag(val.slice(0, -1));
    } else {
      setInputValue(val);
    }
  };

  const removeTag = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div
      className={`flex flex-wrap gap-1.5 p-2 border rounded-md focus-within:ring-1 focus-within:ring-blue-300 bg-white min-h-[38px] ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
    >
      {value.map((tag, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full"
        >
          {tag}
          {!disabled && (
            <button
              type="button"
              onClick={() => removeTag(idx)}
              className="text-blue-600 hover:text-blue-800 leading-none"
              aria-label={`Remove tag ${tag}`}
            >
              <XMarkIcon className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          type="text"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Commit any pending text on blur
            if (inputValue.trim()) addTag(inputValue);
            onBlur?.();
          }}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[80px] outline-none text-sm bg-transparent"
        />
      )}
    </div>
  );
}
