import { ReactNode } from 'react';

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export function FormField({ id, label, error, required, children }: FormFieldProps) {
  return (
    <div>
      <label 
        htmlFor={id} 
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

interface FieldErrorMessageProps {
  message: string;
}

export function FieldErrorMessage({ message }: FieldErrorMessageProps) {
  return (
    <p className="mt-1 text-sm text-red-600">
      {message}
    </p>
  );
}

export const fieldStyles = {
  base: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
  error: "border-red-300 focus:ring-red-500",
  success: "border-green-300 focus:ring-green-500",
  disabled: "bg-gray-100 cursor-not-allowed opacity-75",
};
