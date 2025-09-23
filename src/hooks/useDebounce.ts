import { useState, useEffect } from 'react';

/**
 * Hook personalizado para implementar debounce
 * @param value - Valor a ser "debounced"
 * @param delay - Delay em milliseconds
 * @returns Valor com debounce aplicado
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook para debounced callback
 * @param callback - Função a ser executada
 * @param delay - Delay em milliseconds
 * @param deps - Dependencies array
 * @returns Função com debounce aplicado
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): T {
  const [debouncedCallback, setDebouncedCallback] = useState<T>();

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedCallback(() => callback);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [...deps, delay]);

  return debouncedCallback || callback;
}