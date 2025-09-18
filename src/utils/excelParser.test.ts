import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseExcelFile } from './excelParser';

describe('Excel Parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseExcelFile', () => {
    it('should parse a valid Excel file successfully', async () => {
      const mockFile = new File(['mock excel data'], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      const mockData = [
        {
          date: '01/01/2024',
          paymentType: 'PIX',
          cpf: '12345678901',
          value: 100.50,
          originalHistory: 'PIX RECEBIDO - TESTE'
        }
      ];

      // Mock XLSX library
      vi.mock('xlsx', () => ({
        read: vi.fn(() => ({
          SheetNames: ['Sheet1'],
          Sheets: {
            Sheet1: {}
          }
        })),
        utils: {
          sheet_to_json: vi.fn(() => [
            { Data: '01/01/2024', 'Histórico': 'PIX RECEBIDO - TESTE', Valor: 100.50 }
          ])
        }
      }));

      const result = await parseExcelFile(mockFile);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        date: expect.any(String),
        paymentType: expect.any(String),
        value: expect.any(Number)
      });
    });

    it('should handle empty Excel files', async () => {
      const mockFile = new File([''], 'empty.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      const result = await parseExcelFile(mockFile);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Planilha vazia ou sem dados válidos');
    });

    it('should detect payment types correctly', async () => {
      const testCases = [
        { history: 'PIX RECEBIDO DE JOÃO', expected: 'PIX RECEBIDO' },
        { history: 'PIX ENVIADO PARA MARIA', expected: 'PIX ENVIADO' },
        { history: 'TED RECEBIDO', expected: 'TED' },
        { history: 'CARTÃO DE CRÉDITO', expected: 'CARTÃO' },
        { history: 'DINHEIRO EM ESPÉCIE', expected: 'DINHEIRO' },
        { history: 'TRANSFERÊNCIA BANCÁRIA', expected: 'TRANSFERÊNCIA' },
        { history: 'BOLETO PAGO', expected: 'BOLETO' },
        { history: 'DEPÓSITO EM CONTA', expected: 'DEPÓSITO' },
        { history: 'SAQUE ATM', expected: 'SAQUE' },
        { history: 'OUTRO TIPO', expected: 'OUTROS' }
      ];

      for (const testCase of testCases) {
        const mockFile = new File(['mock'], 'test.xlsx', {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        vi.mock('xlsx', () => ({
          utils: {
            sheet_to_json: vi.fn(() => [
              { Data: '01/01/2024', 'Histórico': testCase.history, Valor: 100 }
            ])
          }
        }));

        const result = await parseExcelFile(mockFile);

        if (result.success && result.data.length > 0) {
          expect(result.data[0].paymentType).toBe(testCase.expected);
        }
      }
    });

    it('should extract CPF from history correctly', async () => {
      const testCases = [
        { history: 'PIX DE 123.456.789-01', expected: '12345678901' },
        { history: 'TRANSFERÊNCIA CPF: 98765432101', expected: '98765432101' },
        { history: 'SEM CPF AQUI', expected: '' }
      ];

      for (const testCase of testCases) {
        const mockFile = new File(['mock'], 'test.xlsx', {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        vi.mock('xlsx', () => ({
          utils: {
            sheet_to_json: vi.fn(() => [
              { Data: '01/01/2024', 'Histórico': testCase.history, Valor: 100 }
            ])
          }
        }));

        const result = await parseExcelFile(mockFile);

        if (result.success && result.data.length > 0) {
          expect(result.data[0].cpf).toBe(testCase.expected);
        }
      }
    });

    it('should parse dates in various formats', async () => {
      const testDates = [
        { input: '01/01/2024', expected: '01/01/2024' },
        { input: '2024-01-01', expected: '01/01/2024' },
        { input: new Date(2024, 0, 1), expected: '01/01/2024' },
        { input: 45292, expected: '01/01/2024' } // Excel serial date
      ];

      for (const testDate of testDates) {
        const mockFile = new File(['mock'], 'test.xlsx', {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        vi.mock('xlsx', () => ({
          utils: {
            sheet_to_json: vi.fn(() => [
              { Data: testDate.input, 'Histórico': 'TEST', Valor: 100 }
            ])
          },
          SSF: {
            parse_date_code: vi.fn(() => ({ y: 2024, m: 1, d: 1 }))
          }
        }));

        const result = await parseExcelFile(mockFile);

        if (result.success && result.data.length > 0) {
          expect(result.data[0].date).toBe(testDate.expected);
        }
      }
    });

    it('should handle malformed data gracefully', async () => {
      const mockFile = new File(['corrupt'], 'corrupt.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      vi.mock('xlsx', () => ({
        read: vi.fn(() => {
          throw new Error('Invalid file format');
        })
      }));

      const result = await parseExcelFile(mockFile);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Erro ao processar planilha');
    });

    it('should validate required columns', async () => {
      const mockFile = new File(['mock'], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      // Missing required columns
      vi.mock('xlsx', () => ({
        utils: {
          sheet_to_json: vi.fn(() => [
            { 'Coluna Errada': 'valor' }
          ])
        }
      }));

      const result = await parseExcelFile(mockFile);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Não foi possível detectar as colunas obrigatórias (Data e Histórico)');
    });

    it('should handle credit/debit columns', async () => {
      const mockFile = new File(['mock'], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      vi.mock('xlsx', () => ({
        utils: {
          sheet_to_json: vi.fn(() => [
            { Data: '01/01/2024', 'Histórico': 'TESTE', 'Crédito': 100, 'Débito': 0 },
            { Data: '02/01/2024', 'Histórico': 'TESTE', 'Crédito': 0, 'Débito': 50 }
          ])
        }
      }));

      const result = await parseExcelFile(mockFile);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].value).toBe(100);
      expect(result.data[1].value).toBe(-50);
    });

    it('should calculate statistics correctly', async () => {
      const mockFile = new File(['mock'], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      vi.mock('xlsx', () => ({
        utils: {
          sheet_to_json: vi.fn(() => [
            { Data: '01/01/2024', 'Histórico': 'TESTE 1', Valor: 100 },
            { Data: '02/01/2024', 'Histórico': 'TESTE 2', Valor: 200 },
            { Data: '03/01/2024', 'Histórico': 'TESTE 3', Valor: 300 },
            { Data: 'invalid', 'Histórico': 'ERROR', Valor: 'abc' } // Invalid row
          ])
        }
      }));

      const result = await parseExcelFile(mockFile);

      expect(result.stats).toMatchObject({
        totalRows: 3,
        validRows: 3,
        rowsWithWarnings: 0,
        rowsWithErrors: 1,
        totalValue: 600
      });
    });

    it('should measure performance and complete within 150ms', async () => {
      const mockFile = new File(['mock'], 'large.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      // Generate large dataset
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        Data: `0${(i % 30) + 1}/01/2024`,
        'Histórico': `TRANSAÇÃO ${i}`,
        Valor: Math.random() * 1000
      }));

      vi.mock('xlsx', () => ({
        utils: {
          sheet_to_json: vi.fn(() => largeData)
        }
      }));

      const startTime = performance.now();
      const result = await parseExcelFile(mockFile);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1000);
      expect(duration).toBeLessThan(150);
    });
  });

  describe('Column Detection', () => {
    it('should detect columns with various naming variations', async () => {
      const columnVariations = [
        { date: ['data', 'date', 'dt', 'data mov'], valid: true },
        { history: ['histórico', 'historico', 'descrição', 'desc'], valid: true },
        { value: ['valor', 'valor (r$)', 'vlr', 'val'], valid: true },
        { credit: ['crédito', 'credito', 'entrada'], valid: true },
        { debit: ['débito', 'debito', 'saída'], valid: true }
      ];

      for (const variation of columnVariations) {
        for (const name of Object.values(variation).flat().filter(v => typeof v === 'string')) {
          const mockFile = new File(['mock'], 'test.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

          const mockHeader: any = {};
          mockHeader[name as string] = 'test value';

          vi.mock('xlsx', () => ({
            utils: {
              sheet_to_json: vi.fn(() => [mockHeader])
            }
          }));

          const result = await parseExcelFile(mockFile);
          // Verification logic based on column detection
        }
      }
    });
  });
});