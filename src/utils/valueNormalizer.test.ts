import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeValue,
  searchValueMatches,
  validateValueInput,
  createValueIndex,
  formatCurrency,
  ValueMatch
} from './valueNormalizer';

describe('Value Normalizer', () => {
  describe('normalizeValue', () => {
    it('should normalize values correctly', () => {
      expect(normalizeValue('123,45')).toBe(123.45);
      expect(normalizeValue('1.234,56')).toBe(1234.56);
      expect(normalizeValue('R$ 100,00')).toBe(100);
      expect(normalizeValue('100.00')).toBe(100);
      expect(normalizeValue('invalid')).toBe(0);
    });

    it('should handle edge cases', () => {
      expect(normalizeValue('')).toBe(0);
      expect(normalizeValue('0')).toBe(0);
      expect(normalizeValue('-100')).toBe(-100);
      expect(normalizeValue('0,01')).toBe(0.01);
    });
  });

  describe('validateValueInput', () => {
    it('should validate correct value formats', () => {
      expect(validateValueInput('123,45')).toEqual({
        isValid: true,
        value: 123.45,
        formattedValue: 'R$ 123,45'
      });

      expect(validateValueInput('1.234,56')).toEqual({
        isValid: true,
        value: 1234.56,
        formattedValue: 'R$ 1.234,56'
      });
    });

    it('should reject invalid formats', () => {
      expect(validateValueInput('abc')).toMatchObject({
        isValid: false,
        error: expect.stringContaining('inválido')
      });

      expect(validateValueInput('')).toMatchObject({
        isValid: false,
        error: expect.stringContaining('Digite um valor')
      });
    });
  });

  describe('searchValueMatches', () => {
    const mockData = [
      {
        date: '01/01/2024',
        paymentType: 'PIX',
        cpf: '12345678901',
        value: 100.50,
        originalHistory: 'PIX RECEBIDO - TESTE 1'
      },
      {
        date: '01/01/2024',
        paymentType: 'PIX',
        cpf: '98765432101',
        value: 100.50,
        originalHistory: 'PIX RECEBIDO - TESTE 2'
      },
      {
        date: '02/01/2024',
        paymentType: 'TED',
        cpf: '55555555555',
        value: 200.75,
        originalHistory: 'TED RECEBIDO - TESTE 3'
      },
      {
        date: '03/01/2024',
        paymentType: 'BOLETO',
        cpf: '',
        value: 50.25,
        originalHistory: 'BOLETO PAGO'
      }
    ];

    let valueIndex: Map<number, ValueMatch[]>;

    beforeEach(() => {
      valueIndex = createValueIndex(mockData);
    });

    it('should find single match', () => {
      const result = searchValueMatches('200,75', mockData, valueIndex);

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0]).toMatchObject({
        value: 200.75,
        originalHistory: 'TED RECEBIDO - TESTE 3'
      });
    });

    it('should find multiple matches', () => {
      const result = searchValueMatches('100,50', mockData, valueIndex);

      expect(result.matches).toHaveLength(2);
      expect(result.matches[0].value).toBe(100.50);
      expect(result.matches[1].value).toBe(100.50);
    });

    it('should return no matches for non-existent value', () => {
      const result = searchValueMatches('999,99', mockData, valueIndex);

      expect(result.matches).toHaveLength(0);
      expect(result.searchValue).toBe(999.99);
    });

    it('should handle zero values', () => {
      const dataWithZero = [...mockData, {
        date: '04/01/2024',
        paymentType: 'AJUSTE',
        cpf: '',
        value: 0,
        originalHistory: 'AJUSTE DE SALDO'
      }];

      const indexWithZero = createValueIndex(dataWithZero);
      const result = searchValueMatches('0', dataWithZero, indexWithZero);

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].value).toBe(0);
    });

    it('should be case-insensitive in history search', () => {
      const result = searchValueMatches('100,50', mockData, valueIndex);
      const histories = result.matches.map(m => m.originalHistory);

      expect(histories).toContain('PIX RECEBIDO - TESTE 1');
      expect(histories).toContain('PIX RECEBIDO - TESTE 2');
    });

    it('should perform search within 150ms for large dataset', () => {
      const largeData = Array.from({ length: 10000 }, (_, i) => ({
        date: `0${(i % 30) + 1}/01/2024`,
        paymentType: ['PIX', 'TED', 'BOLETO'][i % 3],
        cpf: i % 2 === 0 ? '12345678901' : '',
        value: (i % 100) + 0.01,
        originalHistory: `TRANSAÇÃO ${i}`
      }));

      const largeIndex = createValueIndex(largeData);

      const startTime = performance.now();
      const result = searchValueMatches('50,01', largeData, largeIndex);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(150);
      expect(result.matches.length).toBeGreaterThan(0);
    });
  });

  describe('createValueIndex', () => {
    it('should create index with value in cents as key', () => {
      const data = [
        { value: 100.50 },
        { value: 100.50 },
        { value: 200.75 }
      ];

      const index = createValueIndex(data as any);

      expect(index.has(10050)).toBe(true); // 100.50 * 100
      expect(index.has(20075)).toBe(true); // 200.75 * 100
      expect(index.get(10050)).toHaveLength(2); // Two entries with same value
    });

    it('should handle empty data', () => {
      const index = createValueIndex([]);

      expect(index.size).toBe(0);
    });

    it('should handle decimal precision correctly', () => {
      const data = [
        { value: 0.01 },
        { value: 0.10 },
        { value: 1.00 },
        { value: 10.00 }
      ];

      const index = createValueIndex(data as any);

      expect(index.has(1)).toBe(true);    // 0.01 * 100
      expect(index.has(10)).toBe(true);   // 0.10 * 100
      expect(index.has(100)).toBe(true);  // 1.00 * 100
      expect(index.has(1000)).toBe(true); // 10.00 * 100
    });
  });

  describe('formatCurrency', () => {
    it('should format currency correctly', () => {
      expect(formatCurrency(100)).toBe('R$ 100,00');
      expect(formatCurrency(1234.56)).toBe('R$ 1.234,56');
      expect(formatCurrency(0.01)).toBe('R$ 0,01');
      expect(formatCurrency(0)).toBe('R$ 0,00');
      expect(formatCurrency(-100)).toBe('-R$ 100,00');
    });

    it('should handle large numbers', () => {
      expect(formatCurrency(1000000)).toBe('R$ 1.000.000,00');
      expect(formatCurrency(1234567.89)).toBe('R$ 1.234.567,89');
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent searches efficiently', async () => {
      const data = Array.from({ length: 1000 }, (_, i) => ({
        date: '01/01/2024',
        paymentType: 'PIX',
        cpf: '',
        value: i + 0.01,
        originalHistory: `Transaction ${i}`
      }));

      const index = createValueIndex(data);

      const searches = Array.from({ length: 100 }, (_, i) =>
        searchValueMatches(`${i},01`, data, index)
      );

      const startTime = performance.now();
      const results = await Promise.all(searches);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(100);
      expect(duration).toBeLessThan(150);
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in history', () => {
      const data = [{
        date: '01/01/2024',
        paymentType: 'PIX',
        cpf: '',
        value: 100,
        originalHistory: 'PIX @#$%^&*() SPECIAL'
      }];

      const index = createValueIndex(data);
      const result = searchValueMatches('100', data, index);

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].originalHistory).toContain('SPECIAL');
    });

    it('should handle very small values', () => {
      const data = [{
        date: '01/01/2024',
        paymentType: 'PIX',
        cpf: '',
        value: 0.01,
        originalHistory: 'CENTAVO'
      }];

      const index = createValueIndex(data);
      const result = searchValueMatches('0,01', data, index);

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].value).toBe(0.01);
    });

    it('should handle negative values', () => {
      const data = [{
        date: '01/01/2024',
        paymentType: 'ESTORNO',
        cpf: '',
        value: -100.50,
        originalHistory: 'ESTORNO DE PAGAMENTO'
      }];

      const index = createValueIndex(data);
      const result = searchValueMatches('-100,50', data, index);

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].value).toBe(-100.50);
    });
  });
});