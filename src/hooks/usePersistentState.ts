import { useState } from 'react';

/**
 * Hook para estado temporário (apenas em memória)
 * Substitui o antigo localStorage para usar apenas Supabase
 * @param key Chave (mantida para compatibilidade)
 * @param defaultValue Valor padrão
 * @param options Opções (mantidas para compatibilidade)
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
  // Usar apenas estado em memória - dados persistem no Supabase
  const [state, setState] = useState<T>(defaultValue);

  return [state, setState] as const;
}

/**
 * Hook específico para filtros do dashboard
 */
export function useDashboardFilters() {
  return usePersistentState('dashboard_filters', {
    selectedDate: new Date().toISOString().split('T')[0], // Data atual em formato ISO para input HTML
    searchValue: '',
    currentPage: 1,
    statusFilter: 'all' as 'all' | 'pending' | 'conferred' | 'not_found',
    conferenceValue: ''
  });
}