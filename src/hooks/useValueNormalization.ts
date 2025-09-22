import { useCallback } from 'react';

/**
 * Hook for value normalization and conversion
 * Extracted from useValueLookup for single responsibility
 */
export function useValueNormalization() {
  // Convert value to cents for exact matching
  const valueToCents = useCallback((value: number): number => {
    return Math.round(value * 100);
  }, []);

  // Convert cents back to decimal value
  const centsToValue = useCallback((cents: number): number => {
    return cents / 100;
  }, []);

  // Normalize value for search (handles different formats)
  const normalizeValue = useCallback((input: string | number): number => {
    if (typeof input === 'number') return input;

    // Handle Brazilian currency format (123.456,78)
    const cleaned = input
      .replace(/[^\d,.-]/g, '') // Remove everything except digits, comma, dot, dash
      .replace(/\./g, '') // Remove thousand separators
      .replace(',', '.'); // Replace decimal comma with dot

    const value = parseFloat(cleaned);
    return isNaN(value) ? 0 : value;
  }, []);

  // Check if two values are approximately equal (handles floating point precision)
  const valuesAreEqual = useCallback((value1: number, value2: number, tolerance: number = 0.01): boolean => {
    return Math.abs(value1 - value2) <= tolerance;
  }, []);

  return {
    valueToCents,
    centsToValue,
    normalizeValue,
    valuesAreEqual
  };
}