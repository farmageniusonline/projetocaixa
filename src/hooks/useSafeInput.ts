/**
 * React hook for safe input handling with sanitization and validation
 */

import { useState, useCallback, useMemo } from 'react';
import { sanitizeInput, validateInputSafety } from '../utils/input-sanitization';
import { createModuleLogger } from '../utils/logger';

const securityLogger = createModuleLogger('INPUT_SECURITY');

export interface SafeInputOptions {
  type?: 'text' | 'html' | 'email' | 'url' | 'cpf' | 'cnpj' | 'currency' | 'phone' | 'filename' | 'date';
  maxLength?: number;
  allowHtml?: boolean;
  strictMode?: boolean;
  validateOnChange?: boolean;
  debounceMs?: number;
}

export interface SafeInputState {
  value: string;
  sanitizedValue: string;
  isValid: boolean;
  violations: string[];
  error?: string;
}

export interface SafeInputHandlers {
  setValue: (value: string) => void;
  reset: () => void;
  validate: () => boolean;
  getSanitized: () => string;
}

/**
 * Hook for safe input handling with automatic sanitization and validation
 */
export function useSafeInput(
  initialValue: string = '',
  options: SafeInputOptions = {}
): SafeInputState & SafeInputHandlers {
  const {
    type = 'text',
    maxLength = 1000,
    allowHtml = false,
    strictMode = true,
    validateOnChange = true,
    debounceMs = 0
  } = options;

  const [rawValue, setRawValue] = useState(initialValue);
  const [error, setError] = useState<string>();

  // Memoized sanitization and validation
  const { sanitizedValue, isValid, violations } = useMemo(() => {
    try {
      const sanitized = sanitizeInput(rawValue, {
        type,
        maxLength,
        allowHtml,
        strictMode
      });

      if (validateOnChange) {
        const safety = validateInputSafety(rawValue);

        if (!safety.isSafe) {
          securityLogger.warn('Unsafe input detected', {
            violations: safety.violations,
            input: rawValue.substring(0, 50)
          });
        }

        return {
          sanitizedValue: sanitized,
          isValid: safety.isSafe,
          violations: safety.violations
        };
      }

      return {
        sanitizedValue: sanitized,
        isValid: true,
        violations: []
      };
    } catch (err) {
      securityLogger.error('Input sanitization failed', { error: err, input: rawValue });
      return {
        sanitizedValue: '',
        isValid: false,
        violations: ['Sanitization failed']
      };
    }
  }, [rawValue, type, maxLength, allowHtml, strictMode, validateOnChange]);

  // Debounced setter
  const setValue = useCallback(
    debounceMs > 0
      ? debounce((value: string) => {
          setRawValue(value);
          setError(undefined);
        }, debounceMs)
      : (value: string) => {
          setRawValue(value);
          setError(undefined);
        },
    [debounceMs]
  );

  // Reset function
  const reset = useCallback(() => {
    setRawValue(initialValue);
    setError(undefined);
  }, [initialValue]);

  // Manual validation
  const validate = useCallback(() => {
    const safety = validateInputSafety(rawValue);

    if (!safety.isSafe) {
      const errorMessage = `Input validation failed: ${safety.violations.join(', ')}`;
      setError(errorMessage);
      securityLogger.warn('Manual validation failed', { violations: safety.violations });
      return false;
    }

    setError(undefined);
    return true;
  }, [rawValue]);

  // Get sanitized value
  const getSanitized = useCallback(() => {
    return sanitizedValue;
  }, [sanitizedValue]);

  return {
    value: rawValue,
    sanitizedValue,
    isValid,
    violations,
    error,
    setValue,
    reset,
    validate,
    getSanitized
  };
}

/**
 * Hook for form fields with built-in sanitization
 */
export function useSafeFormField(
  name: string,
  initialValue: string = '',
  options: SafeInputOptions = {}
) {
  const safeInput = useSafeInput(initialValue, options);

  // Form field compatible handlers
  const onChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    safeInput.setValue(event.target.value);
  }, [safeInput]);

  const onBlur = useCallback(() => {
    safeInput.validate();
  }, [safeInput]);

  return {
    ...safeInput,
    name,
    onChange,
    onBlur,
    // React Hook Form compatible
    register: {
      name,
      value: safeInput.sanitizedValue,
      onChange,
      onBlur
    }
  };
}

/**
 * Hook for multiple safe inputs
 */
export function useSafeInputs<T extends Record<string, SafeInputOptions>>(
  fields: T,
  initialValues: Partial<Record<keyof T, string>> = {}
) {
  const inputs = useMemo(() => {
    const result: Record<keyof T, ReturnType<typeof useSafeInput>> = {} as any;

    for (const [fieldName, options] of Object.entries(fields)) {
      const initialValue = initialValues[fieldName as keyof T] || '';
      // eslint-disable-next-line react-hooks/rules-of-hooks
      result[fieldName as keyof T] = useSafeInput(initialValue, options);
    }

    return result;
  }, [fields, initialValues]);

  // Validate all fields
  const validateAll = useCallback(() => {
    const results = Object.values(inputs).map(input => input.validate());
    return results.every(Boolean);
  }, [inputs]);

  // Reset all fields
  const resetAll = useCallback(() => {
    Object.values(inputs).forEach(input => input.reset());
  }, [inputs]);

  // Get all sanitized values
  const getAllSanitized = useCallback(() => {
    const result: Record<keyof T, string> = {} as any;
    for (const [key, input] of Object.entries(inputs)) {
      result[key as keyof T] = input.getSanitized();
    }
    return result;
  }, [inputs]);

  // Check if all inputs are valid
  const allValid = useMemo(() => {
    return Object.values(inputs).every(input => input.isValid);
  }, [inputs]);

  return {
    inputs,
    validateAll,
    resetAll,
    getAllSanitized,
    allValid
  };
}

/**
 * Simple debounce utility
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Hook for safe search input with history
 */
export function useSafeSearch(options: SafeInputOptions & { historyKey?: string } = {}) {
  const { historyKey, ...inputOptions } = options;
  const safeInput = useSafeInput('', { ...inputOptions, debounceMs: 300 });

  // Search history management
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    if (historyKey && typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(`search_history_${historyKey}`);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  // Add to search history
  const addToHistory = useCallback((query: string) => {
    if (!query.trim() || !historyKey) return;

    const sanitizedQuery = sanitizeInput(query, inputOptions);
    if (!sanitizedQuery) return;

    setSearchHistory(prev => {
      const newHistory = [sanitizedQuery, ...prev.filter(item => item !== sanitizedQuery)].slice(0, 10);

      try {
        localStorage.setItem(`search_history_${historyKey}`, JSON.stringify(newHistory));
      } catch {
        // Ignore localStorage errors
      }

      return newHistory;
    });
  }, [historyKey, inputOptions]);

  // Clear search history
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    if (historyKey && typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(`search_history_${historyKey}`);
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [historyKey]);

  // Execute search
  const executeSearch = useCallback(() => {
    if (safeInput.isValid && safeInput.sanitizedValue.trim()) {
      addToHistory(safeInput.sanitizedValue);
      return safeInput.sanitizedValue;
    }
    return null;
  }, [safeInput, addToHistory]);

  return {
    ...safeInput,
    searchHistory,
    addToHistory,
    clearHistory,
    executeSearch
  };
}

export default useSafeInput;