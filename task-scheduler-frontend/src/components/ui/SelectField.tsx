import { ChangeEvent, useEffect, useMemo } from 'react';
import { fieldStyles } from './FormField';
import { useFieldValidation, ValidationRule } from '@/hooks/useFieldValidation';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  options: SelectOption[];
  required?: boolean;
  rules?: ValidationRule<string>[];
  className?: string;
  disabled?: boolean;
  hint?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

export function SelectField({
  id,
  name,
  label,
  value,
  onChange,
  options,
  required = false,
  rules = [],
  className = '',
  disabled = false,
  hint,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedby,
}: SelectFieldProps): JSX.Element {
  const { error, isValid, validate, clearValidation } = useFieldValidation<string>(rules);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const labelId = `${id}-label`;
  const titleText = hint || 'Select an option...';

  useEffect(() => {
    if (value) {
      validate(value);
    } else {
      clearValidation();
    }
  }, [value, validate, clearValidation]);

  const selectClasses = useMemo(() => [
    fieldStyles.base,
    error ? fieldStyles.error : isValid && value ? fieldStyles.success : '',
    disabled ? fieldStyles.disabled : '',
    className,
  ].join(' '), [error, isValid, value, disabled, className]);

  const ariaDescribedbyIds = useMemo(() => [
    error ? errorId : null,
    hint ? hintId : null,
    ariaDescribedby,
  ].filter(Boolean).join(' ') || undefined, [error, hint, errorId, hintId, ariaDescribedby]);

  return (
    <div className="space-y-1" role="group" aria-labelledby={labelId}>
      <label 
        htmlFor={id}
        className="block text-sm font-medium text-gray-700"
        id={labelId}
      >
        {label}
        {required && (
          <span 
            className="text-red-500 ml-1" 
            aria-hidden="true"
          >
            *
          </span>
        )}
      </label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className={selectClasses}
        aria-label={ariaLabel || label}
        aria-invalid={error !== undefined}
        aria-describedby={ariaDescribedbyIds}
        aria-required={required}
      >
        <option value="" disabled={required} aria-label={`Select ${label.toLowerCase()}`}>
          {titleText}
        </option>
        {options.map(option => (
          <option 
            key={option.value} 
            value={option.value}
            aria-label={option.label}
          >
            {option.label}
          </option>
        ))}
      </select>
      {hint && !error && (
        <p 
          id={hintId} 
          className="mt-1 text-sm text-gray-500"
          role="note"
        >
          {hint}
        </p>
      )}
      {error && (
        <p 
          id={errorId} 
          className="mt-1 text-sm text-red-600" 
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export function createOptionGroup(label: string, options: SelectOption[]): JSX.Element {
  return (
    <optgroup 
      key={label} 
      label={label}
      aria-label={label}
    >
      {options.map(option => (
        <option 
          key={option.value} 
          value={option.value}
          aria-label={option.label}
        >
          {option.label}
        </option>
      ))}
    </optgroup>
  );
}

export function mergeFieldClasses(...classes: string[]): string {
  return [fieldStyles.base, ...classes].filter(Boolean).join(' ');
}

export interface FieldValidationState {
  error?: string;
  isValid: boolean;
  touched: boolean;
}
