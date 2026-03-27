import { ChangeEvent, useEffect } from 'react';
import { fieldStyles } from './FormField';
import { useFieldValidation, ValidationRule } from '@/hooks/useFieldValidation';

interface InputFieldProps {
  id: string;
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date';
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  placeholder?: string;
  min?: number;
  step?: number;
  rules?: ValidationRule<string>[];
  className?: string;
  disabled?: boolean;
}

export function InputField({
  id,
  name,
  label,
  type = 'text',
  value,
  onChange,
  required,
  placeholder,
  min,
  step,
  rules = [],
  className = '',
  disabled = false,
}: InputFieldProps) {
  const { error, isValid, validate, clearValidation } = useFieldValidation<string>(rules);

  useEffect(() => {
    if (value) {
      validate(value);
    } else {
      clearValidation();
    }
  }, [value, validate, clearValidation]);

  // Compose CSS classes based on validation state
  const inputClasses = [
    fieldStyles.base,
    error ? fieldStyles.error : isValid ? fieldStyles.success : '',
    disabled ? fieldStyles.disabled : '',
    className,
  ].join(' ');

  return (
    <div className="space-y-1">
      <label 
        htmlFor={id}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        step={step}
        required={required}
        disabled={disabled}
        className={inputClasses}
      />
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

interface TextAreaFieldProps extends Omit<InputFieldProps, 'type' | 'min' | 'step'> {
  rows?: number;
}

export function TextAreaField({
  id,
  name,
  label,
  value,
  onChange,
  required,
  placeholder,
  rules = [],
  className = '',
  disabled = false,
  rows = 4,
}: TextAreaFieldProps) {
  const { error, isValid, validate, clearValidation } = useFieldValidation<string>(rules);

  useEffect(() => {
    if (value) {
      validate(value);
    } else {
      clearValidation();
    }
  }, [value, validate, clearValidation]);

  const textareaClasses = [
    fieldStyles.base,
    error ? fieldStyles.error : isValid ? fieldStyles.success : '',
    disabled ? fieldStyles.disabled : '',
    className,
  ].join(' ');

  return (
    <div className="space-y-1">
      <label 
        htmlFor={id}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <textarea
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e as unknown as ChangeEvent<HTMLInputElement>)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        rows={rows}
        className={textareaClasses}
      />
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
