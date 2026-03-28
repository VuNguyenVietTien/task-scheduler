'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

interface DatePickerProps {
  date?: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
}

export function DatePicker({ date, onChange, placeholder }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <input
          type="text"
          placeholder={placeholder}
          value={date ? format(date, 'PPP') : ''}
          readOnly
          className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          onClick={() => setIsOpen(true)}
          aria-label={placeholder || "Select date"}
        />
        <div className="absolute right-2 flex items-center gap-1">
          {date && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className="text-gray-400 hover:text-gray-600"
              title="Clear date"
              aria-label="Clear date"
            >
              <span className="text-sm">✕</span>
            </button>
          )}
          <Calendar className="h-4 w-4 text-gray-500 cursor-pointer" onClick={() => setIsOpen(true)} />
        </div>
      </div>

      {isOpen && (
        <div
          className="absolute z-50 mt-2 bg-white rounded-md shadow-lg border border-gray-200"
          role="dialog"
          aria-modal="true"
          aria-label="Calendar popup"
        >
          <DayPicker
            mode="single"
            selected={date || undefined}
            onSelect={(selectedDay: Date | undefined) => {
              onChange(selectedDay || null);
              setIsOpen(false);
            }}
            initialFocus
          />
        </div>
      )}
    </div>
  );
}