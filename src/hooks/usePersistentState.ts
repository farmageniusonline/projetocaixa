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
      const saved = localStorage.getItem(key);
      if (saved) {
        return options?.deserialize ? options.deserialize(saved) : JSON.parse(saved);
      }
      return defaultValue;
    } catch {
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