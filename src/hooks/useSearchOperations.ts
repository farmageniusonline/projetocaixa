import { useCallback, useMemo } from 'react';
import type { LookupEntry } from './useLookupMap';
import { useValueNormalization } from './useValueNormalization';

export interface SearchResult {
  exact: LookupEntry[];
  approximate: LookupEntry[];
  fuzzy: LookupEntry[];
  total: number;
}

export interface SearchOptions {
  exactMatch?: boolean;
  approximateThreshold?: number;
  fuzzySearch?: boolean;
  includeArchived?: boolean;
  filterBySource?: LookupEntry['source'][];
  filterByStatus?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
}

/**
 * Hook for search operations on lookup data
 * Extracted for focused search functionality
 */
export function useSearchOperations() {
  const { normalizeValue, valuesAreEqual } = useValueNormalization();

  // Perform comprehensive search
  const search = useCallback((
    searchValue: string | number,
    allEntries: LookupEntry[],
    options: SearchOptions = {}
  ): SearchResult => {
    const {
      exactMatch = true,
      approximateThreshold = 0.01,
      fuzzySearch = false,
      includeArchived = false,
      filterBySource,
      filterByStatus,
      dateRange
    } = options;

    const normalizedValue = normalizeValue(searchValue);
    if (normalizedValue === 0) {
      return { exact: [], approximate: [], fuzzy: [], total: 0 };
    }

    // Filter entries based on options
    let filteredEntries = allEntries;

    if (!includeArchived) {
      filteredEntries = filteredEntries.filter(entry => entry.status !== 'archived');
    }

    if (filterBySource?.length) {
      filteredEntries = filteredEntries.filter(entry => filterBySource.includes(entry.source));
    }

    if (filterByStatus?.length) {
      filteredEntries = filteredEntries.filter(entry => filterByStatus.includes(entry.status));
    }

    if (dateRange) {
      filteredEntries = filteredEntries.filter(entry => {
        if (!entry.date) return false;
        return entry.date >= dateRange.start && entry.date <= dateRange.end;
      });
    }

    const exact: LookupEntry[] = [];
    const approximate: LookupEntry[] = [];
    const fuzzy: LookupEntry[] = [];

    for (const entry of filteredEntries) {
      // Exact match
      if (exactMatch && valuesAreEqual(entry.value, normalizedValue, 0.001)) {
        exact.push(entry);
        continue;
      }

      // Approximate match
      if (valuesAreEqual(entry.value, normalizedValue, approximateThreshold)) {
        approximate.push(entry);
        continue;
      }

      // Fuzzy search (description, document number)
      if (fuzzySearch && typeof searchValue === 'string') {
        const searchTerm = searchValue.toLowerCase();
        const description = entry.description?.toLowerCase() || '';
        const documentNumber = entry.document_number?.toLowerCase() || '';

        if (description.includes(searchTerm) || documentNumber.includes(searchTerm)) {
          fuzzy.push(entry);
        }
      }
    }

    return {
      exact,
      approximate,
      fuzzy,
      total: exact.length + approximate.length + fuzzy.length
    };
  }, [normalizeValue, valuesAreEqual]);

  // Quick exact match search
  const findExactMatches = useCallback((
    searchValue: number,
    allEntries: LookupEntry[]
  ): LookupEntry[] => {
    return allEntries.filter(entry => valuesAreEqual(entry.value, searchValue, 0.001));
  }, [valuesAreEqual]);

  // Find similar values within a percentage range
  const findSimilarValues = useCallback((
    targetValue: number,
    allEntries: LookupEntry[],
    percentageThreshold: number = 5 // 5% tolerance
  ): LookupEntry[] => {
    const tolerance = targetValue * (percentageThreshold / 100);
    const minValue = targetValue - tolerance;
    const maxValue = targetValue + tolerance;

    return allEntries.filter(entry =>
      entry.value >= minValue && entry.value <= maxValue
    );
  }, []);

  // Group search results by source
  const groupBySource = useCallback((entries: LookupEntry[]) => {
    return entries.reduce((acc, entry) => {
      if (!acc[entry.source]) {
        acc[entry.source] = [];
      }
      acc[entry.source].push(entry);
      return acc;
    }, {} as Record<LookupEntry['source'], LookupEntry[]>);
  }, []);

  // Group search results by status
  const groupByStatus = useCallback((entries: LookupEntry[]) => {
    return entries.reduce((acc, entry) => {
      if (!acc[entry.status]) {
        acc[entry.status] = [];
      }
      acc[entry.status].push(entry);
      return acc;
    }, {} as Record<string, LookupEntry[]>);
  }, []);

  // Sort entries by relevance
  const sortByRelevance = useCallback((
    entries: LookupEntry[],
    targetValue: number
  ): LookupEntry[] => {
    return [...entries].sort((a, b) => {
      // Primary sort: exact matches first
      const aExact = valuesAreEqual(a.value, targetValue, 0.001);
      const bExact = valuesAreEqual(b.value, targetValue, 0.001);

      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // Secondary sort: closest value
      const aDiff = Math.abs(a.value - targetValue);
      const bDiff = Math.abs(b.value - targetValue);

      if (aDiff !== bDiff) return aDiff - bDiff;

      // Tertiary sort: newest first (if dates available)
      if (a.date && b.date) {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }

      return 0;
    });
  }, [valuesAreEqual]);

  // Get search suggestions based on partial input
  const getSearchSuggestions = useCallback((
    partialValue: string,
    allEntries: LookupEntry[],
    maxSuggestions: number = 10
  ): number[] => {
    if (!partialValue || partialValue.length < 2) return [];

    const partial = parseFloat(partialValue);
    if (isNaN(partial)) return [];

    // Find values that start with the partial value
    const uniqueValues = new Set<number>();

    for (const entry of allEntries) {
      const valueStr = entry.value.toString();
      if (valueStr.startsWith(partialValue)) {
        uniqueValues.add(entry.value);
      }
    }

    return Array.from(uniqueValues)
      .sort((a, b) => a - b)
      .slice(0, maxSuggestions);
  }, []);

  return {
    search,
    findExactMatches,
    findSimilarValues,
    groupBySource,
    groupByStatus,
    sortByRelevance,
    getSearchSuggestions
  };
}