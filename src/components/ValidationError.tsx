import React from 'react';

interface ValidationErrorProps {
  error?: string | null;
  className?: string;
  fieldId?: string;
}

/**
 * Accessible validation error component
 * Follows a11y best practices for form validation
 */
export const ValidationError: React.FC<ValidationErrorProps> = ({
  error,
  className = '',
  fieldId
}) => {
  if (!error) return null;

  const errorId = fieldId ? `${fieldId}-error` : undefined;

  return (
    <div
      id={errorId}
      className={`mt-1 text-sm text-red-400 flex items-start space-x-2 ${className}`}
      role="alert"
      aria-live="polite"
    >
      <svg
        className="w-4 h-4 mt-0.5 flex-shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      <span>{error}</span>
    </div>
  );
};

interface ValidationSuccessProps {
  message?: string | null;
  className?: string;
}

/**
 * Accessible validation success component
 */
export const ValidationSuccess: React.FC<ValidationSuccessProps> = ({
  message,
  className = ''
}) => {
  if (!message) return null;

  return (
    <div
      className={`mt-1 text-sm text-green-400 flex items-start space-x-2 ${className}`}
      role="status"
      aria-live="polite"
    >
      <svg
        className="w-4 h-4 mt-0.5 flex-shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
      <span>{message}</span>
    </div>
  );
};

interface FieldWrapperProps {
  children: React.ReactNode;
  error?: string | null;
  success?: string | null;
  fieldId?: string;
  className?: string;
}

/**
 * Wrapper component that handles validation state
 */
export const FieldWrapper: React.FC<FieldWrapperProps> = ({
  children,
  error,
  success,
  fieldId,
  className = ''
}) => {
  return (
    <div className={className}>
      {children}
      <ValidationError error={error} fieldId={fieldId} />
      <ValidationSuccess message={success} />
    </div>
  );
};

/**
 * Hook to get field validation attributes
 */
export const useFieldValidation = (fieldId: string, error?: string | null) => {
  const hasError = Boolean(error);
  const errorId = hasError ? `${fieldId}-error` : undefined;

  return {
    'aria-invalid': hasError,
    'aria-describedby': errorId,
    className: hasError
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
      : 'border-gray-600 focus:border-indigo-500 focus:ring-indigo-500'
  };
};