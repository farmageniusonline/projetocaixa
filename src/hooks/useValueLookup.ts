import { useState, useCallback, useMemo } from 'react';
import { ConferenceHistoryEntry } from '../services/indexedDbService';

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

export function useValueLookup() {
  const [lookupMap, setLookupMap] = useState<ValueLookupMap>({
    lookup: new Map(),
    totalEntries: 0,
    uniqueValues: 0,
    lastUpdated: new Date()
  });

  // Convert value to cents for exact matching
  const valueToCents = useCallback((value: number): number => {
    return Math.round(value * 100);
  }, []);

  // Build lookup map from conference history entries
  const buildLookupMap = useCallback((entries: ConferenceHistoryEntry[]): ValueLookupMap => {
    const lookup = new Map<number, LookupEntry[]>();
    let totalEntries = 0;

    console.time('buildLookupMap');

    for (const entry of entries) {
      if (!entry.value || entry.value === 0) continue;

      const valueCents = valueToCents(entry.value);
      const lookupEntry: LookupEntry = {
        id: entry.id!,
        source: entry.source as LookupEntry['source'],
        value: entry.value,
        value_cents: valueCents,
        status: entry.status || 'unknown',
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

    console.timeEnd('buildLookupMap');

    const newMap = {
      lookup,
      totalEntries,
      uniqueValues: lookup.size,
      lastUpdated: new Date()
    };

    console.log(`Lookup map built: ${totalEntries} entries, ${lookup.size} unique values`);
    return newMap;
  }, [valueToCents]);

  // Update the entire lookup map
  const updateLookupMap = useCallback((entries: ConferenceHistoryEntry[]) => {
    const newMap = buildLookupMap(entries);
    setLookupMap(newMap);
    return newMap;
  }, [buildLookupMap]);

  // Find entries by value (O(1) lookup)
  const findByValue = useCallback((value: number): LookupEntry[] => {
    const valueCents = valueToCents(value);
    return lookupMap.lookup.get(valueCents) || [];
  }, [lookupMap.lookup, valueToCents]);

  // Add entry to lookup map (incremental update)
  const addEntry = useCallback((entry: ConferenceHistoryEntry) => {
    if (!entry.value || entry.value === 0 || !entry.id) return;

    const valueCents = valueToCents(entry.value);
    const lookupEntry: LookupEntry = {
      id: entry.id,
      source: entry.source as LookupEntry['source'],
      value: entry.value,
      value_cents: valueCents,
      status: entry.status || 'unknown',
      description: entry.description,
      document_number: entry.document_number,
      date: entry.date,
      entry
    };

    setLookupMap(prev => {
      const newLookup = new Map(prev.lookup);

      if (!newLookup.has(valueCents)) {
        newLookup.set(valueCents, []);
      }

      const existing = newLookup.get(valueCents)!;
      // Check if entry already exists (by id)
      const existingIndex = existing.findIndex(e => e.id === entry.id);

      if (existingIndex === -1) {
        // Add new entry
        existing.push(lookupEntry);
      } else {
        // Update existing entry
        existing[existingIndex] = lookupEntry;
      }

      return {
        lookup: newLookup,
        totalEntries: Array.from(newLookup.values()).reduce((sum, entries) => sum + entries.length, 0),
        uniqueValues: newLookup.size,
        lastUpdated: new Date()
      };
    });
  }, [valueToCents]);

  // Remove entry from lookup map (incremental update)
  const removeEntry = useCallback((entryId: string | number, value: number) => {
    const valueCents = valueToCents(value);

    setLookupMap(prev => {
      const newLookup = new Map(prev.lookup);
      const entries = newLookup.get(valueCents);

      if (entries) {
        const filtered = entries.filter(e => e.id !== entryId);

        if (filtered.length === 0) {
          // Remove the value key entirely if no entries left
          newLookup.delete(valueCents);
        } else {
          newLookup.set(valueCents, filtered);
        }
      }

      return {
        lookup: newLookup,
        totalEntries: Array.from(newLookup.values()).reduce((sum, entries) => sum + entries.length, 0),
        uniqueValues: newLookup.size,
        lastUpdated: new Date()
      };
    });
  }, [valueToCents]);

  // Update entry status (incremental update)
  const updateEntryStatus = useCallback((entryId: string | number, value: number, newStatus: string) => {
    const valueCents = valueToCents(value);

    setLookupMap(prev => {
      const newLookup = new Map(prev.lookup);
      const entries = newLookup.get(valueCents);

      if (entries) {
        const entryIndex = entries.findIndex(e => e.id === entryId);
        if (entryIndex !== -1) {
          const updatedEntries = [...entries];
          updatedEntries[entryIndex] = {
            ...updatedEntries[entryIndex],
            status: newStatus
          };
          newLookup.set(valueCents, updatedEntries);
        }
      }

      return {
        ...prev,
        lookup: newLookup,
        lastUpdated: new Date()
      };
    });
  }, [valueToCents]);

  // Get entries by status for a specific value
  const findByValueAndStatus = useCallback((value: number, status: string | string[]): LookupEntry[] => {
    const entries = findByValue(value);
    const statusArray = Array.isArray(status) ? status : [status];

    return entries.filter(entry => statusArray.includes(entry.status));
  }, [findByValue]);

  // Get statistics
  const stats = useMemo(() => {
    const statusCounts = new Map<string, number>();
    const sourceCounts = new Map<string, number>();

    for (const entries of lookupMap.lookup.values()) {
      for (const entry of entries) {
        // Count by status
        statusCounts.set(entry.status, (statusCounts.get(entry.status) || 0) + 1);

        // Count by source
        sourceCounts.set(entry.source, (sourceCounts.get(entry.source) || 0) + 1);
      }
    }

    return {
      totalEntries: lookupMap.totalEntries,
      uniqueValues: lookupMap.uniqueValues,
      statusCounts: Object.fromEntries(statusCounts),
      sourceCounts: Object.fromEntries(sourceCounts),
      lastUpdated: lookupMap.lastUpdated
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

  return {
    // State
    lookupMap,

    // Actions
    updateLookupMap,
    findByValue,
    findByValueAndStatus,
    addEntry,
    removeEntry,
    updateEntryStatus,
    clearLookupMap,

    // Utils
    valueToCents,
    stats
  };
}