import { useState, useEffect } from 'react';

/**
 * Hook para persistir estado no localStorage
 * @param key Chave do localStorage
 * @param defaultValue Valor padrão se não houver no localStorage
 * @param options Opções para serialização customizada
 * @returns [value, setValue] similar ao useState
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T,
  options?: {
    serialize?: (value: T) => string;
    deserialize?: (value: string) => T;
  }
) {
  const [state, setState] = useState<T>(() => {
    try {
      if (typeof window === 'undefined') return defaultValue;
      const saved = localStorage.getItem(key);
      if (saved && saved !== 'undefined' && saved !== 'null') {
        const result = options?.deserialize ? options.deserialize(saved) : JSON.parse(saved);
        // Validate that the result is not undefined or null unless that's the default
        if (result !== undefined && result !== null) {
          return result;
        }
      }
      return defaultValue;
    } catch (error) {
      console.warn(`Failed to load ${key} from localStorage:`, error);
      // Clear potentially corrupted data
      try {
        localStorage.removeItem(key);
      } catch {}
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      const serialized = options?.serialize ? options.serialize(state) : JSON.stringify(state);
      localStorage.setItem(key, serialized);
    } catch (error) {
      console.warn(`Failed to save ${key} to localStorage:`, error);
    }
  }, [key, state, options]);

  return [state, setState] as const;
}

/**
 * Hook específico para filtros do dashboard
 */
export function useDashboardFilters() {
  return usePersistentState('dashboard_filters', {
    selectedDate: new Date().toISOString().split('T')[0], // Data atual
    searchValue: '',
    currentPage: 1,
    statusFilter: 'all' as 'all' | 'pending' | 'conferred' | 'not_found',
    conferenceValue: ''
  });
}