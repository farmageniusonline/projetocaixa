import * as XLSX from 'xlsx';
import * as Comlink from 'comlink';
import { formatToDDMMYYYY } from '../utils/dateFormatter';
import { generateOriginHashSync } from '../utils/idGenerator';
import { formSchemas, safeValidate, formatValidationError } from '../utils/validationSchemas';
import { performanceLogger } from '../utils/performanceLogger';

export interface ParsedRow {
  date: string;
  paymentType: string;
  cpf: string;
  value: number;
  originalHistory: string;
  validationStatus?: 'valid' | 'warning' | 'error';
  validationMessage?: string;
}

export interface ParseResult {
  success: boolean;
  data: ParsedRow[];
  errors: string[];
  warnings: string[];
  stats: {
    totalRows: number;
    validRows: number;
    rowsWithWarnings: number;
    rowsWithErrors: number;
    totalValue: number;
  };
}

export interface ProcessedExcelData {
  parseResult: ParseResult;
  valueCentsMap: Map<number, number[]>;
  normalizedEntries: BankEntryForProcessing[];
}

export interface BankEntryForProcessing {
  id: number;
  source_id: string;
  document_number?: string;
  date?: string;
  description?: string;
  value: number;
  value_cents: number;
  transaction_type?: string;
  balance?: number;
  status: 'pending' | 'conferred' | 'not_found' | 'transferred';
  day: string;
}

// Payment type patterns
const PAYMENT_TYPES = {
  'PIX RECEBIDO': /pix\s*recebid/i,
  'PIX ENVIADO': /pix\s*enviad/i,
  'TED': /\bted\b/i,
  'DOC': /\bdoc\b/i,
  'CARTÃO': /cart[aã]o/i,
  'DINHEIRO': /dinheiro/i,
  'BOLETO': /boleto/i,
  'TRANSFERÊNCIA': /transfer[eê]ncia/i,
  'DEPÓSITO': /dep[oó]sito/i,
  'SAQUE': /saque/i,
};

// Column name variations
const COLUMN_MAPPINGS = {
  date: ['data', 'date', 'data do lançamento', 'data do lancamento', 'dt', 'data mov', 'data movimento'],
  history: ['histórico', 'historico', 'descrição', 'descricao', 'histórico/descrição', 'historico/descricao', 'descrição/histórico', 'descricao/historico', 'desc'],
  value: ['valor', 'valor (r$)', 'valor r$', 'vlr', 'val'],
  credit: ['crédito', 'credito', 'entrada', 'receita'],
  debit: ['débito', 'debito', 'saída', 'saida', 'despesa'],
};

class ExcelProcessor {
  // Convert value to cents for exact matching
  private valueToCents(value: number): number {
    return Math.round(value * 100);
  }

  // Detect column indices based on header row
  private detectColumns(headerRow: any[]): {
    dateCol: number;
    historyCol: number;
    valueCol: number;
    creditCol: number;
    debitCol: number;
  } {
    const columns = {
      dateCol: -1,
      historyCol: -1,
      valueCol: -1,
      creditCol: -1,
      debitCol: -1
    };

    headerRow.forEach((header, index) => {
      if (!header) return;

      const headerStr = header.toString().toLowerCase().trim();

      // Date column
      if (columns.dateCol === -1 && COLUMN_MAPPINGS.date.some(pattern => headerStr.includes(pattern))) {
        columns.dateCol = index;
      }

      // History column
      if (columns.historyCol === -1 && COLUMN_MAPPINGS.history.some(pattern => headerStr.includes(pattern))) {
        columns.historyCol = index;
      }

      // Value column
      if (columns.valueCol === -1 && COLUMN_MAPPINGS.value.some(pattern => headerStr.includes(pattern))) {
        columns.valueCol = index;
      }

      // Credit column
      if (columns.creditCol === -1 && COLUMN_MAPPINGS.credit.some(pattern => headerStr.includes(pattern))) {
        columns.creditCol = index;
      }

      // Debit column
      if (columns.debitCol === -1 && COLUMN_MAPPINGS.debit.some(pattern => headerStr.includes(pattern))) {
        columns.debitCol = index;
      }
    });

    return columns;
  }

  // Detect payment type from history text
  private detectPaymentType(history: string): string {
    if (!history) return 'OUTROS';

    const historyUpper = history.toUpperCase();

    for (const [type, pattern] of Object.entries(PAYMENT_TYPES)) {
      if (pattern.test(historyUpper)) {
        return type;
      }
    }

    return 'OUTROS';
  }

  // Parse date from various formats
  private parseDate(dateValue: any): string {
    if (!dateValue) return '';

    try {
      // If it's already a Date object
      if (dateValue instanceof Date) {
        return formatToDDMMYYYY(dateValue);
      }

      // If it's a number (Excel date serial)
      if (typeof dateValue === 'number') {
        const date = XLSX.SSF.parse_date_code(dateValue);
        return formatToDDMMYYYY(new Date(date.y, date.m - 1, date.d));
      }

      // If it's a string
      if (typeof dateValue === 'string') {
        const parsed = new Date(dateValue);
        if (!isNaN(parsed.getTime())) {
          return formatToDDMMYYYY(parsed);
        }
      }

      return '';
    } catch (error) {
      console.warn('Failed to parse date:', dateValue, error);
      return '';
    }
  }

  // Parse value from various formats
  private parseValue(valueStr: any): number {
    if (typeof valueStr === 'number') return valueStr;
    if (!valueStr) return 0;

    const str = valueStr.toString()
      .replace(/[^\d,.-]/g, '')
      .replace(',', '.');

    const value = parseFloat(str);
    return isNaN(value) ? 0 : value;
  }

  // Extract CPF from history text
  private extractCPF(history: string): string {
    if (!history) return '';

    const cpfPattern = /(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/;
    const match = history.match(cpfPattern);

    return match ? match[1].replace(/[^\d]/g, '') : '';
  }

  // Validate row data using Zod
  private validateRowWithZod(row: ParsedRow): { status: 'valid' | 'warning' | 'error'; message?: string } {
    const validationResult = safeValidate(formSchemas.excelRow, {
      date: row.date,
      paymentType: row.paymentType,
      cpf: row.cpf,
      value: row.value,
      originalHistory: row.originalHistory
    });

    if (!validationResult.success) {
      // Critical validation errors
      if (validationResult.error.includes('Data') || validationResult.error.includes('Valor')) {
        return { status: 'error', message: validationResult.error };
      }
      // Non-critical validation issues
      return { status: 'warning', message: validationResult.error };
    }

    // Additional business logic validations
    if (row.value === 0) {
      return { status: 'warning', message: 'Valor zero' };
    }

    if (!row.originalHistory?.trim()) {
      return { status: 'warning', message: 'Histórico vazio' };
    }

    return { status: 'valid' };
  }

  // Legacy validation method (kept for backward compatibility)
  private validateRow(row: ParsedRow): { status: 'valid' | 'warning' | 'error'; message?: string } {
    return this.validateRowWithZod(row);
  }

  // Main processing function
  async processExcelFile(fileBuffer: ArrayBuffer, operationDate: string): Promise<ProcessedExcelData> {
    const parseOpId = performanceLogger.startOperation('excel_parse', {
      fileSize: fileBuffer.byteLength,
      operationDate
    });

    try {
      // Parse Excel file
      const workbook = XLSX.read(fileBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (rawData.length < 2) {
        throw new Error('Planilha deve conter pelo menos uma linha de dados além do cabeçalho');
      }

      // Detect columns from header
      const headerRow = rawData[0] as any[];
      const columns = this.detectColumns(headerRow);

      if (columns.dateCol === -1 || columns.historyCol === -1) {
        throw new Error('Não foi possível detectar as colunas obrigatórias (Data e Histórico)');
      }

      const parsedData: ParsedRow[] = [];
      const errors: string[] = [];
      const warnings: string[] = [];
      let totalValue = 0;
      let validRows = 0;
      let rowsWithWarnings = 0;
      let rowsWithErrors = 0;

      // Process each row
      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i] as any[];
        if (!row || row.length === 0) continue;

        try {
          const date = this.parseDate(row[columns.dateCol]);
          const history = row[columns.historyCol]?.toString() || '';

          let value = 0;

          // Try to get value from value column first
          if (columns.valueCol !== -1) {
            value = this.parseValue(row[columns.valueCol]);
          }
          // If no value column or value is 0, try credit/debit columns
          else if (columns.creditCol !== -1 || columns.debitCol !== -1) {
            const credit = columns.creditCol !== -1 ? this.parseValue(row[columns.creditCol]) : 0;
            const debit = columns.debitCol !== -1 ? this.parseValue(row[columns.debitCol]) : 0;
            value = credit || -Math.abs(debit);
          }

          const parsedRow: ParsedRow = {
            date,
            paymentType: this.detectPaymentType(history),
            cpf: this.extractCPF(history),
            value,
            originalHistory: history
          };

          // Validate row using Zod schema
          const validation = this.validateRowWithZod(parsedRow);
          parsedRow.validationStatus = validation.status;
          parsedRow.validationMessage = validation.message;

          // Update counters
          if (validation.status === 'valid') {
            validRows++;
            totalValue += Math.abs(value);
          } else if (validation.status === 'warning') {
            rowsWithWarnings++;
            warnings.push(`Linha ${i + 1}: ${validation.message}`);
          } else {
            rowsWithErrors++;
            errors.push(`Linha ${i + 1}: ${validation.message}`);
          }

          parsedData.push(parsedRow);
        } catch (rowError) {
          rowsWithErrors++;
          const errorMsg = `Linha ${i + 1}: Erro ao processar - ${rowError instanceof Error ? rowError.message : 'Erro desconhecido'}`;
          errors.push(errorMsg);
        }
      }

      // Create parse result
      const parseResult: ParseResult = {
        success: errors.length === 0,
        data: parsedData,
        errors,
        warnings,
        stats: {
          totalRows: parsedData.length,
          validRows,
          rowsWithWarnings,
          rowsWithErrors,
          totalValue
        }
      };

      // Convert to normalized bank entries with origin_hash
      const normalizedEntries: BankEntryForProcessing[] = parsedData.map((row, index) => {
        const originHash = generateOriginHashSync(
          row.date,
          row.cpf || '',
          row.value,
          row.originalHistory
        );

        return {
          id: index,
          source_id: originHash,
          document_number: row.cpf || undefined,
          date: row.date,
          description: row.originalHistory,
          value: row.value,
          value_cents: this.valueToCents(row.value),
          transaction_type: row.paymentType,
          status: 'pending' as const,
          day: operationDate
        };
      });

      // Create value_cents map for quick lookup
      const valueCentsMap = new Map<number, number[]>();
      normalizedEntries.forEach((entry) => {
        if (!valueCentsMap.has(entry.value_cents)) {
          valueCentsMap.set(entry.value_cents, []);
        }
        valueCentsMap.get(entry.value_cents)!.push(entry.id);
      });

      const result = {
        parseResult,
        valueCentsMap,
        normalizedEntries
      };

      performanceLogger.endOperation(parseOpId);
      return result;

    } catch (error) {
      performanceLogger.endOperation(parseOpId);
      throw new Error(`Erro ao processar planilha: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  // Process existing bank entries for indexing
  async processExistingEntries(entries: BankEntryForProcessing[]): Promise<Map<number, number[]>> {
    const valueCentsMap = new Map<number, number[]>();

    entries.forEach((entry) => {
      const cents = this.valueToCents(entry.value);
      if (!valueCentsMap.has(cents)) {
        valueCentsMap.set(cents, []);
      }
      valueCentsMap.get(cents)!.push(entry.id);
    });

    return valueCentsMap;
  }
}

// Expose the worker API
const processor = new ExcelProcessor();

const workerAPI = {
  processExcelFile: processor.processExcelFile.bind(processor),
  processExistingEntries: processor.processExistingEntries.bind(processor)
};

Comlink.expose(workerAPI);

export type WorkerAPI = typeof workerAPI;