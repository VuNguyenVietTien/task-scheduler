import React from 'react';

interface ValidationStatusProps {
  stage: 'idle' | 'validating' | 'valid' | 'invalid';
  message: string;
}

const STATUS_CONFIG = {
  idle: {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <circle cx="12" cy="12" r="10" strokeWidth="2" />
      </svg>
    ),
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-600',
    borderColor: 'border-gray-200',
    ariaLabel: 'Ready to validate'
  },
  validating: {
    icon: (
      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    ),
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-200',
    ariaLabel: 'Validation in progress, please wait'
  },
  valid: {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
      </svg>
    ),
    bgColor: 'bg-green-50',
    textColor: 'text-green-600',
    borderColor: 'border-green-200',
    ariaLabel: 'Validation successful'
  },
  invalid: {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    bgColor: 'bg-red-50',
    textColor: 'text-red-600',
    borderColor: 'border-red-200',
    ariaLabel: 'Validation failed'
  }
} as const;

export function ValidationStatus({ stage, message }: ValidationStatusProps) {
  const config = STATUS_CONFIG[stage];

  return (
    <div
      role="status"
      data-live={stage === 'validating' ? 'assertive' : 'polite'}
      data-atomic="true"
      data-busy={stage === 'validating' ? true : undefined}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border ${config.bgColor} ${config.textColor} ${config.borderColor}`}
    >
      <span className="sr-only" role="alert">{config.ariaLabel}</span>
      <span aria-hidden="true" className="flex-shrink-0">
        {config.icon}
      </span>
      <span className="text-sm font-medium truncate">
        {message}
      </span>
    </div>
  );
}
