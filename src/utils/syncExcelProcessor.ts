import * as XLSX from 'xlsx';
import { formatToDDMMYYYY } from './dateFormatter';
import { generateOriginHashSync } from './idGenerator';
import type { ProcessedExcelData, ParsedRow, ParseResult, BankEntryForProcessing } from '../workers/excelProcessor.worker';

/**
 * Synchronous Excel processor for small files (< 100KB) as fallback
 * when Web Worker fails or times out
 */
export class SyncExcelProcessor {
  private valueToCents(value: number): number {
    return Math.round(value * 100);
  }

  private parseDate(dateValue: unknown): string {
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
        const trimmed = dateValue.trim();

        // Handle Brazilian date format DD/MM/YYYY
        if (trimmed.includes('/')) {
          const parts = trimmed.split('/');
          if (parts.length === 3) {
            const [part1, part2, part3] = parts;
            const day = parseInt(part1);
            const month = parseInt(part2);
            const year = parseInt(part3);

            if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900) {
              const date = new Date(year, month - 1, day);
              return formatToDDMMYYYY(date);
            }
          }
        }

        // Fallback to default parsing
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

  private parseValue(valueStr: unknown): number {
    if (typeof valueStr === 'number') return valueStr;
    if (!valueStr) return 0;

    const str = valueStr.toString()
      .replace(/[^\d,.-]/g, '')
      .replace(',', '.');

    const value = parseFloat(str);
    return isNaN(value) ? 0 : value;
  }

  private extractCPF(history: string): string {
    if (!history) return '';

    const cpfPattern = /(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/;
    const match = history.match(cpfPattern);

    return match ? match[1].replace(/[^\d]/g, '') : '';
  }

  private detectPaymentType(history: string): string {
    if (!history) return 'OUTROS';

    const historyUpper = history.toUpperCase();
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

    for (const [type, pattern] of Object.entries(PAYMENT_TYPES)) {
      if (pattern.test(historyUpper)) {
        return type;
      }
    }

    return 'OUTROS';
  }

  private detectColumns(headerRow: unknown[]): {
    dateCol: number;
    historyCol: number;
    valueCol: number;
    creditCol: number;
    debitCol: number;
  } {
    const COLUMN_MAPPINGS = {
      date: ['data', 'date', 'data do lançamento', 'data do lancamento', 'dt', 'data mov', 'data movimento'],
      history: ['histórico', 'historico', 'histórico original', 'historico original', 'histã³rico original', 'histã³rico', 'descrição', 'descricao', 'histórico/descrição', 'historico/descricao', 'descrição/histórico', 'descricao/historico', 'desc'],
      value: ['valor', 'valor (r$)', 'valor r$', 'vlr', 'val'],
      credit: ['crédito', 'credito', 'entrada', 'receita'],
      debit: ['débito', 'debito', 'saída', 'saida', 'despesa'],
    };

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

  async processExcelFile(
    fileBuffer: ArrayBuffer,
    operationDate: string,
    onProgress?: (progress: number) => void
  ): Promise<ProcessedExcelData> {
    console.log('🔄 Sync Processor: Iniciando processamento síncrono...', {
      fileSize: fileBuffer.byteLength,
      operationDate
    });

    try {
      onProgress?.(10);

      // Read Excel file with minimal options
      console.log('🔄 Sync Processor: Lendo workbook...');
      const workbook = XLSX.read(fileBuffer, {
        type: 'array',
        cellDates: true,
        raw: false
      });

      onProgress?.(30);

      if (workbook.SheetNames.length === 0) {
        throw new Error('Nenhuma planilha encontrada');
      }

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      if (!worksheet) {
        throw new Error('Planilha não encontrada ou vazia');
      }

      onProgress?.(50);

      // Convert to JSON
      console.log('🔄 Sync Processor: Convertendo para JSON...');
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (rawData.length < 2) {
        throw new Error('Planilha deve conter pelo menos uma linha de dados além do cabeçalho');
      }

      onProgress?.(70);

      // Detect columns from header
      let columns = { dateCol: -1, historyCol: -1, valueCol: -1, creditCol: -1, debitCol: -1 };
      let headerRowIndex = -1;

      // Try first 5 rows to find the header row
      for (let rowIndex = 0; rowIndex < Math.min(5, rawData.length); rowIndex++) {
        const candidateRow = rawData[rowIndex] as any[];
        const testColumns = this.detectColumns(candidateRow);

        if (testColumns.dateCol !== -1 && testColumns.historyCol !== -1) {
          columns = testColumns;
          headerRowIndex = rowIndex;
          break;
        }
      }

      if (columns.dateCol === -1 || columns.historyCol === -1) {
        throw new Error('Não foi possível detectar as colunas obrigatórias (Data e Histórico)');
      }

      const parsedData: ParsedRow[] = [];
      const errors: string[] = [];
      const warnings: string[] = [];
      let totalValue = 0;
      let validRows = 0;

      // Process each row
      console.log('🔄 Sync Processor: Processando linhas...');
      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i] as any[];
        if (!row || row.length === 0) continue;

        try {
          const date = this.parseDate(row[columns.dateCol]);
          const history = row[columns.historyCol]?.toString() || '';

          let value = 0;
          if (columns.valueCol !== -1) {
            value = this.parseValue(row[columns.valueCol]);
          } else if (columns.creditCol !== -1 || columns.debitCol !== -1) {
            const credit = columns.creditCol !== -1 ? this.parseValue(row[columns.creditCol]) : 0;
            const debit = columns.debitCol !== -1 ? this.parseValue(row[columns.debitCol]) : 0;
            value = credit || -Math.abs(debit);
          }

          const parsedRow: ParsedRow = {
            date,
            paymentType: this.detectPaymentType(history),
            cpf: this.extractCPF(history),
            value,
            originalHistory: history,
            validationStatus: 'valid'
          };

          // Basic validation
          if (!date) {
            parsedRow.validationStatus = 'warning';
            parsedRow.validationMessage = 'Data inválida';
            warnings.push(`Linha ${i + 1}: Data inválida`);
          } else if (value === 0) {
            parsedRow.validationStatus = 'warning';
            parsedRow.validationMessage = 'Valor zero';
            warnings.push(`Linha ${i + 1}: Valor zero`);
          } else {
            validRows++;
            totalValue += Math.abs(value);
          }

          parsedData.push(parsedRow);
        } catch (rowError) {
          const errorMsg = `Linha ${i + 1}: ${rowError instanceof Error ? rowError.message : 'Erro desconhecido'}`;
          errors.push(errorMsg);
        }
      }

      onProgress?.(90);

      // Create parse result
      const parseResult: ParseResult = {
        success: errors.length === 0,
        data: parsedData,
        errors,
        warnings,
        stats: {
          totalRows: parsedData.length,
          validRows,
          rowsWithWarnings: warnings.length,
          rowsWithErrors: errors.length,
          totalValue
        }
      };

      // Convert to normalized bank entries
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

      // Create value_cents map
      const valueCentsMap = new Map<number, number[]>();
      normalizedEntries.forEach((entry) => {
        if (!valueCentsMap.has(entry.value_cents)) {
          valueCentsMap.set(entry.value_cents, []);
        }
        valueCentsMap.get(entry.value_cents)!.push(entry.id);
      });

      onProgress?.(100);

      console.log('✅ Sync Processor: Processamento síncrono concluído');
      return {
        parseResult,
        valueCentsMap,
        normalizedEntries
      };

    } catch (error) {
      console.error('❌ Sync Processor: Erro no processamento síncrono:', error);
      throw error;
    }
  }
}

export const syncExcelProcessor = new SyncExcelProcessor();