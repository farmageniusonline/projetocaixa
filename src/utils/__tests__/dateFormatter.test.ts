import { describe, it, expect } from 'vitest';
import {
  formatToDDMMYYYY,
  formatForDateInput,
  formatForDisplay,
  getTodayDDMMYYYY
} from '../dateFormatter';

describe('dateFormatter', () => {
  describe('formatToDDMMYYYY', () => {
    it('formats ISO date string to DD-MM-YYYY', () => {
      expect(formatToDDMMYYYY('2024-01-15')).toBe('15-01-2024');
      expect(formatToDDMMYYYY('2024-12-31')).toBe('31-12-2024');
    });

    it('handles different date string formats', () => {
      expect(formatToDDMMYYYY('2024-01-15T10:30:00')).toBe('15-01-2024');
      expect(formatToDDMMYYYY('15/01/2024')).toBe('15-01-2024');
    });

    it('handles invalid dates gracefully', () => {
      expect(formatToDDMMYYYY('invalid-date')).toBe('');
      expect(formatToDDMMYYYY('')).toBe('');
    });
  });

  describe('formatForDateInput', () => {
    it('formats Date object to YYYY-MM-DD for input', () => {
      const date = new Date(2024, 0, 15); // January 15, 2024
      expect(formatForDateInput(date)).toBe('2024-01-15');
    });

    it('handles December correctly', () => {
      const date = new Date(2024, 11, 31); // December 31, 2024
      expect(formatForDateInput(date)).toBe('2024-12-31');
    });

    it('pads single digits with zero', () => {
      const date = new Date(2024, 0, 5); // January 5, 2024
      expect(formatForDateInput(date)).toBe('2024-01-05');
    });
  });

  describe('formatForDisplay', () => {
    it('formats Date object for display', () => {
      const date = new Date(2024, 0, 15);
      expect(formatForDisplay(date)).toBe('15/01/2024');
    });

    it('formats date string for display', () => {
      expect(formatForDisplay('15-01-2024')).toBe('15/01/2024');
      expect(formatForDisplay('2024-01-15')).toBe('15/01/2024');
    });

    it('handles invalid input gracefully', () => {
      expect(formatForDisplay('')).toBe('');
      expect(formatForDisplay('invalid')).toBe('');
    });
  });

  describe('getTodayDDMMYYYY', () => {
    it('returns today date in DD-MM-YYYY format', () => {
      const result = getTodayDDMMYYYY();
      const today = new Date();
      const expected = formatToDDMMYYYY(today.toISOString());

      expect(result).toBe(expected);
    });

    it('returns string in correct format', () => {
      const result = getTodayDDMMYYYY();
      expect(result).toMatch(/^\d{2}-\d{2}-\d{4}$/);
    });
  });
});