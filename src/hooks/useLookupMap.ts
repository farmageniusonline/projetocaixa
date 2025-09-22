import { useState, useCallback, useMemo } from 'react';
import type { ConferenceHistoryEntry } from '../services/indexedDbService';
import { useValueNormalization } from './useValueNormalization';
import { perfLogger } from '../utils/logger';

export interface LookupEntry {
  id: string | number;
  source: 'banking_upload' | 'cash_conference' | 'manual_entry' | 'not_found_manual';
  value: number;
  value_cents: number;
  status: string;
  description?: string;
  document_number?: string;
  date?: string;
  entry: ConferenceHistoryEntry;
}

export interface ValueLookupMap {
  lookup: Map<number, LookupEntry[]>;
  totalEntries: number;
  uniqueValues: number;
  lastUpdated: Date;
}

export interface LookupMapStats {
  totalEntries: number;
  uniqueValues: number;
  averageEntriesPerValue: number;
  buildTime: number;
  lastUpdated: Date;
}

/**
 * Hook for managing value lookup maps
 * Separated from useValueLookup for better maintainability
 */
export function useLookupMap() {
  const [lookupMap, setLookupMap] = useState<ValueLookupMap>({
    lookup: new Map(),
    totalEntries: 0,
    uniqueValues: 0,
    lastUpdated: new Date()
  });

  const { valueToCents } = useValueNormalization();

  // Build lookup map from conference history entries
  const buildLookupMap = useCallback((entries: ConferenceHistoryEntry[]): ValueLookupMap => {
    const startTime = performance.now();
    const lookup = new Map<number, LookupEntry[]>();
    let totalEntries = 0;

    perfLogger.debug('Building lookup map', { entriesCount: entries.length });

    for (const entry of entries) {
      if (!entry.value || entry.value === 0) continue;

      const valueCents = valueToCents(entry.value);
      const lookupEntry: LookupEntry = {
        id: entry.id!,
        source: entry.source as LookupEntry['source'],
        value: entry.value,
        value_cents: valueCents,
        status: entry.status || 'pending',
        description: entry.description,
        document_number: entry.document_number,
        date: entry.date,
        entry
      };

      if (!lookup.has(valueCents)) {
        lookup.set(valueCents, []);
      }
      lookup.get(valueCents)!.push(lookupEntry);
      totalEntries++;
    }

    const buildTime = performance.now() - startTime;
    const result: ValueLookupMap = {
      lookup,
      totalEntries,
      uniqueValues: lookup.size,
      lastUpdated: new Date()
    };

    perfLogger.debug('Lookup map built', {
      buildTime: `${buildTime.toFixed(2)}ms`,
      totalEntries,
      uniqueValues: lookup.size,
      averagePerValue: (totalEntries / lookup.size).toFixed(1)
    });

    return result;
  }, [valueToCents]);

  // Update the lookup map with new entries
  const updateLookupMap = useCallback((entries: ConferenceHistoryEntry[]) => {
    const newMap = buildLookupMap(entries);
    setLookupMap(newMap);
  }, [buildLookupMap]);

  // Find entries by value in cents
  const findByValueCents = useCallback((valueCents: number): LookupEntry[] => {
    return lookupMap.lookup.get(valueCents) || [];
  }, [lookupMap.lookup]);

  // Find entries by decimal value
  const findByValue = useCallback((value: number): LookupEntry[] => {
    const valueCents = valueToCents(value);
    return findByValueCents(valueCents);
  }, [valueToCents, findByValueCents]);

  // Find entries with value range (useful for approximate matching)
  const findByValueRange = useCallback((
    minValue: number,
    maxValue: number
  ): LookupEntry[] => {
    const minCents = valueToCents(minValue);
    const maxCents = valueToCents(maxValue);
    const results: LookupEntry[] = [];

    for (const [valueCents, entries] of lookupMap.lookup) {
      if (valueCents >= minCents && valueCents <= maxCents) {
        results.push(...entries);
      }
    }

    return results;
  }, [lookupMap.lookup, valueToCents]);

  // Get statistics about the lookup map
  const getStats = useCallback((): LookupMapStats => {
    const { totalEntries, uniqueValues, lastUpdated } = lookupMap;
    return {
      totalEntries,
      uniqueValues,
      averageEntriesPerValue: uniqueValues > 0 ? totalEntries / uniqueValues : 0,
      buildTime: 0, // Would need to track this separately
      lastUpdated
    };
  }, [lookupMap]);

  // Clear the lookup map
  const clearLookupMap = useCallback(() => {
    setLookupMap({
      lookup: new Map(),
      totalEntries: 0,
      uniqueValues: 0,
      lastUpdated: new Date()
    });
  }, []);

  // Check if lookup map is empty
  const isEmpty = useMemo(() => {
    return lookupMap.totalEntries === 0;
  }, [lookupMap.totalEntries]);

  // Get all unique values (in cents)
  const getAllValueCents = useMemo(() => {
    return Array.from(lookupMap.lookup.keys()).sort((a, b) => a - b);
  }, [lookupMap.lookup]);

  return {
    lookupMap,
    buildLookupMap,
    updateLookupMap,
    findByValue,
    findByValueCents,
    findByValueRange,
    getStats,
    clearLookupMap,
    isEmpty,
    getAllValueCents
  };
}