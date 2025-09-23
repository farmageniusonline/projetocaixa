import { useMemo } from 'react';
import { ValueMatch } from '../utils/valueNormalizer';
import { ConferenceHistoryEntry } from '../services/indexedDbService';

export interface TableFilters {
  dateFilter: string;
  typeFilter: string;
  statusFilter: string;
  searchText: string;
  minValue?: number;
  maxValue?: number;
}

export interface TableStats {
  totalItems: number;
  totalValue: number;
  itemsByStatus: Record<string, number>;
  itemsByType: Record<string, number>;
  averageValue: number;
  filteredCount: number;
  filteredValue: number;
}

// Banking table selectors
export function useBankingTableSelectors(
  parseResult: { data: ValueMatch[] } | null,
  transferredIds: Set<string>,
  filters: TableFilters
) {
  // Memoized filtered data
  const filteredData = useMemo(() => {
    if (!parseResult?.data) return [];

    // Convert Set to Array to force React to detect changes properly
    const transferredIdsArray = Array.from(transferredIds);
    const transferredIdsSize = transferredIds.size;

    console.debug('🔍 Starting filtering process:', {
      totalItems: parseResult.data.length,
      transferredIdsSize,
      transferredIdsArray,
      filters
    });

    const filtered = parseResult.data.filter(item => {
      // Skip transferred items
      const isTransferred = transferredIds.has(item.id);
      if (isTransferred) {
        console.debug(`❌ Filtering out transferred item: ${item.id} (value: ${item.value})`);
        return false;
      }

      // Date filter
      if (filters.dateFilter && !item.date?.includes(filters.dateFilter)) {
        return false;
      }

      // Type filter
      if (filters.typeFilter && filters.typeFilter !== 'all') {
        if (item.paymentType !== filters.typeFilter) return false;
      }

      // Search text filter
      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase();
        const searchableText = [
          item.originalHistory,
          item.description,
          item.cpf,
          item.value?.toString()
        ].join(' ').toLowerCase();

        if (!searchableText.includes(searchLower)) return false;
      }

      // Value range filter
      if (filters.minValue !== undefined && item.value < filters.minValue) {
        return false;
      }
      if (filters.maxValue !== undefined && item.value > filters.maxValue) {
        return false;
      }

      console.debug(`✅ Item passed filters: ${item.id} (value: ${item.value})`);
      return true;
    });

    console.debug('🎯 Table filtering results:', {
      totalItems: parseResult?.data?.length || 0,
      transferredIdsSize,
      transferredIdsArray,
      filteredCount: filtered.length,
      itemsFiltered: parseResult.data.length - filtered.length,
      sampleFilteredIds: filtered.slice(0, 5).map(item => item.id),
      transferredItemsInData: parseResult.data.filter(item => transferredIds.has(item.id)).map(item => item.id)
    });

    return filtered;
  }, [parseResult?.data, transferredIds, transferredIds.size, filters]);

  // Memoized statistics
  const stats = useMemo((): TableStats => {
    const allData = parseResult?.data || [];
    const availableData = allData.filter(item => !transferredIds.has(item.id));

    const totalValue = availableData.reduce((sum, item) => sum + (item.value || 0), 0);
    const filteredValue = filteredData.reduce((sum, item) => sum + (item.value || 0), 0);

    // Count by status
    const itemsByStatus: Record<string, number> = {};
    availableData.forEach(item => {
      const status = item.validationStatus || 'unknown';
      itemsByStatus[status] = (itemsByStatus[status] || 0) + 1;
    });

    // Count by type
    const itemsByType: Record<string, number> = {};
    availableData.forEach(item => {
      const type = item.paymentType || 'OUTROS';
      itemsByType[type] = (itemsByType[type] || 0) + 1;
    });

    return {
      totalItems: availableData.length,
      totalValue,
      itemsByStatus,
      itemsByType,
      averageValue: availableData.length > 0 ? totalValue / availableData.length : 0,
      filteredCount: filteredData.length,
      filteredValue
    };
  }, [parseResult?.data, transferredIds, filteredData]);

  // Memoized sorted data
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      // Sort by value descending by default
      return (b.value || 0) - (a.value || 0);
    });
  }, [filteredData]);

  return {
    filteredData: sortedData,
    stats,
    isEmpty: sortedData.length === 0,
    hasFilters: Object.values(filters).some(value =>
      value !== '' && value !== 'all' && value !== undefined
    )
  };
}

// Cash conference table selectors
export function useCashTableSelectors(
  conferredItems: Array<ValueMatch & { conferredAt: Date; conferredId: string }>,
  filters: TableFilters
) {
  // Memoized filtered data
  const filteredData = useMemo(() => {
    return conferredItems.filter(item => {
      // Date filter (check conferredAt date)
      if (filters.dateFilter) {
        const itemDate = item.conferredAt.toLocaleDateString('pt-BR');
        if (!itemDate.includes(filters.dateFilter)) return false;
      }

      // Type filter
      if (filters.typeFilter && filters.typeFilter !== 'all') {
        if (item.paymentType !== filters.typeFilter) return false;
      }

      // Search text filter
      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase();
        const searchableText = [
          item.originalHistory,
          item.description,
          item.cpf,
          item.value?.toString(),
          item.conferredId
        ].join(' ').toLowerCase();

        if (!searchableText.includes(searchLower)) return false;
      }

      // Value range filter
      if (filters.minValue !== undefined && item.value < filters.minValue) {
        return false;
      }
      if (filters.maxValue !== undefined && item.value > filters.maxValue) {
        return false;
      }

      return true;
    });
  }, [conferredItems, filters]);

  // Memoized statistics
  const stats = useMemo((): TableStats => {
    const totalValue = conferredItems.reduce((sum, item) => sum + (item.value || 0), 0);
    const filteredValue = filteredData.reduce((sum, item) => sum + (item.value || 0), 0);

    // Count by type
    const itemsByType: Record<string, number> = {};
    conferredItems.forEach(item => {
      const type = item.paymentType || 'OUTROS';
      itemsByType[type] = (itemsByType[type] || 0) + 1;
    });

    // Count by status (all conferred)
    const itemsByStatus = { conferred: conferredItems.length };

    return {
      totalItems: conferredItems.length,
      totalValue,
      itemsByStatus,
      itemsByType,
      averageValue: conferredItems.length > 0 ? totalValue / conferredItems.length : 0,
      filteredCount: filteredData.length,
      filteredValue
    };
  }, [conferredItems, filteredData]);

  // Memoized sorted data
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      // Sort by conferredAt descending (most recent first)
      return b.conferredAt.getTime() - a.conferredAt.getTime();
    });
  }, [filteredData]);

  return {
    filteredData: sortedData,
    stats,
    isEmpty: sortedData.length === 0,
    hasFilters: Object.values(filters).some(value =>
      value !== '' && value !== 'all' && value !== undefined
    )
  };
}

// History table selectors
export function useHistoryTableSelectors(
  historyData: ConferenceHistoryEntry[],
  filters: TableFilters
) {
  // Memoized filtered data
  const filteredData = useMemo(() => {
    return historyData.filter(entry => {
      // Date filter
      if (filters.dateFilter && !entry.operation_date?.includes(filters.dateFilter)) {
        return false;
      }

      // Type filter by operation_type
      if (filters.typeFilter && filters.typeFilter !== 'all') {
        if (entry.operation_type !== filters.typeFilter) return false;
      }

      // Status filter
      if (filters.statusFilter && filters.statusFilter !== 'all') {
        if (entry.status !== filters.statusFilter) return false;
      }

      // Search text filter
      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase();
        const searchableText = [
          entry.description,
          entry.document_number,
          entry.value?.toString(),
          entry.operation_type,
          entry.status
        ].join(' ').toLowerCase();

        if (!searchableText.includes(searchLower)) return false;
      }

      // Value range filter
      if (filters.minValue !== undefined && (entry.value || 0) < filters.minValue) {
        return false;
      }
      if (filters.maxValue !== undefined && (entry.value || 0) > filters.maxValue) {
        return false;
      }

      return true;
    });
  }, [historyData, filters]);

  // Memoized statistics
  const stats = useMemo((): TableStats => {
    const totalValue = historyData.reduce((sum, entry) => sum + (entry.value || 0), 0);
    const filteredValue = filteredData.reduce((sum, entry) => sum + (entry.value || 0), 0);

    // Count by status
    const itemsByStatus: Record<string, number> = {};
    historyData.forEach(entry => {
      const status = entry.status || 'unknown';
      itemsByStatus[status] = (itemsByStatus[status] || 0) + 1;
    });

    // Count by operation type
    const itemsByType: Record<string, number> = {};
    historyData.forEach(entry => {
      const type = entry.operation_type || 'unknown';
      itemsByType[type] = (itemsByType[type] || 0) + 1;
    });

    return {
      totalItems: historyData.length,
      totalValue,
      itemsByStatus,
      itemsByType,
      averageValue: historyData.length > 0 ? totalValue / historyData.length : 0,
      filteredCount: filteredData.length,
      filteredValue
    };
  }, [historyData, filteredData]);

  // Memoized sorted data
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      // Sort by operation timestamp descending (most recent first)
      const timeA = new Date(a.operation_timestamp || '').getTime();
      const timeB = new Date(b.operation_timestamp || '').getTime();
      return timeB - timeA;
    });
  }, [filteredData]);

  return {
    filteredData: sortedData,
    stats,
    isEmpty: sortedData.length === 0,
    hasFilters: Object.values(filters).some(value =>
      value !== '' && value !== 'all' && value !== undefined
    )
  };
}

// Utility function to format currency values for display
export function formatCurrencyMemo(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

// Utility function to format percentage values
export function formatPercentageMemo(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}