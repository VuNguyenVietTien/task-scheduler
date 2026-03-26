import { useState, useCallback } from 'react';

export type ValidationRule<T> = {
  validate: (value: T) => boolean;
  message: string;
};

export type ValidationResult = {
  isValid: boolean;
  error?: string;
};

export function useFieldValidation<T>(rules: ValidationRule<T>[]) {
  const [error, setError] = useState<string | undefined>(undefined);
  const [isValid, setIsValid] = useState(true);

  const validate = useCallback((value: T): ValidationResult => {
    for (const rule of rules) {
      if (!rule.validate(value)) {
        setError(rule.message);
        setIsValid(false);
        return { isValid: false, error: rule.message };
      }
    }
    setError(undefined);
    setIsValid(true);
    return { isValid: true };
  }, [rules]);

  const clearValidation = useCallback(() => {
    setError(undefined);
    setIsValid(true);
  }, []);

  return {
    error,
    isValid,
    validate,
    clearValidation
  };
}

// Common validation rules
export const validationRules = {
  required: (fieldName: string): ValidationRule<any> => ({
    validate: (value: any) => {
      if (typeof value === 'string') {
        return value.trim().length > 0;
      }
      return value !== undefined && value !== null;
    },
    message: `${fieldName} is required`
  }),

  minLength: (length: number, fieldName: string): ValidationRule<string> => ({
    validate: (value: string) => value.length >= length,
    message: `${fieldName} must be at least ${length} characters`
  }),

  maxLength: (length: number, fieldName: string): ValidationRule<string> => ({
    validate: (value: string) => value.length <= length,
    message: `${fieldName} cannot exceed ${length} characters`
  }),

  numeric: (fieldName: string): ValidationRule<string> => ({
    validate: (value: string) => !isNaN(Number(value)),
    message: `${fieldName} must be a number`
  }),

  positiveNumber: (fieldName: string): ValidationRule<number> => ({
    validate: (value: number) => value >= 0,
    message: `${fieldName} must be a positive number`
  }),

  dateFormat: (fieldName: string): ValidationRule<string> => ({
    validate: (value: string) => {
      const date = new Date(value);
      return !isNaN(date.getTime());
    },
    message: `${fieldName} must be a valid date`
  }),

  futureDate: (fieldName: string): ValidationRule<string> => ({
    validate: (value: string) => {
      const date = new Date(value);
      return date > new Date();
    },
    message: `${fieldName} must be in the future`
  }),

  validStatus: (statuses: string[]): ValidationRule<string> => ({
    validate: (value: string) => statuses.includes(value.toUpperCase()),
    message: `Status must be one of: ${statuses.join(', ')}`
  }),

  validPriority: (priorities: string[]): ValidationRule<string> => ({
    validate: (value: string) => priorities.includes(value.toUpperCase()),
    message: `Priority must be one of: ${priorities.join(', ')}`
  }),
};

export type ValidationRuleType = keyof typeof validationRules;
