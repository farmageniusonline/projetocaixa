import { useCallback, useMemo } from 'react';
import type { ConferenceHistoryEntry } from '../lib/storageAdapter';
import { useLookupMap } from './useLookupMap';
import { useSearchOperations, type SearchOptions, type SearchResult } from './useSearchOperations';
import { useValueNormalization } from './useValueNormalization';

/**
 * Refactored useValueLookup hook with better separation of concerns
 * Main orchestrator that combines specialized hooks
 */
export function useValueLookup() {
  const lookupMap = useLookupMap();
  const searchOps = useSearchOperations();
  const valueNorm = useValueNormalization();

  // Initialize lookup map with entries
  const initializeLookup = useCallback((entries: ConferenceHistoryEntry[]) => {
    lookupMap.updateLookupMap(entries);
  }, [lookupMap]);

  // Get all entries as a flat array for search operations
  const getAllEntries = useMemo(() => {
    const allEntries = [];
    for (const entries of lookupMap.lookupMap.lookup.values()) {
      allEntries.push(...entries);
    }
    return allEntries;
  }, [lookupMap.lookupMap.lookup]);

  // Main search function with all options
  const searchByValue = useCallback((
    searchValue: string | number,
    options?: SearchOptions
  ): SearchResult => {
    return searchOps.search(searchValue, getAllEntries, options);
  }, [searchOps, getAllEntries]);

  // Quick lookup for exact value matches (optimized)
  const findExactMatches = useCallback((value: number) => {
    return lookupMap.findByValue(value);
  }, [lookupMap]);

  // Find approximate matches within a tolerance
  const findApproximateMatches = useCallback((
    value: number,
    tolerance: number = 0.01
  ) => {
    const minValue = value - tolerance;
    const maxValue = value + tolerance;
    return lookupMap.findByValueRange(minValue, maxValue);
  }, [lookupMap]);

  // Get suggestions for autocomplete
  const getSuggestions = useCallback((
    partialValue: string,
    maxSuggestions?: number
  ) => {
    return searchOps.getSearchSuggestions(partialValue, getAllEntries, maxSuggestions);
  }, [searchOps, getAllEntries]);

  // Advanced search with multiple criteria
  const advancedSearch = useCallback((criteria: {
    value?: number;
    description?: string;
    source?: string[];
    status?: string[];
    dateRange?: { start: string; end: string };
  }) => {
    const { value, description, source, status, dateRange } = criteria;

    let results = getAllEntries;

    // Filter by value if provided
    if (value !== undefined) {
      const exactMatches = findExactMatches(value);
      results = exactMatches;
    }

    // Filter by description if provided
    if (description) {
      const searchTerm = description.toLowerCase();
      results = results.filter(entry =>
        entry.description?.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by source if provided
    if (source?.length) {
      results = results.filter(entry => source.includes(entry.source));
    }

    // Filter by status if provided
    if (status?.length) {
      results = results.filter(entry => status.includes(entry.status));
    }

    // Filter by date range if provided
    if (dateRange) {
      results = results.filter(entry => {
        if (!entry.date) return false;
        return entry.date >= dateRange.start && entry.date <= dateRange.end;
      });
    }

    return results;
  }, [getAllEntries, findExactMatches]);

  // Get analytics about the lookup data
  const getAnalytics = useCallback(() => {
    const stats = lookupMap.getStats();
    const sourceDistribution = searchOps.groupBySource(getAllEntries);
    const statusDistribution = searchOps.groupByStatus(getAllEntries);

    return {
      ...stats,
      sourceDistribution: Object.entries(sourceDistribution).map(([source, entries]) => ({
        source,
        count: entries.length,
        percentage: (entries.length / stats.totalEntries) * 100
      })),
      statusDistribution: Object.entries(statusDistribution).map(([status, entries]) => ({
        status,
        count: entries.length,
        percentage: (entries.length / stats.totalEntries) * 100
      }))
    };
  }, [lookupMap, searchOps, getAllEntries]);

  // Validate value format
  const validateValue = useCallback((input: string | number): {
    isValid: boolean;
    normalized?: number;
    error?: string;
  } => {
    try {
      const normalized = valueNorm.normalizeValue(input);

      if (normalized === 0 && input !== 0 && input !== '0') {
        return {
          isValid: false,
          error: 'Valor inválido'
        };
      }

      if (normalized < 0) {
        return {
          isValid: false,
          error: 'Valor deve ser positivo'
        };
      }

      return {
        isValid: true,
        normalized
      };
    } catch (error) {
      return {
        isValid: false,
        error: 'Formato de valor inválido'
      };
    }
  }, [valueNorm]);

  // Export data for backup/analysis
  const exportLookupData = useCallback(() => {
    return {
      metadata: lookupMap.getStats(),
      entries: getAllEntries,
      exportedAt: new Date().toISOString()
    };
  }, [lookupMap, getAllEntries]);

  return {
    // Core operations
    initializeLookup,
    searchByValue,
    findExactMatches,
    findApproximateMatches,
    advancedSearch,

    // Utility functions
    getSuggestions,
    validateValue,
    getAnalytics,
    exportLookupData,

    // State information
    isLoading: lookupMap.isEmpty,
    isEmpty: lookupMap.isEmpty,
    stats: lookupMap.getStats(),

    // Direct access to sub-hooks for advanced usage
    lookupMap: lookupMap.lookupMap,
    clearData: lookupMap.clearLookupMap
  };
}

// Legacy compatibility - re-export the old interface
export type { LookupEntry } from './useLookupMap';
export { useValueNormalization, useLookupMap, useSearchOperations };