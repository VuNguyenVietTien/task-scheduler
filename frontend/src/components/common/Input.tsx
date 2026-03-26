import { forwardRef, InputHTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';

interface ValidationState {
  isValid?: boolean;
  isTouched?: boolean;
  errorMessage?: string;
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label?: string;
  helperText?: string;
  validation?: ValidationState;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  wrapperClassName?: string;
  inputClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ 
    label, 
    helperText, 
    validation, 
    wrapperClassName,
    inputClassName,
    leftIcon,
    rightIcon,
    disabled,
    id,
    ...props 
  }, ref) => {
    const { isValid, isTouched, errorMessage } = validation || {};
    const showError = Boolean(isTouched && !isValid && errorMessage);
    const showSuccess = Boolean(isTouched && isValid);

    const inputId = id || props.name || 'input';

    // Base classes that are always applied
    const baseClasses = "block w-full rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-0";
    
    // State-based classes
    const stateClasses = disabled
      ? "bg-gray-50 text-gray-500"
      : "bg-white";
    
    // Validation-based classes
    const validationClasses = showError
      ? "border-red-500 focus:border-red-500 focus:ring-red-500"
      : showSuccess
        ? "border-green-500 focus:border-green-500 focus:ring-green-500"
        : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500";
    
    // Icon-based padding classes
    const iconClasses = [
      leftIcon && "pl-10",
      rightIcon && "pr-10"
    ].filter(Boolean).join(" ");

    // ARIA attributes
    const ariaProps = {
      'id': inputId,
      'aria-invalid': (showError ? 'true' : 'false') as 'true' | 'false',
      'aria-describedby': showError 
        ? `${inputId}-error` 
        : helperText 
          ? `${inputId}-helper` 
          : undefined
    };

    return (
      <div className={twMerge("relative", wrapperClassName)}>
        {label && (
          <label 
            htmlFor={inputId} 
            className={twMerge(
              "block text-sm font-medium mb-1",
              disabled ? "text-gray-400" : "text-gray-700",
              showError ? "text-red-600" : ""
            )}
          >
            {label}
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {leftIcon}
            </div>
          )}
          
          <input
            {...props}
            {...ariaProps}
            ref={ref}
            disabled={disabled}
            className={twMerge(
              baseClasses,
              stateClasses,
              validationClasses,
              iconClasses,
              inputClassName
            )}
          />

          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              {rightIcon}
            </div>
          )}
        </div>

        {showError ? (
          <p 
            id={`${inputId}-error`}
            role="alert"
            className="mt-1 text-xs text-red-600"
          >
            {errorMessage}
          </p>
        ) : helperText ? (
          <p 
            id={`${inputId}-helper`}
            className={twMerge(
              "mt-1 text-xs", 
              disabled ? "text-gray-400" : "text-gray-500"
            )}
          >
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';